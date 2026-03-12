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
import { discoverGitWorkspaces } from './core/git-utils.js';
import { readFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

export class SpecWorkflowMCPServer {
  private server: Server;
  private projectPath!: string;   // workflowRootPath for .spec-workflow operations
  private workspacePath!: string; // workspace/worktree path for identity in registry
  private projectRegistry: ProjectRegistry;
  private lang?: string;
  private registeredWorkspacePaths: Set<string> = new Set();

  constructor() {
    // Get version from package.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

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

    try {
      const discoveredProjects = discoverGitWorkspaces(this.workspacePath, {
        noSharedWorktreeSpecs: options.noSharedWorktreeSpecs
      });
      const validProjects = [];

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

      if (validProjects.length === 0) {
        throw new Error('No valid workspace paths found for MCP registration');
      }

      // Initialize every unique workflow root so templates exist regardless of
      // whether a project is the main repo or an isolated worktree.
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const packageJsonPath = join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const workflowRoots = Array.from(new Set(validProjects.map(project => project.workflowRootPath)));
      for (const workflowRootPath of workflowRoots) {
        const workspaceInitializer = new WorkspaceInitializer(workflowRootPath, packageJson.version);
        await workspaceInitializer.initializeWorkspace();
      }

      for (const descriptor of validProjects) {
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
