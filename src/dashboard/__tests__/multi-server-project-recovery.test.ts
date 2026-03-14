import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import net from 'net';
import { join } from 'path';
import { MultiProjectDashboardServer } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { RememberedProjectsStore } from '../../core/remembered-projects.js';
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

async function waitForProjects(realFetch: typeof fetch, port: number, predicate: (projects: Array<any>) => boolean): Promise<Array<any>> {
  const start = Date.now();
  while (Date.now() - start < 3000) {
    const response = await realFetch(`http://127.0.0.1:${port}/api/projects/list`);
    if (response.ok) {
      const projects = await response.json() as Array<any>;
      if (predicate(projects)) {
        return projects;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  throw new Error('Timed out waiting for expected projects list');
}

describe('MultiProjectDashboardServer project recovery', () => {
  let tempDir: string;
  let workspacePath: string;
  let workflowRootPath: string;
  let server: MultiProjectDashboardServer | null = null;
  let realFetch: typeof fetch;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    const baseDir = join(process.cwd(), '..', '.tmp-dashboard-project-recovery');
    await fs.mkdir(baseDir, { recursive: true });
    tempDir = join(baseDir, `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workspacePath = join(tempDir, 'worktrees', 'wt-a');
    workflowRootPath = join(tempDir, 'repo-main');
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(workflowRootPath, { recursive: true });

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

  it('restores remembered projects when live registry is empty after stale cleanup', async () => {
    const rememberedProjects = new RememberedProjectsStore();
    await rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath,
      projectName: 'repo-main · wt-a',
      source: 'mcp'
    });

    const registry = new ProjectRegistry();
    await registry.registerProject(workspacePath, 999999, { workflowRootPath });

    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    const projects = await waitForProjects(realFetch, port, list =>
      list.some(project => project.projectId === generateProjectId(workspacePath))
    );
    const project = projects.find(p => p.projectId === generateProjectId(workspacePath));

    expect(project).toBeTruthy();
    expect(project.instances).toEqual([]);
  });

  it('adds projects through the dashboard without creating fake live instances', async () => {
    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    const addResponse = await realFetch(`http://127.0.0.1:${port}/api/projects/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: workspacePath })
    });

    expect(addResponse.status).toBe(200);

    const projects = await waitForProjects(realFetch, port, list =>
      list.some(project => project.projectId === generateProjectId(workspacePath))
    );
    const project = projects.find(p => p.projectId === generateProjectId(workspacePath));
    expect(project.instances).toEqual([]);

    const registry = new ProjectRegistry();
    const liveProjects = await registry.getAllProjects();
    expect(liveProjects).toHaveLength(0);

    const rememberedProjects = new RememberedProjectsStore();
    const knownProjects = await rememberedProjects.getAllProjects();
    expect(knownProjects).toHaveLength(1);
    expect(knownProjects[0].projectId).toBe(generateProjectId(workspacePath));
  });

  it('forgets remembered projects while keeping live instances visible until they disconnect', async () => {
    const rememberedProjects = new RememberedProjectsStore();
    await rememberedProjects.upsertProject(workspacePath, {
      workflowRootPath,
      projectName: 'repo-main · wt-a',
      source: 'manual'
    });

    const registry = new ProjectRegistry();
    await registry.registerProject(workspacePath, process.pid, { workflowRootPath });

    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    const deleteResponse = await realFetch(`http://127.0.0.1:${port}/api/projects/${encodeURIComponent(generateProjectId(workspacePath))}`, {
      method: 'DELETE'
    });
    expect(deleteResponse.status).toBe(200);

    const afterDelete = await waitForProjects(realFetch, port, list =>
      list.some(project => project.projectId === generateProjectId(workspacePath))
    );
    const liveProject = afterDelete.find(p => p.projectId === generateProjectId(workspacePath));
    expect(liveProject.instances.length).toBe(1);

    expect(await rememberedProjects.getAllProjects()).toHaveLength(0);

    await server.stop();
    server = null;

    const restartedPort = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port: restartedPort });
    await server.start();

    const afterRestart = await waitForProjects(realFetch, restartedPort, list =>
      list.some(project => project.projectId === generateProjectId(workspacePath))
    );
    expect(afterRestart).toHaveLength(1);
    expect(afterRestart[0].instances.length).toBe(1);

    await registry.unregisterProject(workspacePath, process.pid);

    const afterDisconnect = await waitForProjects(realFetch, restartedPort, list =>
      !list.some(project => project.projectId === generateProjectId(workspacePath))
    );
    expect(afterDisconnect).toEqual([]);
  });
});
