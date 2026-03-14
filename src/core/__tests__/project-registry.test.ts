import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProjectRegistry, generateProjectId } from '../project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';

describe('ProjectRegistry worktree identity', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `spec-workflow-registry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('stores workspace identity and workflow root separately', async () => {
    const registry = new ProjectRegistry();
    const workspacePath = '/tmp/worktrees/feature-auth';
    const workflowRootPath = '/tmp/my-repo';

    const projectId = await registry.registerProject(workspacePath, process.pid, { workflowRootPath });
    const entry = await registry.getProjectById(projectId);

    expect(entry).not.toBeNull();
    expect(entry?.projectPath).toBe(workspacePath);
    expect(entry?.workflowRootPath).toBe(workflowRootPath);
    expect(entry?.projectName).toBe('my-repo · feature-auth');
  });

  it('generates different project IDs for different worktrees of same repo', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';

    const projectIdA = await registry.registerProject('/tmp/worktrees/feature-a', process.pid, { workflowRootPath });
    const projectIdB = await registry.registerProject('/tmp/worktrees/feature-b', process.pid, { workflowRootPath });

    expect(projectIdA).not.toBe(projectIdB);
  });

  it('preserves explicit project names for isolated worktrees', async () => {
    const registry = new ProjectRegistry();
    const workspacePath = '/tmp/worktrees/feature-payments';
    const workflowRootPath = workspacePath;

    const projectId = await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath,
      projectName: 'my-repo · feature-payments'
    });
    const entry = await registry.getProjectById(projectId);

    expect(entry).not.toBeNull();
    expect(entry?.projectName).toBe('my-repo · feature-payments');
  });

  it('normalizes legacy entries without workflowRootPath', async () => {
    const workspacePath = '/tmp/my-repo';
    const projectId = generateProjectId(workspacePath);
    const registryPath = join(tempDir, 'activeProjects.json');

    const legacyData = {
      [projectId]: {
        projectId,
        projectPath: workspacePath,
        projectName: 'my-repo',
        instances: [{ pid: process.pid, registeredAt: new Date().toISOString() }]
      }
    };

    await fs.writeFile(registryPath, JSON.stringify(legacyData, null, 2), 'utf-8');

    const registry = new ProjectRegistry();
    const projects = await registry.getAllProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].workflowRootPath).toBe(workspacePath);
    expect(projects[0].projectPath).toBe(workspacePath);
  });

  it('supports multiple live instances from the same pid when instance IDs differ', async () => {
    const registry = new ProjectRegistry();
    const workspacePath = '/tmp/worktrees/feature-bridge';
    const workflowRootPath = '/tmp/my-repo';

    await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath,
      instanceId: 'bridge-session-a'
    });
    const projectId = await registry.registerProject(workspacePath, process.pid, {
      workflowRootPath,
      instanceId: 'bridge-session-b'
    });

    const entry = await registry.getProjectById(projectId);

    expect(entry?.instances).toEqual([
      expect.objectContaining({ pid: process.pid, instanceId: 'bridge-session-a' }),
      expect.objectContaining({ pid: process.pid, instanceId: 'bridge-session-b' })
    ]);

    await registry.unregisterProject(workspacePath, process.pid, 'bridge-session-a');
    const afterUnregister = await registry.getProjectById(projectId);

    expect(afterUnregister?.instances).toEqual([
      expect.objectContaining({ pid: process.pid, instanceId: 'bridge-session-b' })
    ]);
  });
});
