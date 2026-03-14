import { createServer, type Server as NetServer, type Socket } from 'net';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { dirname } from 'path';
import { createStartupBinding } from '../../../../../src/core/project-binding.js';
import { SpecWorkflowMCPServer } from '../../../../../src/server.js';
import {
  getMcpBridgeEndpointPath,
  isMcpBridgeEndpoint,
  isMcpBridgeHandshake,
  MCP_BRIDGE_PROTOCOL,
  type McpBridgeEndpoint,
  type McpBridgeHandshake
} from '../../shared/mcp-bridge.js';
import { SocketMcpTransport } from './socket-mcp-transport.js';

export interface McpBridgeServerLike {
  initialize: typeof SpecWorkflowMCPServer.prototype.initialize;
  stop: typeof SpecWorkflowMCPServer.prototype.stop;
}

export interface McpBridgeServiceOptions {
  readonly storageRoot: string;
  readonly createMcpServer?: () => McpBridgeServerLike;
}

interface AcceptedHandshake {
  readonly handshake: McpBridgeHandshake;
  readonly pendingData?: Buffer | undefined;
}

const BRIDGE_HOST = '127.0.0.1';
const HANDSHAKE_TIMEOUT_MS = 5000;

export class McpBridgeService {
  private readonly endpointPath: string;
  private readonly createMcpServer: () => McpBridgeServerLike;
  private server: NetServer | null = null;
  private endpoint: McpBridgeEndpoint | null = null;
  private readonly activeSessions = new Map<string, McpBridgeServerLike>();
  private readonly activeSockets = new Set<Socket>();

  constructor(options: McpBridgeServiceOptions) {
    this.endpointPath = getMcpBridgeEndpointPath(options.storageRoot);
    this.createMcpServer = options.createMcpServer ?? (() => new SpecWorkflowMCPServer());
  }

  async start(): Promise<void> {
    if (this.server) {
      return;
    }

    const token = randomUUID();
    this.server = createServer((socket) => {
      void this.handleConnection(socket);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(0, BRIDGE_HOST, () => {
        this.server?.off('error', reject);
        resolve();
      });
    });

    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve MCP bridge address');
    }

    this.endpoint = {
      protocol: MCP_BRIDGE_PROTOCOL,
      host: BRIDGE_HOST,
      port: address.port,
      token,
      pid: process.pid,
      updatedAt: new Date().toISOString()
    };

    await mkdir(dirname(this.endpointPath), { recursive: true });
    await writeFile(this.endpointPath, JSON.stringify(this.endpoint, null, 2), 'utf-8');
  }

  async stop(): Promise<void> {
    const activeSessions = Array.from(this.activeSessions.values());
    this.activeSessions.clear();
    const activeSockets = Array.from(this.activeSockets.values());
    this.activeSockets.clear();

    for (const socket of activeSockets) {
      socket.destroy();
    }

    await Promise.all(activeSessions.map(async (session) => {
      await session.stop();
    }));

    if (this.server) {
      const server = this.server;
      this.server = null;

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    this.endpoint = null;

    try {
      await rm(this.endpointPath, { force: true });
    } catch {
      // Ignore cleanup errors.
    }
  }

  getEndpointPath(): string {
    return this.endpointPath;
  }

  async readEndpoint(): Promise<McpBridgeEndpoint | null> {
    try {
      const raw = await readFile(this.endpointPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return isMcpBridgeEndpoint(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private async handleConnection(socket: Socket): Promise<void> {
    try {
      if (!this.endpoint) {
        socket.destroy(new Error('MCP bridge is not initialized'));
        return;
      }

      this.activeSockets.add(socket);
      const { handshake, pendingData } = await readHandshake(socket, this.endpoint.token);
      const startupBinding = handshake.startupProjectPath
        ? createStartupBinding(handshake.startupProjectPath, handshake.noSharedWorktreeSpecs)
        : undefined;
      const transport = new SocketMcpTransport(socket, pendingData);
      const session = this.createMcpServer();
      this.activeSessions.set(handshake.sessionId, session);

      socket.once('close', () => {
        this.activeSessions.delete(handshake.sessionId);
        this.activeSockets.delete(socket);
      });

      await session.initialize(startupBinding, {
        noSharedWorktreeSpecs: handshake.noSharedWorktreeSpecs,
        transport,
        manageProcessLifecycle: false,
        registryInstanceId: handshake.sessionId,
        ...(handshake.lang ? { lang: handshake.lang } : {})
      });
    } catch {
      this.activeSockets.delete(socket);
      socket.destroy();
    }
  }
}

async function readHandshake(socket: Socket, expectedToken: string): Promise<AcceptedHandshake> {
  return new Promise<AcceptedHandshake>((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for MCP bridge handshake'));
    }, HANDSHAKE_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };

    const acceptHandshake = (line: string, pendingData: Buffer | undefined) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(line);
      } catch {
        cleanup();
        reject(new Error('Received invalid MCP bridge handshake JSON'));
        return;
      }

      if (!isMcpBridgeHandshake(parsed)) {
        cleanup();
        reject(new Error('Received invalid MCP bridge handshake payload'));
        return;
      }

      if (parsed.token !== expectedToken) {
        cleanup();
        reject(new Error('Received invalid MCP bridge handshake token'));
        return;
      }

      cleanup();
      resolve({
        handshake: parsed,
        pendingData
      });
    };

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const separatorIndex = buffer.indexOf(0x0a);
      if (separatorIndex === -1) {
        return;
      }

      const lineBuffer = buffer.subarray(0, separatorIndex);
      const pendingData = buffer.subarray(separatorIndex + 1);
      const line = lineBuffer.toString('utf-8').trim();
      acceptHandshake(line, pendingData.length > 0 ? pendingData : undefined);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Socket closed before MCP bridge handshake completed'));
    };

    socket.on('data', onData);
    socket.on('error', onError);
    socket.on('close', onClose);
  });
}
