import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import net from 'net';
import { join } from 'path';
import { tmpdir } from 'os';
import { MultiProjectDashboardServer } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to get free port'));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
    server.on('error', reject);
  });
}

describe('MultiProjectDashboardServer removed legacy routes', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let realFetch: typeof fetch;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-removed-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    realFetch = globalThis.fetch;

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({})
      }))
    );
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('keeps removed changelog routes unavailable and treats snapshot as an invalid approval action', async () => {
    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    const removedRoutes = [
      { method: 'GET', path: '/api/changelog/2.2.6' },
      { method: 'GET', path: '/api/projects/demo/changelog/2.2.6' },
    ] as const;

    for (const route of removedRoutes) {
      const response = await realFetch(`http://127.0.0.1:${port}${route.path}`, { method: route.method });
      const body = await response.text();

      expect(response.status, `${route.method} ${route.path}`).toBe(404);
      expect(body, `${route.method} ${route.path}`).toContain(`Route ${route.method}:${route.path} not found`);
      expect(body, `${route.method} ${route.path}`).not.toContain('Project not found');
    }

    const snapshotResponse = await realFetch(`http://127.0.0.1:${port}/api/projects/demo/approvals/approval-1/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const snapshotBody = await snapshotResponse.text();

    expect(snapshotResponse.status).toBe(400);
    expect(snapshotBody).toContain('Invalid action');
    expect(snapshotBody).not.toContain('Project not found');
  });
});
