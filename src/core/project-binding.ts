import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { basename } from 'path';
import { fileURLToPath } from 'url';
import {
  BoundProject,
  BoundProjectSource,
  StartupBinding
} from '../types.js';
import { discoverGitWorkspaces, resolveGitRoot, resolveGitWorkspaceRoot } from './git-utils.js';
import { PathUtils, validateProjectPath } from './path-utils.js';
import { ProjectRegistry } from './project-registry.js';
import { RememberedProjectsStore } from './remembered-projects.js';
import { WorkspaceInitializer } from './workspace-initializer.js';

const NO_ROOTS_ERROR =
  'Project binding could not be resolved: no startup path is configured and the MCP client did not provide exactly one filesystem root. Pass projectPath explicitly.';
const MULTIPLE_ROOTS_ERROR =
  'Project binding is ambiguous: no startup path is configured and the MCP client provided multiple filesystem roots. Pass projectPath explicitly.';

export interface ProjectBindingServiceOptions {
  server: Server;
  projectRegistry: ProjectRegistry;
  rememberedProjects: RememberedProjectsStore;
  packageVersion: string;
  noSharedWorktreeSpecs: boolean;
  startupBinding?: StartupBinding;
  registryPid?: number;
  registryInstanceId?: string;
}

export function createStartupBinding(
  requestedPath: string,
  noSharedWorktreeSpecs: boolean
): StartupBinding {
  const workspacePath = resolveGitWorkspaceRoot(requestedPath);
  const workflowRootPath = noSharedWorktreeSpecs
    ? workspacePath
    : resolveGitRoot(workspacePath);

  return {
    requestedPath,
    workspacePath,
    workflowRootPath
  };
}

export class ProjectBindingService {
  private readonly server: Server;
  private readonly projectRegistry: ProjectRegistry;
  private readonly rememberedProjects: RememberedProjectsStore;
  private readonly packageVersion: string;
  private readonly noSharedWorktreeSpecs: boolean;
  private readonly startupBinding?: StartupBinding;
  private readonly registryPid: number;
  private readonly registryInstanceId?: string;
  private readonly initializedWorkflowRoots = new Set<string>();
  private readonly registeredWorkspacePaths = new Set<string>();
  private clientRootPaths?: string[];
  private refreshRootsPromise?: Promise<string[]>;

  constructor(options: ProjectBindingServiceOptions) {
    this.server = options.server;
    this.projectRegistry = options.projectRegistry;
    this.rememberedProjects = options.rememberedProjects;
    this.packageVersion = options.packageVersion;
    this.noSharedWorktreeSpecs = options.noSharedWorktreeSpecs;
    this.startupBinding = options.startupBinding;
    this.registryPid = options.registryPid ?? process.pid;
    this.registryInstanceId = options.registryInstanceId;
  }

  getStartupBinding(): StartupBinding | undefined {
    return this.startupBinding;
  }

  getRegisteredWorkspacePaths(): string[] {
    return Array.from(this.registeredWorkspacePaths);
  }

  async refreshClientRoots(): Promise<string[]> {
    if (this.refreshRootsPromise) {
      return this.refreshRootsPromise;
    }

    this.refreshRootsPromise = this.loadClientRootPaths().finally(() => {
      this.refreshRootsPromise = undefined;
    });

    return this.refreshRootsPromise;
  }

  async resolveBoundProject(projectPath?: string): Promise<BoundProject> {
    const selectedProject = await this.selectRequestedProjectPath(projectPath);
    const requestedPath = await validateProjectPath(selectedProject.path);
    const workspacePath = await validateProjectPath(resolveGitWorkspaceRoot(requestedPath));
    const workflowRootCandidate = this.noSharedWorktreeSpecs
      ? workspacePath
      : resolveGitRoot(workspacePath);
    const workflowRootPath = await validateProjectPath(workflowRootCandidate);

    await this.ensureProjectFamilyRegistered(workspacePath);

    return {
      requestedPath,
      workspacePath,
      workflowRootPath,
      translatedWorkspacePath: PathUtils.translatePath(workspacePath),
      translatedWorkflowRootPath: PathUtils.translatePath(workflowRootPath),
      noSharedWorktreeSpecs: this.noSharedWorktreeSpecs,
      source: selectedProject.source
    };
  }

