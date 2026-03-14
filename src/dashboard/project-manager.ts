import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { join } from 'path';
import { SpecParser } from './parser.js';
import { SpecWatcher } from './watcher.js';
import { ApprovalStorage } from './approval-storage.js';
import { SpecArchiveService } from '../core/archive-service.js';
import { ProjectRegistry, ProjectRegistryEntry, ProjectInstance } from '../core/project-registry.js';
import { RememberedProjectsStore } from '../core/remembered-projects.js';
import { PathUtils, validateProjectPath } from '../core/path-utils.js';
import { resolveGitRoot, resolveGitWorkspaceRoot, getCurrentGitBranch } from '../core/git-utils.js';
import { access } from 'fs/promises';

export interface ProjectContext {
  projectId: string;
  projectPath: string;           // Translated workflow root path for specs/.spec-workflow access
  workspacePath: string;         // Translated workspace/worktree path for file artifact resolution
  originalProjectPath: string;   // Original workspace path for display/registry
  workflowRootPath: string;      // Original workflow root path for display/debugging
  projectName: string;
  gitBranch?: string;
  latestSpec?: { name: string; displayName: string; createdAt: string };
  instances: ProjectInstance[];  // Active MCP server instances for this project
  approvalWatcherStarted: boolean;
  parser: SpecParser;
  watcher: SpecWatcher;
  approvalStorage: ApprovalStorage;
  archiveService: SpecArchiveService;
}

