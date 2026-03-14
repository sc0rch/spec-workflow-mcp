import { access } from 'fs/promises';
import { join } from 'path';
import { SpecParser } from './parser.js';
import {
  ProjectActivityService,
  type ProjectLatestImplementation
} from './project-activity.js';
import {
  getCurrentGitBranch,
  resolveGitRoot,
  resolveGitWorkspaceRoot
} from './git-utils.js';
import { PathUtils, validateProjectPath } from './path-utils.js';
import {
  ProjectRegistry,
  ProjectRegistryEntry,
  ProjectInstance
} from './project-registry.js';
import {
  RememberedProjectEntry,
  RememberedProjectsStore
} from './remembered-projects.js';

export interface ProjectCatalogLatestSpec {
  name: string;
  displayName: string;
  createdAt: string;
}

export interface ProjectCatalogEntry {
  projectId: string;
  projectName: string;
  workspacePath: string;
  workflowRootPath: string;
  instances: ProjectInstance[];
  connectionState: 'live' | 'remembered';
  source: 'manual' | 'mcp' | null;
  addedAt: string | null;
  lastSeenAt: string | null;
  gitBranch?: string | undefined;
  latestSpec?: ProjectCatalogLatestSpec | undefined;
  pendingApprovalCount: number;
  latestImplementation?: ProjectLatestImplementation | undefined;
}

export interface ProjectCatalogServiceOptions {
  registry?: ProjectRegistry;
  rememberedProjects?: RememberedProjectsStore;
  projectActivity?: ProjectActivityService;
}

export class ProjectCatalogService {
  private readonly registry: ProjectRegistry;
  private readonly rememberedProjects: RememberedProjectsStore;
  private readonly projectActivity: ProjectActivityService;

  constructor(options: ProjectCatalogServiceOptions = {}) {
    this.registry = options.registry ?? new ProjectRegistry();
    this.rememberedProjects = options.rememberedProjects ?? new RememberedProjectsStore();
    this.projectActivity = options.projectActivity ?? new ProjectActivityService();
  }

  async cleanupStaleProjects(): Promise<number> {
    return this.registry.cleanupStaleProjects();
  }

  async listRegistryEntries(): Promise<ProjectRegistryEntry[]> {
    const liveEntries = await this.registry.getAllProjects();
    return this.mergeProjectEntries(liveEntries);
  }

  async getProjects(): Promise<ProjectCatalogEntry[]> {
    const mergedEntries = await this.listRegistryEntries();
    const rememberedEntries = await this.rememberedProjects.getAllProjects();
    const rememberedById = new Map(
      rememberedEntries.map((entry) => [entry.projectId, entry] as const)
    );

    const projects = await Promise.all(
      mergedEntries.map(async (entry) => this.toProjectCatalogEntry(entry, rememberedById.get(entry.projectId) ?? null))
    );

    return projects.sort((left, right) => left.projectName.localeCompare(right.projectName));
  }

  async getProjectById(projectId: string): Promise<ProjectCatalogEntry | null> {
    const projects = await this.getProjects();
    return projects.find((project) => project.projectId === projectId) ?? null;
  }

  async addProjectByPath(projectPath: string): Promise<ProjectCatalogEntry> {
    const requestedPath = await validateProjectPath(projectPath);
    const workspacePath = resolveGitWorkspaceRoot(requestedPath);
    const workflowRootPath = await this.resolveWorkflowRootPath(workspacePath);

    const remembered = await this.rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath,
      source: 'manual'
    });

    const project = await this.getProjectById(remembered.projectId);
    if (!project) {
      throw new Error(`Failed to resolve remembered project ${remembered.projectId}`);
    }

    return project;
  }

  async forgetProjectById(projectId: string): Promise<void> {
    await this.rememberedProjects.removeProjectById(projectId);
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
        instances: liveEntry.instances
      });
    }

    return Array.from(merged.values()).sort((left, right) => left.projectName.localeCompare(right.projectName));
  }

  private async toProjectCatalogEntry(
    entry: ProjectRegistryEntry,
    rememberedEntry: RememberedProjectEntry | null
  ): Promise<ProjectCatalogEntry> {
    const translatedWorkspacePath = PathUtils.translatePath(entry.projectPath);
    const translatedWorkflowRootPath = PathUtils.translatePath(entry.workflowRootPath);
    const parser = new SpecParser(translatedWorkflowRootPath);
    const [latestSpec, activity] = await Promise.all([
      this.computeLatestSpec(parser),
      this.projectActivity.getProjectActivity({
        translatedWorkflowRootPath,
        translatedWorkspacePath
      })
    ]);

    return {
      projectId: entry.projectId,
      projectName: entry.projectName,
      workspacePath: entry.projectPath,
      workflowRootPath: entry.workflowRootPath,
      instances: entry.instances,
      connectionState: entry.instances.length > 0 ? 'live' : 'remembered',
      source: rememberedEntry?.source ?? (entry.instances.length > 0 ? 'mcp' : null),
      addedAt: rememberedEntry?.addedAt ?? null,
      lastSeenAt: rememberedEntry?.lastSeenAt ?? null,
      gitBranch: getCurrentGitBranch(translatedWorkspacePath),
      latestSpec,
      pendingApprovalCount: activity.pendingApprovalCount,
      latestImplementation: activity.latestImplementation
    };
  }

  private async resolveWorkflowRootPath(workspacePath: string): Promise<string> {
    const defaultWorkflowRootPath = resolveGitRoot(workspacePath);
    const localWorkflowRootPath = join(workspacePath, '.spec-workflow');

    try {
      await access(localWorkflowRootPath);
      return workspacePath;
    } catch {
      return defaultWorkflowRootPath;
    }
  }

  private async computeLatestSpec(parser: SpecParser): Promise<ProjectCatalogLatestSpec | undefined> {
    try {
      const specs = await parser.getAllSpecs();
      if (!specs.length) {
        return undefined;
      }

      const [firstSpec, ...remainingSpecs] = specs;
      if (!firstSpec) {
        return undefined;
      }

      let best = firstSpec;
      let bestTimestamp = Date.parse(best.createdAt || '') || 0;

      for (const spec of remainingSpecs) {
        const timestamp = Date.parse(spec.createdAt || '') || 0;
        if (timestamp > bestTimestamp) {
          best = spec;
          bestTimestamp = timestamp;
        }
      }

      return {
        name: best.name,
        displayName: best.displayName,
        createdAt: best.createdAt
      };
    } catch {
      return undefined;
    }
  }
}
