#!/usr/bin/env node

import { SpecWorkflowMCPServer } from './server.js';
import { MultiProjectDashboardServer } from './dashboard/multi-server.js';
import { DashboardSessionManager } from './core/dashboard-session.js';
import { DEFAULT_DASHBOARD_PORT } from './core/security-utils.js';
import { createStartupBinding } from './core/project-binding.js';
import { homedir } from 'os';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { realpathSync } from 'fs';
import { StartupBinding } from './types.js';

function showHelp() {
  const defaultDashboardUrl = `http://localhost:${DEFAULT_DASHBOARD_PORT}`;
  console.error(`
Spec Workflow MCP Server - A Model Context Protocol server for spec-driven development

USAGE:
  spec-workflow-mcp [path] [options]

ARGUMENTS:
  path                    Optional startup project binding
                         Supports ~ for home directory

OPTIONS:
  --help                  Show this help message
  --dashboard             Run dashboard-only mode (no MCP server)
  --port <number>         Specify dashboard port (1024-65535)
                         Default: ${DEFAULT_DASHBOARD_PORT}
                         Only use if port ${DEFAULT_DASHBOARD_PORT} is unavailable
  --no-open               Don't automatically open browser when starting dashboard
                         Useful in restricted environments where browser launch is blocked
  --no-shared-worktree-specs
                         Disable shared .spec-workflow in git worktrees
                         Use workspace-local .spec-workflow instead of main repo

IMPORTANT:
  Only ONE dashboard instance runs at a time. All MCP servers connect to the
  same dashboard. The dashboard runs on port ${DEFAULT_DASHBOARD_PORT} by default.

MODES OF OPERATION:

1. MCP Server Only (default):
   spec-workflow-mcp
   spec-workflow-mcp ~/my-project

   Starts MCP server without dashboard. Without a path, the server runs in
   project-agnostic mode and resolves the project per request.

2. Dashboard Only Mode:
   spec-workflow-mcp --dashboard
   spec-workflow-mcp --dashboard --port 8080
   spec-workflow-mcp --dashboard --no-open

   Runs only the legacy web dashboard without MCP server
   (default port: ${DEFAULT_DASHBOARD_PORT}).
   Projects appear in the dashboard as live MCP sessions register or remembered
   workspaces are restored.
   Prefer the Electron desktop shell for the primary local workflow.
   Use --no-open to prevent automatic browser launch (useful in restricted environments).

EXAMPLES:
  # Start MCP server in project-agnostic mode
  spec-workflow-mcp

  # Start MCP server with a startup project binding
  spec-workflow-mcp ~/projects/my-app

  # Run the legacy dashboard (default port ${DEFAULT_DASHBOARD_PORT})
  spec-workflow-mcp --dashboard

  # Run dashboard on custom port (if ${DEFAULT_DASHBOARD_PORT} is unavailable)
  spec-workflow-mcp --dashboard --port 8080

TYPICAL WORKFLOW:
  1. Use your MCP client with spec-workflow in project-agnostic mode:
     spec-workflow-mcp

  2. Optionally open the legacy dashboard when you need browser-based
     compatibility or debugging:
     spec-workflow-mcp --dashboard

  3. For the preferred local experience, use the Electron desktop shell from
     this repository instead of treating the browser dashboard as the primary UI.

  The legacy dashboard, when started, is available at ${defaultDashboardUrl}

PARAMETER FORMATS:
  --port 3456             Space-separated format
  --port=3456             Equals format

For more information, visit: https://github.com/sc0rch/spec-workflow-mcp
`);
}

