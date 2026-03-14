import { join } from 'path';

export const MCP_BRIDGE_PROTOCOL = 'spec-workflow-desktop-bridge/v1';
export const MCP_BRIDGE_ENDPOINT_FILE = 'mcp-bridge.json';

export interface McpBridgeEndpoint {
  readonly protocol: typeof MCP_BRIDGE_PROTOCOL;
  readonly host: string;
  readonly port: number;
  readonly token: string;
  readonly pid: number;
  readonly updatedAt: string;
}

export interface McpBridgeHandshake {
  readonly protocol: typeof MCP_BRIDGE_PROTOCOL;
  readonly token: string;
  readonly sessionId: string;
  readonly startupProjectPath?: string | undefined;
  readonly noSharedWorktreeSpecs: boolean;
  readonly lang?: string | undefined;
}

export function getMcpBridgeEndpointPath(storageRoot: string): string {
  return join(storageRoot, MCP_BRIDGE_ENDPOINT_FILE);
}

export function isMcpBridgeEndpoint(value: unknown): value is McpBridgeEndpoint {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<McpBridgeEndpoint>;
  return candidate.protocol === MCP_BRIDGE_PROTOCOL
    && typeof candidate.host === 'string'
    && typeof candidate.port === 'number'
    && typeof candidate.token === 'string'
    && typeof candidate.pid === 'number'
    && typeof candidate.updatedAt === 'string';
}

export function isMcpBridgeHandshake(value: unknown): value is McpBridgeHandshake {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<McpBridgeHandshake>;
  return candidate.protocol === MCP_BRIDGE_PROTOCOL
    && typeof candidate.token === 'string'
    && typeof candidate.sessionId === 'string'
    && typeof candidate.noSharedWorktreeSpecs === 'boolean'
    && (candidate.startupProjectPath === undefined || typeof candidate.startupProjectPath === 'string')
    && (candidate.lang === undefined || typeof candidate.lang === 'string');
}
