import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { registerTools, handleToolCall } from './tools/index.js';
import { registerPrompts, handlePromptList, handlePromptGet } from './prompts/index.js';
import { validateProjectPath } from './core/path-utils.js';
import { WorkspaceInitializer } from './core/workspace-initializer.js';
import { ProjectRegistry } from './core/project-registry.js';
import { DashboardSessionManager } from './core/dashboard-session.js';
import { discoverGitWorkspaces, GitWorkspaceDescriptor } from './core/git-utils.js';
import { buildWorktreeSyncPlan } from './core/worktree-sync.js';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

export class SpecWorkflowMCPServer {
  private static readonly WORKTREE_SYNC_INTERVAL_MS = 3000;

  private server: Server;
  private projectPath!: string;   // workflowRootPath for .spec-workflow operations
  private workspacePath!: string; // workspace/worktree path for identity in registry
  private projectRegistry: ProjectRegistry;
  private packageVersion: string;
  private lang?: string;
  private noSharedWorktreeSpecs: boolean = false;
  private registeredWorkspacePaths: Set<string> = new Set();
  private initializedWorkflowRoots: Set<string> = new Set();
  private worktreeSyncTimer?: NodeJS.Timeout;
  private worktreeSyncPromise?: Promise<void>;
  private isStopping: boolean = false;

  constructor() {
    // Get version from package.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    this.packageVersion = packageJson.version;

    // Get all registered tools and prompts
    const tools = registerTools();
    const prompts = registerPrompts();

    // Create tools capability object with each tool name
    const toolsCapability = tools.reduce((acc, tool) => {
      acc[tool.name] = {};
      return acc;
    }, {} as Record<string, {}>);

    this.server = new Server({
      name: 'spec-workflow-mcp',
      version: packageJson.version
    }, {
      capabilities: {
        tools: toolsCapability,
        prompts: {
          listChanged: true
        }
      }
    });

    this.projectRegistry = new ProjectRegistry();
  }

  async initialize(
    projectPath: string,
    workspacePath: string,
    options: {
      lang?: string;
      noSharedWorktreeSpecs?: boolean;
    } = {}
  ) {
    this.projectPath = projectPath;
    this.workspacePath = workspacePath;
    this.lang = options.lang;
    this.noSharedWorktreeSpecs = !!options.noSharedWorktreeSpecs;
    this.isStopping = false;

    try {
      await this.syncDiscoveredWorkspaces({ throwOnEmpty: true });
      this.startHotWorktreeDiscovery();

      // Try to get the dashboard URL from session manager
      let dashboardUrl: string | undefined = undefined;
      try {
        const sessionManager = new DashboardSessionManager();
        const dashboardSession = await sessionManager.getDashboardSession();
        if (dashboardSession) {
          dashboardUrl = dashboardSession.url;
        }
      } catch (error) {
        // Dashboard not running, continue without it
      }

      // Create context for tools
      const context = {
        projectPath: this.projectPath,
        workspacePath: this.workspacePath,
        noSharedWorktreeSpecs: !!options.noSharedWorktreeSpecs,
        dashboardUrl: dashboardUrl,
        lang: this.lang
      };

      // Register handlers
      this.setupHandlers(context);

      // Connect to stdio transport
      const transport = new StdioServerTransport();

      // Handle client disconnection - exit gracefully when transport closes
      transport.onclose = async () => {
        await this.stop();
        process.exit(0);
      };

      await this.server.connect(transport);

      // Monitor stdin for client disconnection (additional safety net)
      process.stdin.on('end', async () => {
        await this.stop();
        process.exit(0);
      });

      // Handle stdin errors
      process.stdin.on('error', async (error) => {
        console.error('stdin error:', error);
        await this.stop();
        process.exit(1);
      });

      // MCP server initialized successfully

    } catch (error) {
      throw error;
    }
  }

  private async validateDiscoveredProjects(): Promise<GitWorkspaceDescriptor[]> {
    const discoveredProjects = discoverGitWorkspaces(this.workspacePath, {
      noSharedWorktreeSpecs: this.noSharedWorktreeSpecs
    });
    const validProjects: GitWorkspaceDescriptor[] = [];

    for (const descriptor of discoveredProjects) {
      try {
        await validateProjectPath(descriptor.workspacePath);
        await validateProjectPath(descriptor.workflowRootPath);
        validProjects.push(descriptor);
      } catch (error: any) {
        console.error(
          `Skipping project registration for ${descriptor.workspacePath}: ${error.message}`
        );
      }
    }

    return validProjects;
  }

  private async initializeWorkflowRoots(projects: GitWorkspaceDescriptor[]): Promise<void> {
    const workflowRoots = Array.from(new Set(projects.map(project => project.workflowRootPath)));

    for (const workflowRootPath of workflowRoots) {
      if (this.initializedWorkflowRoots.has(workflowRootPath)) {
        continue;
      }

      const workspaceInitializer = new WorkspaceInitializer(workflowRootPath, this.packageVersion);
      await workspaceInitializer.initializeWorkspace();
      this.initializedWorkflowRoots.add(workflowRootPath);
    }
  }

