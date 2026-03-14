// @vitest-environment node

import type { Socket } from 'net';
import { connectToDesktopBridge } from './bridge-connection.js';
import { MCP_BRIDGE_PROTOCOL, type McpBridgeEndpoint, type McpBridgeHandshake } from '../shared/mcp-bridge.js';

describe('connectToDesktopBridge', () => {
  it('launches the desktop app once and retries until an endpoint becomes reachable', async () => {
    const endpoint: McpBridgeEndpoint = {
      protocol: MCP_BRIDGE_PROTOCOL,
      host: '127.0.0.1',
      port: 49152,
      token: 'token-1',
      pid: 1234,
      updatedAt: new Date().toISOString()
    };
    const handshake: McpBridgeHandshake = {
      protocol: MCP_BRIDGE_PROTOCOL,
      token: '',
      sessionId: 'bridge-session-a',
      noSharedWorktreeSpecs: false
    };
    const fakeSocket = {} as Socket;
    const launchDesktopApp = vi.fn(async () => true);
    const connect = vi.fn(async () => fakeSocket);
    const loadEndpoint = vi.fn(async () => (
      loadEndpoint.mock.calls.length >= 2 ? endpoint : null
    ));
    let nowValue = 0;

    const connectedSocket = await connectToDesktopBridge({
      storageRoot: '/tmp/spec-workflow-desktop',
      handshake,
      timeoutMs: 1000,
      retryDelayMs: 100
    }, {
      connect,
      launchDesktopApp,
      loadEndpoint,
      sleep: async (ms) => {
        nowValue += ms;
      },
      now: () => nowValue
    });

    expect(connectedSocket).toBe(fakeSocket);
    expect(launchDesktopApp).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(endpoint, handshake);
  });

  it('surfaces the latest bridge connection error after timeout', async () => {
    const handshake: McpBridgeHandshake = {
      protocol: MCP_BRIDGE_PROTOCOL,
      token: '',
      sessionId: 'bridge-session-b',
      noSharedWorktreeSpecs: true
    };
    let nowValue = 0;

    await expect(connectToDesktopBridge({
      storageRoot: '/tmp/spec-workflow-desktop',
      handshake,
      timeoutMs: 300,
      retryDelayMs: 100,
      launchDesktop: false
    }, {
      loadEndpoint: async () => ({
        protocol: MCP_BRIDGE_PROTOCOL,
        host: '127.0.0.1',
        port: 49153,
        token: 'token-2',
        pid: 4321,
        updatedAt: new Date().toISOString()
      }),
      connect: async () => {
        throw new Error('connection refused');
      },
      sleep: async (ms) => {
        nowValue += ms;
      },
      now: () => nowValue
    })).rejects.toThrow('connection refused');
  });
});
