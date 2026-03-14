#!/usr/bin/env node

import { randomUUID } from 'crypto';
import { homedir } from 'os';
import { resolveDesktopStorageRoot, getDefaultDesktopStorageRoot } from '../main/storage-root.js';
import { connectToDesktopBridge, defaultConnect } from './bridge-connection.js';
import { MCP_BRIDGE_PROTOCOL, type McpBridgeHandshake } from '../shared/mcp-bridge.js';

function showHelp(): void {
  console.error(`
Spec Workflow Desktop Codex bridge

USAGE:
  spec-workflow-codex-bridge [path] [options]

OPTIONS:
  --help
  --no-shared-worktree-specs

NOTES:
  This bridge is spawned by Codex over stdio.
  It proxies MCP traffic to the Electron desktop app over a local socket.
  If the desktop app is not running yet, the bridge will try to start it hidden.
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const parsed = parseBridgeArguments(args);

  const handshake: McpBridgeHandshake = {
    protocol: MCP_BRIDGE_PROTOCOL,
    token: '',
    sessionId: randomUUID(),
    startupProjectPath: parsed.startupProjectPath,
    noSharedWorktreeSpecs: parsed.noSharedWorktreeSpecs
  };
  const storageRoot = resolveDesktopStorageRoot(getDefaultDesktopStorageRoot());
  const socket = await connectToDesktopBridge({
    storageRoot,
    handshake
  }, {
    connect: async (endpoint, handshakeTemplate) => {
      return defaultConnect(endpoint, {
        ...handshakeTemplate,
        token: endpoint.token
      });
    }
  });

  process.stdin.on('error', (error) => {
    console.error(`stdin error: ${error.message}`);
    socket.destroy();
    process.exit(1);
  });

  socket.on('error', (error) => {
    console.error(`MCP bridge connection error: ${error.message}`);
    process.exit(1);
  });

  socket.on('close', () => {
    process.exit(0);
  });

  process.stdin.pipe(socket);
  socket.pipe(process.stdout);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function parseBridgeArguments(args: string[]): {
  startupProjectPath?: string;
  noSharedWorktreeSpecs: boolean;
} {
  const noSharedWorktreeSpecs = args.includes('--no-shared-worktree-specs');
  const validFlags = new Set(['--help', '-h', '--no-shared-worktree-specs']);
  const positionalArgs: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('-')) {
      if (!validFlags.has(arg)) {
        throw new Error(`Unsupported bridge option: ${arg}`);
      }
      continue;
    }

    positionalArgs.push(expandTildePath(arg));
  }

  if (positionalArgs.length > 1) {
    throw new Error('The desktop Codex bridge accepts at most one startup project path.');
  }

  return {
    startupProjectPath: positionalArgs[0],
    noSharedWorktreeSpecs
  };
}

function expandTildePath(pathValue: string): string {
  if (pathValue === '~' || pathValue.startsWith('~/')) {
    return pathValue.replace('~', homedir());
  }

  return pathValue;
}