  private async registerProject(descriptor: GitWorkspaceDescriptor): Promise<void> {
    const projectName = descriptor.isMainWorkspace
      ? descriptor.repoName
      : `${descriptor.repoName} · ${basename(descriptor.workspacePath)}`;
    const projectId = await this.projectRegistry.registerProject(descriptor.workspacePath, process.pid, {
      workflowRootPath: descriptor.workflowRootPath,
      projectName
    });
    this.registeredWorkspacePaths.add(descriptor.workspacePath);
    console.error(`Project registered: ${projectId} (${projectName})`);
  }

  private async unregisterProject(workspacePath: string): Promise<void> {
    await this.projectRegistry.unregisterProject(workspacePath, process.pid);
    this.registeredWorkspacePaths.delete(workspacePath);
    console.error(`Project unregistered: ${workspacePath}`);
  }

  private async performWorktreeSync(options: { throwOnEmpty?: boolean } = {}): Promise<void> {
    if (this.isStopping) {
      return;
    }

    const validProjects = await this.validateDiscoveredProjects();
    if (validProjects.length === 0) {
      if (options.throwOnEmpty) {
        throw new Error('No valid workspace paths found for MCP registration');
      }
      return;
    }

    await this.initializeWorkflowRoots(validProjects);

    const syncPlan = buildWorktreeSyncPlan(this.registeredWorkspacePaths, validProjects);
    for (const descriptor of syncPlan.addedProjects) {
      if (this.isStopping) {
        return;
      }
      await this.registerProject(descriptor);
    }

    for (const workspacePath of syncPlan.removedWorkspacePaths) {
      if (this.isStopping) {
        return;
      }
      await this.unregisterProject(workspacePath);
    }
  }

  private async syncDiscoveredWorkspaces(options: { throwOnEmpty?: boolean } = {}): Promise<void> {
    if (this.worktreeSyncPromise) {
      return this.worktreeSyncPromise;
    }

    const syncPromise = this.performWorktreeSync(options).finally(() => {
      if (this.worktreeSyncPromise === syncPromise) {
        this.worktreeSyncPromise = undefined;
      }
    });
    this.worktreeSyncPromise = syncPromise;
    return syncPromise;
  }

  private startHotWorktreeDiscovery(): void {
    if (this.worktreeSyncTimer) {
      clearInterval(this.worktreeSyncTimer);
    }

    this.worktreeSyncTimer = setInterval(() => {
      void this.syncDiscoveredWorkspaces().catch((error: any) => {
        console.error(`Worktree discovery sync failed: ${error.message}`);
      });
    }, SpecWorkflowMCPServer.WORKTREE_SYNC_INTERVAL_MS);
    this.worktreeSyncTimer.unref();
  }

  private setupHandlers(context: any) {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: registerTools()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await handleToolCall(request.params.name, request.params.arguments || {}, context);
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        return await handlePromptList();
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        return await handlePromptGet(
          request.params.name,
          request.params.arguments || {},
          context
        );
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });
  }

  /**
   * Check if running in Docker mode (path translation enabled)
   * When in Docker, we can't verify host PIDs and want projects to persist
   */
  private isDockerMode(): boolean {
    const hostPrefix = process.env.SPEC_WORKFLOW_HOST_PATH_PREFIX;
    const containerPrefix = process.env.SPEC_WORKFLOW_CONTAINER_PATH_PREFIX;
    return !!(hostPrefix && containerPrefix);
  }

  async stop() {
    try {
      this.isStopping = true;
      if (this.worktreeSyncTimer) {
        clearInterval(this.worktreeSyncTimer);
        this.worktreeSyncTimer = undefined;
      }
      if (this.worktreeSyncPromise) {
        await this.worktreeSyncPromise.catch(() => {});
      }

      // Only unregister when NOT in Docker mode
      // In Docker, projects should persist across sessions since we can't verify host PIDs
      if (!this.isDockerMode()) {
        try {
          const workspacePaths = this.registeredWorkspacePaths.size > 0
            ? Array.from(this.registeredWorkspacePaths)
            : [this.workspacePath];

          for (const workspacePath of workspacePaths) {
            await this.projectRegistry.unregisterProject(workspacePath, process.pid);
          }
          this.registeredWorkspacePaths.clear();
          console.error('Project instance unregistered from global registry');
        } catch (error) {
          // Ignore errors during cleanup
        }
      } else {
        console.error('Docker mode: skipping project unregistration (projects persist across sessions)');
      }

      // Stop MCP server
      await this.server.close();
    } catch (error) {
      console.error('Error during shutdown:', error);
      // Continue with shutdown even if there are errors
    }
  }
}
