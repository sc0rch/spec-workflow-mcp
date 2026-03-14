import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import net from 'net';
import { join } from 'path';
import { tmpdir } from 'os';
import WebSocket from 'ws';
import { MultiProjectDashboardServer } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
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

function waitForWsOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      ws.off('open', onOpen);
      ws.off('error', onError);
    };
    ws.on('open', onOpen);
    ws.on('error', onError);
  });
}

function waitForWsMessage(
  ws: WebSocket,
  predicate: (msg: any) => boolean,
  timeoutMs: number = 3000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for websocket message'));
    }, timeoutMs);

    const onMessage = (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        if (predicate(msg)) {
          cleanup();
          resolve(msg);
        }
      } catch {
        // ignore non-JSON
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
    };

    ws.on('message', onMessage);
  });
}

class WsJsonStream {
  private waiters: Array<{
    predicate: (msg: any) => boolean;
    resolve: (msg: any) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  }> = [];

  private messages: any[] = [];

  constructor(private ws: WebSocket) {
    ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        this.messages.push(msg);

        for (const waiter of [...this.waiters]) {
          if (waiter.predicate(msg)) {
            clearTimeout(waiter.timer);
            this.waiters = this.waiters.filter(w => w !== waiter);
            waiter.resolve(msg);
          }
        }
      } catch {
        // ignore
      }
    });
  }

  waitFor(predicate: (msg: any) => boolean, timeoutMs: number = 3000): Promise<any> {
    const existing = this.messages.find(predicate);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(w => w.resolve !== resolve);
        reject(new Error('Timed out waiting for websocket message'));
      }, timeoutMs);

      this.waiters.push({
        predicate,
        resolve,
        reject,
        timer,
      });
    });
  }
}

async function waitForProjectInList(realFetch: typeof fetch, port: number, projectId: string): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < 3000) {
    const response = await realFetch(`http://127.0.0.1:${port}/api/projects/list`);
    if (response.ok) {
      const projects = await response.json() as Array<{ projectId: string }>;
      if (projects.some(p => p.projectId === projectId)) {
        return;
      }
    }
    await new Promise(r => setTimeout(r, 50));
  }

  throw new Error(`Project ${projectId} not available in /api/projects/list`);
}

describe('MultiProjectDashboardServer spec archive websocket updates', () => {
  let tempDir: string;
  let workspacePath: string;
  let workflowRootPath: string;
  let server: MultiProjectDashboardServer | null = null;
  let projectId: string;
  let realFetch: typeof fetch;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-archive-ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workspacePath = join(tempDir, 'worktrees', 'wt-a');
    workflowRootPath = join(tempDir, 'repo-main');
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(workflowRootPath, { recursive: true });

    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    projectId = generateProjectId(workspacePath);
    realFetch = globalThis.fetch;

    const registry = new ProjectRegistry();
    await registry.registerProject(workspacePath, process.pid, { workflowRootPath });

    // Prevent network dependency in package version lookup.
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

  it('broadcasts spec-update after archiving a spec', async () => {
    const specName = 'test-spec';
    await fs.mkdir(join(workflowRootPath, '.spec-workflow', 'specs', specName), { recursive: true });
    await fs.writeFile(
      join(workflowRootPath, '.spec-workflow', 'specs', specName, 'requirements.md'),
      '# Requirements',
      'utf-8'
    );

    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    await waitForProjectInList(realFetch, port, projectId);

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?projectId=${encodeURIComponent(projectId)}`);
    const stream = new WsJsonStream(ws);
    await waitForWsOpen(ws);

    // Always expect the global projects list to arrive.
    await stream.waitFor((msg) => msg.type === 'projects-update');

    // Request initial state explicitly to avoid timing races with registry sync.
    ws.send(JSON.stringify({ type: 'subscribe', projectId }));

    const initial = await stream.waitFor((msg) => msg.type === 'initial' && msg.projectId === projectId, 5000);
    expect((initial.data?.specs || []).map((s: any) => s.name)).toContain(specName);

    const archiveResponse = await realFetch(
      `http://127.0.0.1:${port}/api/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(specName)}/archive`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }
    );
    expect(archiveResponse.status).toBe(200);

    const update = await stream.waitFor((msg) => msg.type === 'spec-update' && msg.projectId === projectId, 5000);

    const activeNames = (update.data?.specs || []).map((s: any) => s.name);
    const archivedNames = (update.data?.archivedSpecs || []).map((s: any) => s.name);

    expect(activeNames).not.toContain(specName);
    expect(archivedNames).toContain(specName);

    ws.close();
  });
});

