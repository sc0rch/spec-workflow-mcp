import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';
import { RememberedProjectsStore } from '../remembered-projects.js';

describe('RememberedProjectsStore', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `spec-workflow-known-projects-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('persists remembered projects across store instances', async () => {
    const store = new RememberedProjectsStore();
    await store.upsertProject('/tmp/repo-a', {
      workflowRootPath: '/tmp/repo-a',
      projectName: 'repo-a',
      source: 'manual',
      seenAt: '2026-03-14T10:00:00.000Z'
    });

    const reloadedStore = new RememberedProjectsStore();
    const projects = await reloadedStore.getAllProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].workspacePath).toBe('/tmp/repo-a');
    expect(projects[0].source).toBe('manual');
    expect(projects[0].lastSeenAt).toBe('2026-03-14T10:00:00.000Z');
  });

  it('updates lastSeenAt on repeated upserts while preserving addedAt', async () => {
    const store = new RememberedProjectsStore();
    await store.upsertProject('/tmp/repo-a', {
      workflowRootPath: '/tmp/repo-a',
      projectName: 'repo-a',
      source: 'manual',
      seenAt: '2026-03-14T10:00:00.000Z'
    });

    const updated = await store.upsertProject('/tmp/repo-a', {
      workflowRootPath: '/tmp/repo-a',
      projectName: 'repo-a',
      source: 'mcp',
      seenAt: '2026-03-14T11:00:00.000Z'
    });

    expect(updated.addedAt).toBe('2026-03-14T10:00:00.000Z');
    expect(updated.lastSeenAt).toBe('2026-03-14T11:00:00.000Z');
    expect(updated.source).toBe('mcp');
  });

  it('removes only the targeted remembered project', async () => {
    const store = new RememberedProjectsStore();
    const first = await store.upsertProject('/tmp/repo-a', {
      workflowRootPath: '/tmp/repo-a',
      projectName: 'repo-a',
      source: 'manual'
    });
    await store.upsertProject('/tmp/repo-b', {
      workflowRootPath: '/tmp/repo-b',
      projectName: 'repo-b',
      source: 'manual'
    });

    await store.removeProjectById(first.projectId);

    const projects = await store.getAllProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].workspacePath).toBe('/tmp/repo-b');
  });
});
