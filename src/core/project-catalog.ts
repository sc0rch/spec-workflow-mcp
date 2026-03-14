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
  lastModified?: string | undefined;
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

const LIVE_PROJECT_METADATA_REFRESH_INTERVAL_MS = 30_000;

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
    const rememberedById = new Map(
      rememberedEntries.map((entry) => [entry.projectId, entry] as const)
    );

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
      const rememberedEntry = rememberedById.get(liveEntry.projectId);
      if (
        !hiddenProjectIds.has(liveEntry.projectId) &&
        shouldRefreshRememberedProjectMetadata(rememberedEntry, liveEntry)
      ) {
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
      let bestTimestamp = getSpecRecencyTimestamp(best);

      for (const spec of remainingSpecs) {
        const timestamp = getSpecRecencyTimestamp(spec);
        if (timestamp > bestTimestamp) {
          best = spec;
          bestTimestamp = timestamp;
        }
      }

      return {
        name: best.name,
        displayName: best.displayName,
        createdAt: best.createdAt,
        lastModified: best.lastModified
      };
    } catch {
      return undefined;
    }
  }
}

function getSpecRecencyTimestamp(spec: { createdAt?: string | undefined; lastModified?: string | undefined }): number {
  return Date.parse(spec.lastModified || spec.createdAt || '') || 0;
}

function shouldRefreshRememberedProjectMetadata(
  rememberedEntry: RememberedProjectEntry | undefined,
  liveEntry: ProjectRegistryEntry
): boolean {
  if (!rememberedEntry) {
    return true;
  }

  if (rememberedEntry.workflowRootPath !== liveEntry.workflowRootPath) {
    return true;
  }

  if (rememberedEntry.projectName !== liveEntry.projectName) {
    return true;
  }

  if (rememberedEntry.source !== 'mcp') {
    return true;
  }

  const lastSeenAt = Date.parse(rememberedEntry.lastSeenAt);
  if (!lastSeenAt) {
    return true;
  }

  return Date.now() - lastSeenAt >= LIVE_PROJECT_METADATA_REFRESH_INTERVAL_MS;
}
