import { readFile } from 'fs/promises';
import { spawn } from 'child_process';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import net, { type Socket } from 'net';
import type { McpBridgeEndpoint, McpBridgeHandshake } from '../shared/mcp-bridge.js';
import { getMcpBridgeEndpointPath, isMcpBridgeEndpoint } from '../shared/mcp-bridge.js';

export interface BridgeConnectionOptions {
  readonly storageRoot: string;
  readonly handshake: McpBridgeHandshake;
  readonly timeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly launchDesktop?: boolean;
}

export interface BridgeConnectionDependencies {
  readonly connect?: (endpoint: McpBridgeEndpoint, handshake: McpBridgeHandshake) => Promise<Socket>;
  readonly launchDesktopApp?: () => Promise<boolean>;
  readonly loadEndpoint?: (storageRoot: string) => Promise<McpBridgeEndpoint | null>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRY_DELAY_MS = 250;

export async function connectToDesktopBridge(
  options: BridgeConnectionOptions,
  dependencies: BridgeConnectionDependencies = {}
): Promise<Socket> {
  const connect = dependencies.connect ?? defaultConnect;
  const loadEndpoint = dependencies.loadEndpoint ?? loadBridgeEndpoint;
  const launchDesktopApp = dependencies.launchDesktopApp ?? defaultLaunchDesktopApp;
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms)));
  const now = dependencies.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const deadline = now() + timeoutMs;
  let launchAttempted = false;
  let lastError: unknown;

  while (now() < deadline) {
    const endpoint = await loadEndpoint(options.storageRoot);

    if (endpoint) {
      try {
        return await connect(endpoint, options.handshake);
      } catch (error) {
        lastError = error;
      }
    }

    if (options.launchDesktop !== false && !launchAttempted) {
      launchAttempted = true;
      try {
        await launchDesktopApp();
      } catch (error) {
        lastError = error;
      }
    }

    await sleep(retryDelayMs);
  }

  throw new Error(createConnectionErrorMessage(lastError));
}

export async function loadBridgeEndpoint(storageRoot: string): Promise<McpBridgeEndpoint | null> {
  try {
    const raw = await readFile(getMcpBridgeEndpointPath(storageRoot), 'utf-8');
    const parsed = JSON.parse(raw);
    return isMcpBridgeEndpoint(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function defaultConnect(endpoint: McpBridgeEndpoint, handshake: McpBridgeHandshake): Promise<Socket> {
  const socket = await new Promise<Socket>((resolvePromise, reject) => {
    const nextSocket = net.createConnection(endpoint.port, endpoint.host);
    nextSocket.once('connect', () => resolvePromise(nextSocket));
    nextSocket.once('error', (error) => reject(error));
  });

  await new Promise<void>((resolvePromise, reject) => {
    const payload = `${JSON.stringify(handshake)}\n`;
    socket.write(payload, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise();
    });
  });

  return socket;
}

export async function defaultLaunchDesktopApp(): Promise<boolean> {
  const electronMainEntry = resolveElectronMainEntry();
  const electronCliPath = resolveElectronCliPath();

  const child = spawn(process.execPath, [electronCliPath, electronMainEntry], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      SPEC_WORKFLOW_DESKTOP_START_HIDDEN: '1'
    }
  });

  child.unref();
  return true;
}

function resolveElectronMainEntry(): string {
  const runtimeDir = dirname(fileURLToPath(import.meta.url));
  const distRoot = findAncestor(runtimeDir, 'dist');
  if (!distRoot) {
    throw new Error('Unable to resolve desktop dist directory for MCP bridge launch');
  }

  return join(distRoot, 'apps', 'desktop', 'src', 'main', 'index.js');
}

function resolveElectronCliPath(): string {
  const runtimeDir = dirname(fileURLToPath(import.meta.url));
  const distRoot = findAncestor(runtimeDir, 'dist');
  if (!distRoot) {
    throw new Error('Unable to resolve desktop dist directory for Electron launch');
  }

  const repositoryRoot = dirname(distRoot);
  return join(repositoryRoot, 'apps', 'desktop', 'node_modules', 'electron', 'cli.js');
}

function findAncestor(startPath: string, expectedBaseName: string): string | null {
  let currentPath = startPath;

  while (true) {
    if (basename(currentPath) === expectedBaseName) {
      return currentPath;
    }

    const parentPath = dirname(currentPath);
    if (parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

function createConnectionErrorMessage(lastError: unknown): string {
  if (lastError instanceof Error && lastError.message) {
    return `Unable to connect to Spec Workflow Desktop MCP bridge: ${lastError.message}`;
  }

  return 'Unable to connect to Spec Workflow Desktop MCP bridge';
}
