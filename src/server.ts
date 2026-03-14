import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  RootsListChangedNotificationSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { registerTools, handleToolCall } from './tools/index.js';
import { registerPrompts, handlePromptList, handlePromptGet } from './prompts/index.js';
import { ProjectRegistry } from './core/project-registry.js';
import { DashboardSessionManager } from './core/dashboard-session.js';
import { ProjectBindingService } from './core/project-binding.js';
import { RememberedProjectsStore } from './core/remembered-projects.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { StartupBinding, ToolContext } from './types.js';

export interface InitializeServerOptions {
  lang?: string;
  noSharedWorktreeSpecs?: boolean;
  transport?: Transport;
  manageProcessLifecycle?: boolean;
  registryPid?: number;
  registryInstanceId?: string;
}

export class SpecWorkflowMCPServer {
  private server: Server;
  private projectRegistry: ProjectRegistry;
  private rememberedProjects: RememberedProjectsStore;
  private projectBindingService?: ProjectBindingService;
  private packageVersion: string;
  private lang?: string;
  private noSharedWorktreeSpecs: boolean = false;
  private isStopping: boolean = false;
  private registryPid: number = process.pid;
  private registryInstanceId?: string;
  private readonly stdinEndHandler = async () => {
    if (this.isStopping) {
      return;
    }

    await this.stop();
    process.exit(0);
  };
  private readonly stdinErrorHandler = async (error: Error) => {
    if (this.isStopping) {
      return;
    }

    console.error('stdin error:', error);
    await this.stop();
    process.exit(1);
  };

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
    this.rememberedProjects = new RememberedProjectsStore();
  }

  async initialize(
    startupBinding: StartupBinding | undefined,
    options: InitializeServerOptions = {}
  ) {
    this.lang = options.lang;
    this.noSharedWorktreeSpecs = !!options.noSharedWorktreeSpecs;
    this.isStopping = false;
    this.registryPid = options.registryPid ?? process.pid;
    this.registryInstanceId = options.registryInstanceId;
    const transport = options.transport ?? new StdioServerTransport();
    const manageProcessLifecycle = options.manageProcessLifecycle ?? !options.transport;

    try {
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

      this.projectBindingService = new ProjectBindingService({
        server: this.server,
        projectRegistry: this.projectRegistry,
        rememberedProjects: this.rememberedProjects,
        packageVersion: this.packageVersion,
        noSharedWorktreeSpecs: this.noSharedWorktreeSpecs,
        startupBinding,
        registryPid: this.registryPid,
        registryInstanceId: this.registryInstanceId
      });

      const context: ToolContext = {
        startupBinding,
        noSharedWorktreeSpecs: !!options.noSharedWorktreeSpecs,
        dashboardUrl: dashboardUrl,
        lang: this.lang,
        resolveBoundProject: (projectPath?: string) => {
          if (!this.projectBindingService) {
            throw new Error('Project binding service is not initialized');
          }

          return this.projectBindingService.resolveBoundProject(projectPath);
        }
      };

      // Register handlers
      this.setupHandlers(context);

      transport.onclose = async () => {
        if (this.isStopping) {
          return;
        }

        await this.stop();
        if (manageProcessLifecycle) {
          process.exit(0);
        }
      };

      await this.server.connect(transport);
      await this.projectBindingService.refreshClientRoots();

      if (manageProcessLifecycle) {
        process.stdin.on('end', this.stdinEndHandler);
        process.stdin.on('error', this.stdinErrorHandler);
      }

      // MCP server initialized successfully

    } catch (error) {
      throw error;
    }
  }

  private setupHandlers(context: ToolContext) {
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

    this.server.setNotificationHandler(RootsListChangedNotificationSchema, async () => {
      try {
        await this.projectBindingService?.refreshClientRoots();
      } catch (error: any) {
        console.error(`Failed to refresh MCP roots: ${error.message}`);
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
      if (this.isStopping) {
        return;
      }

      this.isStopping = true;
      process.stdin.off('end', this.stdinEndHandler);
      process.stdin.off('error', this.stdinErrorHandler);

      // Only unregister when NOT in Docker mode
      // In Docker, projects should persist across sessions since we can't verify host PIDs
      if (!this.isDockerMode()) {
        try {
          const workspacePaths = this.projectBindingService?.getRegisteredWorkspacePaths() || [];

          for (const workspacePath of workspacePaths) {
            await this.projectRegistry.unregisterProject(workspacePath, this.registryPid, this.registryInstanceId);
          }
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