  private async selectRequestedProjectPath(
    explicitProjectPath?: string
  ): Promise<{ path: string; source: BoundProjectSource }> {
    if (explicitProjectPath) {
      return {
        path: explicitProjectPath,
        source: 'explicit-arg'
      };
    }

    if (this.startupBinding) {
      return {
        path: this.startupBinding.requestedPath,
        source: 'startup-binding'
      };
    }

    const rootPaths = await this.getClientRootPaths();
    if (rootPaths.length === 0) {
      throw new Error(NO_ROOTS_ERROR);
    }
    if (rootPaths.length > 1) {
      throw new Error(MULTIPLE_ROOTS_ERROR);
    }

    return {
      path: rootPaths[0],
      source: 'client-root'
    };
  }

  private async getClientRootPaths(): Promise<string[]> {
    if (this.clientRootPaths) {
      return this.clientRootPaths;
    }

    return this.refreshClientRoots();
  }

  private async loadClientRootPaths(): Promise<string[]> {
    try {
      const result = await this.server.listRoots();
      const fileRootPaths = result.roots
        .map(root => this.rootUriToPath(root.uri))
        .filter((pathValue): pathValue is string => !!pathValue);

      this.clientRootPaths = Array.from(new Set(fileRootPaths));
      return this.clientRootPaths;
    } catch {
      this.clientRootPaths = [];
      return this.clientRootPaths;
    }
  }

  private rootUriToPath(uri: string): string | undefined {
    if (!uri.startsWith('file://')) {
      return undefined;
    }

    try {
      return fileURLToPath(uri);
    } catch {
      return undefined;
    }
  }

  private async ensureProjectFamilyRegistered(workspacePath: string): Promise<void> {
    const discoveredProjects = discoverGitWorkspaces(workspacePath, {
      noSharedWorktreeSpecs: this.noSharedWorktreeSpecs
    });

    for (const descriptor of discoveredProjects) {
      const validatedWorkspacePath = await this.tryValidateProjectPath(descriptor.workspacePath);
      const validatedWorkflowRootPath = await this.tryValidateProjectPath(descriptor.workflowRootPath);

      if (!validatedWorkspacePath || !validatedWorkflowRootPath) {
        continue;
      }

      if (!this.initializedWorkflowRoots.has(validatedWorkflowRootPath)) {
        const workspaceInitializer = new WorkspaceInitializer(validatedWorkflowRootPath, this.packageVersion);
        await workspaceInitializer.initializeWorkspace();
        this.initializedWorkflowRoots.add(validatedWorkflowRootPath);
      }

      if (this.registeredWorkspacePaths.has(validatedWorkspacePath)) {
        continue;
      }

      const projectName = descriptor.isMainWorkspace
        ? descriptor.repoName
        : `${descriptor.repoName} · ${basename(validatedWorkspacePath)}`;

      await this.rememberedProjects.upsertProject(validatedWorkspacePath, {
        workflowRootPath: validatedWorkflowRootPath,
        projectName,
        source: 'mcp'
      });

      const projectId = await this.projectRegistry.registerProject(validatedWorkspacePath, this.registryPid, {
        instanceId: this.registryInstanceId,
        workflowRootPath: validatedWorkflowRootPath,
        projectName
      });

      this.registeredWorkspacePaths.add(validatedWorkspacePath);
      console.error(`Project registered: ${projectId} (${projectName})`);
    }
  }

  private async tryValidateProjectPath(projectPath: string): Promise<string | undefined> {
    try {
      return await validateProjectPath(projectPath);
    } catch (error: any) {
      console.error(`Skipping project registration for ${projectPath}: ${error.message}`);
      return undefined;
    }
  }
}

export function getProjectBindingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
