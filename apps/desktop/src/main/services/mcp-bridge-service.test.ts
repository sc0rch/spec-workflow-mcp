// @vitest-environment node

import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { createConnection, type Socket } from 'net';
import { once } from 'events';
import { McpBridgeService } from './mcp-bridge-service.js';
import { MCP_BRIDGE_PROTOCOL, type McpBridgeEndpoint } from '../../shared/mcp-bridge.js';

describe('McpBridgeService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'spec-workflow-mcp-bridge-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes an endpoint file and forwards accepted handshakes into MCP server initialization', async () => {
    const initialize = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    const bridge = new McpBridgeService({
      storageRoot: tempDir,
      createMcpServer: () => ({
        initialize,
        stop
      })
    });

    await bridge.start();
    const endpoint = await bridge.readEndpoint();

    expect(endpoint).toEqual(expect.objectContaining({
      protocol: MCP_BRIDGE_PROTOCOL,
      host: '127.0.0.1',
      pid: process.pid
    }));

    const clientSocket = await connectToEndpoint(endpoint);
    clientSocket.write(`${JSON.stringify({
      protocol: MCP_BRIDGE_PROTOCOL,
      token: endpoint?.token,
      sessionId: 'bridge-session-a',
      noSharedWorktreeSpecs: true
    })}\n`);

    await vi.waitFor(() => {
      expect(initialize).toHaveBeenCalledWith(undefined, expect.objectContaining({
        noSharedWorktreeSpecs: true,
        manageProcessLifecycle: false,
        registryInstanceId: 'bridge-session-a'
      }));
    });

    await bridge.stop();
    expect(stop).toHaveBeenCalledTimes(1);

    await expect(readFile(bridge.getEndpointPath(), 'utf-8')).rejects.toThrow();
    clientSocket.destroy();
  });

  it('rejects invalid handshake tokens without creating an MCP session', async () => {
    const initialize = vi.fn(async () => undefined);
    const bridge = new McpBridgeService({
      storageRoot: tempDir,
      createMcpServer: () => ({
        initialize,
        stop: vi.fn(async () => undefined)
      })
    });

    await bridge.start();
    const endpoint = await bridge.readEndpoint();
    const clientSocket = await connectToEndpoint(endpoint);

    const closedPromise = once(clientSocket, 'close');
    clientSocket.write(`${JSON.stringify({
      protocol: MCP_BRIDGE_PROTOCOL,
      token: 'wrong-token',
      sessionId: 'bridge-session-b',
      noSharedWorktreeSpecs: false
    })}\n`);

    clientSocket.end();
    await closedPromise;
    expect(initialize).not.toHaveBeenCalled();

    await bridge.stop();
  });
});

async function connectToEndpoint(endpoint: McpBridgeEndpoint | null): Promise<Socket> {
  if (!endpoint) {
    throw new Error('Missing bridge endpoint');
  }

  return new Promise<Socket>((resolvePromise, reject) => {
    const socket = createConnection(endpoint.port, endpoint.host);
    socket.once('connect', () => resolvePromise(socket));
    socket.once('error', reject);
  });
}
