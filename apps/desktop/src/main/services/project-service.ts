import { access } from 'fs/promises';
import { join } from 'path';
import { SpecParser, type ParsedSpec } from '../../../../../src/core/parser.js';
import {
  ProjectActivityService,
  type ProjectActivitySummary
} from '../../../../../src/core/project-activity.js';
import {
  getCurrentGitBranch,
  resolveGitRoot
} from '../../../../../src/core/git-utils.js';
import { PathUtils } from '../../../../../src/core/path-utils.js';
import {
  generateProjectDisplayName,
  generateProjectId
} from '../../../../../src/core/project-metadata.js';
import { DesktopProjectStore, type DesktopStoredProject } from './project-store.js';

export interface DesktopProjectLatestSpec {
  readonly name: string;
  readonly displayName: string;
  readonly createdAt: string;
  readonly lastModified?: string | undefined;
}

export interface DesktopProjectSummaryRecord {
  readonly projectId: string;
  readonly projectName: string;
  readonly workspacePath: string;
  readonly workflowRootPath: string;
  readonly addedAt: string;
  readonly gitBranch?: string | undefined;
  readonly latestSpec?: DesktopProjectLatestSpec | undefined;
  readonly pendingApprovalCount: number;
  readonly latestImplementation?: ProjectActivitySummary['latestImplementation'];
}

export class DesktopProjectService {
  private readonly projectStore: DesktopProjectStore;
  private readonly projectActivity: ProjectActivityService;

  constructor(storageRoot: string) {
    this.projectStore = new DesktopProjectStore(storageRoot);
    this.projectActivity = new ProjectActivityService();
  }

  async getProjects(): Promise<DesktopProjectSummaryRecord[]> {
    const storedProjects = await this.projectStore.getProjects();
    const projects = await Promise.all(storedProjects.map((project) => this.toSummary(project)));

    return projects.sort((left, right) => left.projectName.localeCompare(right.projectName));
  }

  async getProjectById(projectId: string): Promise<DesktopProjectSummaryRecord | null> {
    const storedProject = await this.projectStore.getProjectById(projectId);
    return storedProject ? this.toSummary(storedProject) : null;
  }

  async rememberProjectPath(projectPath: string): Promise<DesktopProjectSummaryRecord> {
    const storedProject = await this.projectStore.addProject(projectPath);
    return this.toSummary(storedProject);
  }

  async forgetProject(projectId: string): Promise<void> {
    await this.projectStore.removeProject(projectId);
  }

  getStorePath(): string {
    return this.projectStore.getStorePath();
  }

  private async toSummary(project: DesktopStoredProject): Promise<DesktopProjectSummaryRecord> {
    const workflowRootPath = await resolveWorkflowRootPath(project.workspacePath);
    const translatedWorkspacePath = PathUtils.translatePath(project.workspacePath);
    const translatedWorkflowRootPath = PathUtils.translatePath(workflowRootPath);
    const [latestSpec, activity] = await Promise.all([
      this.computeLatestSpec(translatedWorkflowRootPath),
      this.getProjectActivitySafe({
        translatedWorkflowRootPath,
        translatedWorkspacePath
      })
    ]);

    return {
      projectId: project.projectId || generateProjectId(project.workspacePath),
      projectName: generateProjectDisplayName(project.workspacePath, workflowRootPath),
      workspacePath: project.workspacePath,
      workflowRootPath,
      addedAt: project.addedAt,
      gitBranch: getCurrentGitBranch(translatedWorkspacePath),
      latestSpec,
      pendingApprovalCount: activity.pendingApprovalCount,
      latestImplementation: activity.latestImplementation
    };
  }

  private async computeLatestSpec(
    translatedWorkflowRootPath: string
  ): Promise<DesktopProjectLatestSpec | undefined> {
    try {
      const parser = new SpecParser(translatedWorkflowRootPath);
      const specs = await parser.getAllSpecs();
      const [firstSpec, ...remainingSpecs] = specs;
      if (!firstSpec) {
        return undefined;
      }

      let bestSpec: ParsedSpec = firstSpec;
      let bestTimestamp = getSpecRecencyTimestamp(bestSpec);

      for (const spec of remainingSpecs) {
        const timestamp = getSpecRecencyTimestamp(spec);
        if (timestamp > bestTimestamp) {
          bestSpec = spec;
          bestTimestamp = timestamp;
        }
      }

      return {
        name: bestSpec.name,
        displayName: bestSpec.displayName,
        createdAt: bestSpec.createdAt,
        lastModified: bestSpec.lastModified
      };
    } catch {
      return undefined;
    }
  }

  private async getProjectActivitySafe(paths: {
    translatedWorkflowRootPath: string;
    translatedWorkspacePath: string;
  }): Promise<ProjectActivitySummary> {
    try {
      return await this.projectActivity.getProjectActivity(paths);
    } catch {
      return {
        pendingApprovalCount: 0
      };
    }
  }
}

async function resolveWorkflowRootPath(workspacePath: string): Promise<string> {
  const localWorkflowRootPath = join(workspacePath, '.spec-workflow');

  try {
    await access(localWorkflowRootPath);
    return workspacePath;
  } catch {
    return resolveGitRoot(workspacePath);
  }
}

function getSpecRecencyTimestamp(spec: {
  readonly createdAt?: string | undefined;
  readonly lastModified?: string | undefined;
}): number {
  return Date.parse(spec.lastModified || spec.createdAt || '') || 0;
}