function expandTildePath(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

export function parseArguments(args: string[]): {
  startupBinding?: StartupBinding;
  isDashboardMode: boolean;
  noSharedWorktreeSpecs: boolean;
  port?: number;
  lang?: string;
  noOpen?: boolean;
} {
  const isDashboardMode = args.includes('--dashboard');
  const noOpen = args.includes('--no-open');
  const noSharedWorktreeSpecs = args.includes('--no-shared-worktree-specs');
  let customPort: number | undefined;

  // Check for invalid flags
  const validFlags = ['--dashboard', '--port', '--help', '-h', '--no-open', '--no-shared-worktree-specs'];
  for (const arg of args) {
    if (arg.startsWith('--') && !arg.includes('=')) {
      if (!validFlags.includes(arg)) {
        throw new Error(`Unknown option: ${arg}\nUse --help to see available options.`);
      }
    } else if (arg.startsWith('--') && arg.includes('=')) {
      const flagName = arg.split('=')[0];
      if (!validFlags.includes(flagName)) {
        throw new Error(`Unknown option: ${flagName}\nUse --help to see available options.`);
      }
    }
  }

  // Parse --port parameter (supports --port 3000 and --port=3000 formats)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--port=')) {
      // Handle --port=3000 format
      const portStr = arg.split('=')[1];
      if (portStr) {
        const parsed = parseInt(portStr, 10);
        if (isNaN(parsed)) {
          throw new Error(`Invalid port number: ${portStr}. Port must be a number.`);
        }
        if (parsed < 1024 || parsed > 65535) {
          throw new Error(`Port ${parsed} is out of range. Port must be between 1024 and 65535.`);
        }
        customPort = parsed;
      } else {
        throw new Error('--port parameter requires a value (e.g., --port=3000)');
      }
    } else if (arg === '--port' && i + 1 < args.length) {
      // Handle --port 3000 format
      const portStr = args[i + 1];
      const parsed = parseInt(portStr, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid port number: ${portStr}. Port must be a number.`);
      }
      if (parsed < 1024 || parsed > 65535) {
        throw new Error(`Port ${parsed} is out of range. Port must be between 1024 and 65535.`);
      }
      customPort = parsed;
      i++; // Skip the next argument as it's the port value
    } else if (arg === '--port') {
      throw new Error('--port parameter requires a value (e.g., --port 3000)');
    }
  }

  // Get project path (filter out flags and their values)
  const filteredArgs = args.filter((arg, index) => {
    if (arg === '--dashboard') return false;
    if (arg.startsWith('--port=')) return false;
    if (arg === '--port') return false;
    if (arg === '--no-open') return false;
    if (arg === '--no-shared-worktree-specs') return false;
    // Check if this arg is a value following --port
    if (index > 0 && args[index - 1] === '--port') return false;
    return true;
  });

  const rawProjectPath = filteredArgs[0];
  const startupBinding = rawProjectPath
    ? createStartupBinding(expandTildePath(rawProjectPath), noSharedWorktreeSpecs)
    : undefined;

  return {
    startupBinding,
    isDashboardMode,
    noSharedWorktreeSpecs,
    port: customPort,
    lang: undefined,
    noOpen
  };
}

async function main() {
  try {
    const args = process.argv.slice(2);

    // Check for help flag
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      process.exit(0);
    }

    // Parse command-line arguments
    const cliArgs = parseArguments(args);
    const startupBinding = cliArgs.startupBinding;
    const noSharedWorktreeSpecs = cliArgs.noSharedWorktreeSpecs;

    // Log worktree details when workspace and shared workflow roots differ
    if (startupBinding && startupBinding.workspacePath !== startupBinding.workflowRootPath) {
      console.error('Git worktree detected.');
      console.error(`workspacePath=${startupBinding.workspacePath}`);
      console.error(`workflowRootPath=${startupBinding.workflowRootPath}`);
    } else if (startupBinding && noSharedWorktreeSpecs) {
      console.error('Shared worktree specs disabled. Using workspace-local .spec-workflow.');
      console.error(`workspacePath=${startupBinding.workspacePath}`);
    }

    // Apply configuration from CLI args
    const isDashboardMode = cliArgs.isDashboardMode || false;
    const port = cliArgs.port;
    const lang = cliArgs.lang;
    const noOpen = cliArgs.noOpen || false;

    if (isDashboardMode) {
      // Check if a dashboard is already running (always check, regardless of port)
      const sessionManager = new DashboardSessionManager();
      const existingSession = await sessionManager.getDashboardSession();

      if (existingSession) {
        console.error(`Dashboard is already running at: ${existingSession.url}`);
        console.error('');
        console.error('You can:');
        console.error(`  1. Use the existing dashboard at: ${existingSession.url}`);
        console.error(`  2. Stop it first (Ctrl+C or kill ${existingSession.pid}), then start a new one`);
        console.error('');
        console.error('Note: Only one dashboard instance is needed for all your projects.');
        process.exit(1);
      }

      // Use specified port or default
      const dashboardPort = port || DEFAULT_DASHBOARD_PORT;

      // Dashboard only mode - use new multi-project dashboard
      console.error(`Starting Unified Multi-Project Dashboard`);
      if (port) {
        console.error(`Using custom port: ${port}`);
      } else {
        console.error(`Using default port: ${DEFAULT_DASHBOARD_PORT}`);
      }
      if (noOpen) {
        console.error(`Browser auto-open disabled (--no-open)`);
      }

      // Load configuration from environment variables
      let bindAddress: string | undefined;
      let allowExternalAccess: boolean | undefined;
      const securityConfig: any = {};
      
      // Network binding configuration
      if (process.env.SPEC_WORKFLOW_BIND_ADDRESS) {
        bindAddress = process.env.SPEC_WORKFLOW_BIND_ADDRESS;
      }
      
      // External access opt-in (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS !== undefined) {
        const allowExternal = process.env.SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS.toLowerCase();
        if (allowExternal === 'true') {
          allowExternalAccess = true;
        } else if (allowExternal === 'false') {
          allowExternalAccess = false;
        }
        // If invalid value, ignore and use default
      }
      
      // Security features configuration
      
      // Rate limiting toggle (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_RATE_LIMIT_ENABLED !== undefined) {
        const rateLimitEnabled = process.env.SPEC_WORKFLOW_RATE_LIMIT_ENABLED.toLowerCase();
        if (rateLimitEnabled === 'true') {
          securityConfig.rateLimitEnabled = true;
        } else if (rateLimitEnabled === 'false') {
          securityConfig.rateLimitEnabled = false;
        }
        // If invalid value, ignore and use default
      }
      
      // CORS toggle (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_CORS_ENABLED !== undefined) {
        const corsEnabled = process.env.SPEC_WORKFLOW_CORS_ENABLED.toLowerCase();
        if (corsEnabled === 'true') {
          securityConfig.corsEnabled = true;
        } else if (corsEnabled === 'false') {
          securityConfig.corsEnabled = false;
        }
        // If invalid value, ignore and use default
      }

      // Create dashboard server (network binding validation happens in constructor)
      let dashboardServer: MultiProjectDashboardServer;
      try {
        dashboardServer = new MultiProjectDashboardServer({
          autoOpen: !noOpen,
          port: dashboardPort,
          bindAddress,
          allowExternalAccess,
          security: securityConfig
        });
      } catch (error: any) {
        // Provide user-friendly error message with environment variable names
        if (error.message.includes('SECURITY ERROR') || error.message.includes('non-localhost')) {
          console.error('');
          console.error('❌ Security Configuration Error:');
          console.error(error.message);
          console.error('');
          console.error('To fix this, either:');
          console.error('  1. Use localhost binding (secure):');
          console.error('     export SPEC_WORKFLOW_BIND_ADDRESS=127.0.0.1');
          console.error('');
          console.error('  2. Explicitly allow external access (insecure):');
          console.error('     export SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS=true');
          console.error('');
          process.exit(1);
        }
        throw error; // Re-throw other errors
      }

      try {
        const dashboardUrl = await dashboardServer.start();
        console.error(`Dashboard started at: ${dashboardUrl}`);
        console.error('Projects appear as live MCP sessions register or remembered workspaces are restored.');
        console.error('Press Ctrl+C to stop the dashboard');
      } catch (error: any) {
        console.error(`Failed to start dashboard: ${error.message}`);
        process.exit(1);
      }

      // Handle graceful shutdown
      const shutdown = async () => {
        console.error('\nShutting down dashboard...');
        await dashboardServer.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

    } else {
      // MCP server mode
      if (startupBinding) {
        console.error(`Starting Spec Workflow MCP Server with startup binding: ${startupBinding.workflowRootPath}`);
        console.error(`Workspace path: ${startupBinding.workspacePath}`);
      } else {
        console.error('Starting Spec Workflow MCP Server in project-agnostic mode');
        console.error('Project binding will be resolved from projectPath, startup binding, or a single MCP client root.');
      }
      console.error(`Working directory: ${process.cwd()}`);

      const server = new SpecWorkflowMCPServer();

      await server.initialize(startupBinding, {
        lang,
        noSharedWorktreeSpecs
      });

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.message);

    // Provide additional context for common path-related issues
    if (error.message.includes('ENOENT') || error.message.includes('path') || error.message.includes('directory')) {
      console.error('\nProject path troubleshooting:');
      console.error('- Verify the project path exists and is accessible');
      console.error('- For Claude CLI users, use: claude mcp add spec-workflow npx -y @sc0rch/spec-workflow-mcp@latest');
      console.error('- Add -- /path/to/your/project only if you want a fixed startup binding');
      console.error('- Check that the path doesn\'t contain special characters that need escaping');
      console.error(`- Current working directory: ${process.cwd()}`);
    }

    process.exit(1);
  }
}

export function resolveEntrypoint(pathValue: string | undefined): string | undefined {
  if (!pathValue) return undefined;

  try {
    return realpathSync(pathValue);
  } catch {
    return resolve(pathValue);
  }
}

const entrypoint = resolveEntrypoint(process.argv[1]);
const currentFile = resolveEntrypoint(fileURLToPath(import.meta.url));

if (entrypoint && currentFile && currentFile === entrypoint) {
  main().catch(() => process.exit(1));
}