export class ProjectManager extends EventEmitter {
  private registry: ProjectRegistry;
  private rememberedProjects: RememberedProjectsStore;
  private projects: Map<string, ProjectContext> = new Map();
  private registryWatcher?: chokidar.FSWatcher;
  private pendingLatestSpecUpdates: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.registry = new ProjectRegistry();
    this.rememberedProjects = new RememberedProjectsStore();
  }

  /**
   * Initialize the project manager
   * Loads projects from registry and starts watching for changes
   * Note: MCP servers handle their own lifecycle cleanup via stop()
   */
  async initialize(): Promise<void> {
    // Clean up stale instances once at startup (self-healing for crashes)
    await this.registry.cleanupStaleProjects();

    // Load remembered projects and merge them with live registry instances
    await this.syncWithSources();

    // Watch registry file for changes
    this.startRegistryWatcher();

    // Note: Removed periodic cleanup interval
    // MCP servers are responsible for cleaning up their own instances on stop()
    // The cleanup at startup handles any orphaned instances from crashes
  }

  /**
   * Start watching the registry file for changes
   */
  private startRegistryWatcher(): void {
    const registryPath = this.registry.getRegistryPath();

    this.registryWatcher = chokidar.watch(registryPath, {
      ignoreInitial: true,
      persistent: true,
      ignorePermissionErrors: true
    });

    this.registryWatcher.on('change', async () => {
      await this.syncWithSources();
    });

    this.registryWatcher.on('add', async () => {
      await this.syncWithSources();
    });

    // Add error handler to prevent watcher crashes
    this.registryWatcher.on('error', (error) => {
      console.error('Registry watcher error:', error);
      // Don't propagate error to prevent system crash
    });
  }

  /**
   * Sync current projects with registry
   * Add new projects, remove deleted ones, update instances for existing projects
   */
  private async syncWithSources(): Promise<void> {
    try {
      const liveEntries = await this.registry.getAllProjects();
      const mergedEntries = await this.mergeProjectEntries(liveEntries);
      const mergedIds = new Set(mergedEntries.map(e => e.projectId));
      const currentIds = new Set(this.projects.keys());

      // Add new projects or update instances for existing ones
      for (const entry of mergedEntries) {
        if (!currentIds.has(entry.projectId)) {
          await this.addProject(entry);
        } else {
          // Update instances for existing project
          const project = this.projects.get(entry.projectId);
          if (project) {
            project.projectName = entry.projectName;
            project.originalProjectPath = entry.projectPath;
            project.workflowRootPath = entry.workflowRootPath;
            project.projectPath = PathUtils.translatePath(entry.workflowRootPath);
            project.workspacePath = PathUtils.translatePath(entry.projectPath);
            project.gitBranch = getCurrentGitBranch(project.workspacePath) || project.gitBranch;
            project.instances = entry.instances || [];
            await this.ensureApprovalWatcherState(project, entry);
          }
        }
      }

      // Remove deleted projects
      for (const projectId of currentIds) {
        if (!mergedIds.has(projectId)) {
          await this.removeProject(projectId);
        }
      }

      // Emit projects update event
      this.emit('projects-update', this.getProjectsList());
    } catch (error) {
      console.error('Error syncing with registry:', error);
    }
  }

  /**
   * Add a project context
   */
  private async addProject(entry: ProjectRegistryEntry): Promise<void> {
    try {
      // Translate paths once at entry point (components should not know about Docker)
      const translatedWorkspacePath = PathUtils.translatePath(entry.projectPath);
      const translatedWorkflowRootPath = PathUtils.translatePath(entry.workflowRootPath);

      const parser = new SpecParser(translatedWorkflowRootPath);
      const watcher = new SpecWatcher(translatedWorkflowRootPath, parser);
      const approvalStorage = new ApprovalStorage(translatedWorkflowRootPath, {
        originalPath: entry.workflowRootPath,
        fileResolutionPath: translatedWorkspacePath
      });
      const archiveService = new SpecArchiveService(translatedWorkflowRootPath);

      // Start watchers
      await watcher.start();

      // Forward events with projectId
      watcher.on('change', (event) => {
        this.emit('spec-change', { projectId: entry.projectId, ...event });
        this.scheduleLatestSpecUpdate(entry.projectId);
      });

      watcher.on('task-update', (event) => {
        this.emit('task-update', { projectId: entry.projectId, ...event });
      });

      watcher.on('steering-change', (event) => {
        this.emit('steering-change', { projectId: entry.projectId, ...event });
      });

      approvalStorage.on('approval-change', () => {
        this.emit('approval-change', { projectId: entry.projectId });
      });

      const context: ProjectContext = {
        projectId: entry.projectId,
        projectPath: translatedWorkflowRootPath,
        workspacePath: translatedWorkspacePath,
        originalProjectPath: entry.projectPath, // Keep workspace path for display/registry
        workflowRootPath: entry.workflowRootPath,
        projectName: entry.projectName,
        gitBranch: getCurrentGitBranch(translatedWorkspacePath),
        latestSpec: await this.computeLatestSpec(parser),
        instances: entry.instances || [],       // Track MCP server instances
        approvalWatcherStarted: false,
        parser,
        watcher,
        approvalStorage,
        archiveService
      };

      this.projects.set(entry.projectId, context);
      await this.ensureApprovalWatcherState(context, entry);
      console.error(`Project added: ${entry.projectName} (${entry.projectId})`);

      // Emit project added event
      this.emit('project-added', entry.projectId);
    } catch (error) {
      console.error(`Failed to add project ${entry.projectName}:`, error);
    }
  }

  /**
   * Remove a project context
   */
  private async removeProject(projectId: string): Promise<void> {
    const context = this.projects.get(projectId);
    if (!context) return;

    try {
      // Stop watchers
      await context.watcher.stop();
      await context.approvalStorage.stop();

      // Remove all listeners
      context.watcher.removeAllListeners();
      context.approvalStorage.removeAllListeners();

      this.projects.delete(projectId);
      console.error(`Project removed: ${context.projectName} (${projectId})`);

      // Emit project removed event
      this.emit('project-removed', projectId);
    } catch (error) {
      console.error(`Failed to remove project ${projectId}:`, error);
    }
  }

  /**
   * Get a project context by ID
   */
  getProject(projectId: string): ProjectContext | undefined {
    return this.projects.get(projectId);
  }

  /**
   * Get all project contexts
   */
  getAllProjects(): ProjectContext[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get projects list for API
   */
  getProjectsList(): Array<{
    projectId: string;
    projectName: string;
    projectPath: string;
    gitBranch?: string;
    latestSpec?: { name: string; displayName: string; createdAt: string };
    instances: ProjectInstance[];
  }> {
    return Array.from(this.projects.values()).map(p => ({
      projectId: p.projectId,
      projectName: p.projectName,
      projectPath: p.originalProjectPath,  // Return original path for display
      gitBranch: p.gitBranch,
      latestSpec: p.latestSpec,
      instances: p.instances
    }));
  }

  private async computeLatestSpec(parser: SpecParser): Promise<{ name: string; displayName: string; createdAt: string } | undefined> {
    try {
      const specs = await parser.getAllSpecs();
      if (!specs.length) return undefined;

      let best = specs[0];
      let bestTs = Date.parse(best.createdAt || '') || 0;

      for (const spec of specs.slice(1)) {
        const ts = Date.parse(spec.createdAt || '') || 0;
        if (ts > bestTs) {
          best = spec;
          bestTs = ts;
        }
      }

      return { name: best.name, displayName: best.displayName, createdAt: best.createdAt };
    } catch {
      return undefined;
    }
  }

  private scheduleLatestSpecUpdate(projectId: string): void {
    const existing = this.pendingLatestSpecUpdates.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.pendingLatestSpecUpdates.delete(projectId);
      const ctx = this.projects.get(projectId);
      if (!ctx) return;

      const latestSpec = await this.computeLatestSpec(ctx.parser);
      if (latestSpec) {
        ctx.latestSpec = latestSpec;
      } else {
        ctx.latestSpec = undefined;
      }
    }, 350);

    this.pendingLatestSpecUpdates.set(projectId, timer);
  }

  /**
   * Manually add a project by path
   */
  async addProjectByPath(projectPath: string): Promise<string> {
    const requestedPath = await validateProjectPath(projectPath);
    const workspacePath = resolveGitWorkspaceRoot(requestedPath);
    const defaultWorkflowRootPath = resolveGitRoot(workspacePath);
    const localWorkflowRootPath = join(workspacePath, '.spec-workflow');
    let workflowRootPath = defaultWorkflowRootPath;

    try {
      await access(localWorkflowRootPath);
      workflowRootPath = workspacePath;
    } catch {
      workflowRootPath = defaultWorkflowRootPath;
    }

    const remembered = await this.rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath,
      source: 'manual'
    });
    await this.syncWithSources();
    return remembered.projectId;
  }

  /**
   * Manually remove a project
   */
  async removeProjectById(projectId: string): Promise<void> {
    await this.rememberedProjects.removeProjectById(projectId);
    await this.syncWithSources();
  }

  /**
   * Stop the project manager
   */
  async stop(): Promise<void> {
    // Stop registry watcher
    if (this.registryWatcher) {
      this.registryWatcher.removeAllListeners();
      await this.registryWatcher.close();
      this.registryWatcher = undefined;
    }

    // Stop all projects
    const projectIds = Array.from(this.projects.keys());
    for (const projectId of projectIds) {
      await this.removeProject(projectId);
    }

    // Remove all listeners
    this.removeAllListeners();
  }

  private async mergeProjectEntries(liveEntries: ProjectRegistryEntry[]): Promise<ProjectRegistryEntry[]> {
    const rememberedEntries = await this.rememberedProjects.getAllProjects();
    const hiddenProjectIds = await this.rememberedProjects.getHiddenProjectIds();
    const merged = new Map<string, ProjectRegistryEntry>();

    for (const remembered of rememberedEntries) {
      merged.set(remembered.projectId, {
        projectId: remembered.projectId,
        projectPath: remembered.workspacePath,
        workflowRootPath: remembered.workflowRootPath,
        projectName: remembered.projectName,
        instances: []
      });
    }

    for (const liveEntry of liveEntries) {
      if (!hiddenProjectIds.has(liveEntry.projectId)) {
        await this.rememberedProjects.upsertProject(liveEntry.projectPath, {
          workflowRootPath: liveEntry.workflowRootPath,
          projectName: liveEntry.projectName,
          source: 'mcp'
        });
      }

      merged.set(liveEntry.projectId, {
        projectId: liveEntry.projectId,
        projectPath: liveEntry.projectPath,
        workflowRootPath: liveEntry.workflowRootPath,
        projectName: liveEntry.projectName,
        instances: liveEntry.instances,
      });
    }

    return Array.from(merged.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  private async ensureApprovalWatcherState(project: ProjectContext, entry: ProjectRegistryEntry): Promise<void> {
    const shouldStartApprovalWatcher = entry.instances.length > 0;
    if (!project.approvalWatcherStarted && shouldStartApprovalWatcher) {
      await project.approvalStorage.start();
      project.approvalWatcherStarted = true;
    }
  }
}
