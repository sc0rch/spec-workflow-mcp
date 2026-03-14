import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { createStartupBinding, ProjectBindingService } from '../project-binding.js';
import { ProjectRegistry } from '../project-registry.js';
import { RememberedProjectsStore } from '../remembered-projects.js';
import { resolveGitRoot, resolveGitWorkspaceRoot } from '../git-utils.js';

vi.mock('../git-utils.js', () => ({
  resolveGitWorkspaceRoot: vi.fn((path: string) => path),
  resolveGitRoot: vi.fn((path: string) => path),
  discoverGitWorkspaces: vi.fn((path: string, options: { noSharedWorktreeSpecs?: boolean } = {}) => {
    const workflowRootPath = options.noSharedWorktreeSpecs ? path : (path.endsWith('/wt-a') ? path.replace(/\/wt-a$/, '/repo-main') : path);
    return [{
      workspacePath: path,
      workflowRootPath,
      repoRootPath: workflowRootPath,
      repoName: workflowRootPath.split('/').pop() || 'repo',
      isMainWorkspace: path === workflowRootPath
    }];
  })
}));

const mockedResolveGitWorkspaceRoot = vi.mocked(resolveGitWorkspaceRoot);
const mockedResolveGitRoot = vi.mocked(resolveGitRoot);

function createService(options: {
  startupBinding?: ReturnType<typeof createStartupBinding>;
  noSharedWorktreeSpecs?: boolean;
  rootPaths?: string[];
  registryPid?: number;
  registryInstanceId?: string;
}) {
  const listRoots = vi.fn(async () => ({
    roots: (options.rootPaths || []).map(uri => ({ uri }))
  }));
  const registerProject = vi.fn(async () => 'project-id');
  const upsertProject = vi.fn(async () => ({
    projectId: 'project-id',
    workspacePath: options.startupBinding?.workspacePath || '',
    workflowRootPath: options.startupBinding?.workflowRootPath || '',
    projectName: 'repo',
    addedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    source: 'mcp'
  }));

  const service = new ProjectBindingService({
    server: { listRoots } as any,
    projectRegistry: { registerProject } as unknown as ProjectRegistry,
    rememberedProjects: { upsertProject } as unknown as RememberedProjectsStore,
    packageVersion: 'test',
    noSharedWorktreeSpecs: !!options.noSharedWorktreeSpecs,
    startupBinding: options.startupBinding,
    registryPid: options.registryPid,
    registryInstanceId: options.registryInstanceId
  });

  return { service, listRoots, registerProject, upsertProject };
}

describe('project-binding', () => {
  let tempRoot: string;
  let mainRepoPath: string;
  let worktreePath: string;
  let otherRepoPath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    const baseDir = join(process.cwd(), '.tmp-project-binding');
    await mkdir(baseDir, { recursive: true });
    tempRoot = await mkdtemp(join(baseDir, 'case-'));
    mainRepoPath = join(tempRoot, 'repo-main');
    worktreePath = join(tempRoot, 'wt-a');
    otherRepoPath = join(tempRoot, 'repo-b');

    await mkdir(mainRepoPath, { recursive: true });
    await mkdir(worktreePath, { recursive: true });
    await mkdir(otherRepoPath, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('prefers explicit projectPath over startup binding and client roots', async () => {
    const { service, listRoots } = createService({
      startupBinding: createStartupBinding(mainRepoPath, true),
      noSharedWorktreeSpecs: true,
      rootPaths: [`file://${otherRepoPath}`]
    });

    const resolved = await service.resolveBoundProject(worktreePath);

    expect(resolved.source).toBe('explicit-arg');
    expect(resolved.workspacePath).toBe(worktreePath);
    expect(resolved.workflowRootPath).toBe(worktreePath);
    expect(listRoots).not.toHaveBeenCalled();
  });

  it('uses the startup binding when no explicit projectPath is provided', async () => {
    const startupBinding = createStartupBinding(mainRepoPath, false);
    const { service, listRoots } = createService({
      startupBinding,
      rootPaths: [`file://${otherRepoPath}`]
    });

    const resolved = await service.resolveBoundProject();

    expect(resolved.source).toBe('startup-binding');
    expect(resolved.workspacePath).toBe(mainRepoPath);
    expect(listRoots).not.toHaveBeenCalled();
  });

  it('uses a single client root when no explicit projectPath or startup binding exists', async () => {
    const { service, registerProject, upsertProject } = createService({
      rootPaths: [`file://${worktreePath}`]
    });

    const resolved = await service.resolveBoundProject();

    expect(resolved.source).toBe('client-root');
    expect(resolved.workspacePath).toBe(worktreePath);
    expect(registerProject).toHaveBeenCalledWith(
      worktreePath,
      process.pid,
      expect.objectContaining({ workflowRootPath: mainRepoPath })
    );
    expect(upsertProject).toHaveBeenCalledWith(
      worktreePath,
      expect.objectContaining({ workflowRootPath: mainRepoPath, source: 'mcp' })
    );
  });

  it('fails when the client provides no filesystem roots', async () => {
    const { service } = createService({ rootPaths: [] });

    await expect(service.resolveBoundProject()).rejects.toThrow('Pass projectPath explicitly');
  });

  it('fails when the client provides multiple filesystem roots', async () => {
    const { service } = createService({
      rootPaths: [`file://${mainRepoPath}`, `file://${otherRepoPath}`]
    });

    await expect(service.resolveBoundProject()).rejects.toThrow('Pass projectPath explicitly');
  });

  it('routes shared-mode worktree bindings back to the git root', async () => {
    mockedResolveGitWorkspaceRoot.mockImplementation((path: string) => path);
    mockedResolveGitRoot.mockImplementation((path: string) => (
      path === worktreePath ? mainRepoPath : path
    ));

    const { service } = createService({
      rootPaths: [`file://${worktreePath}`]
    });

    const resolved = await service.resolveBoundProject();

    expect(resolved.workspacePath).toBe(worktreePath);
    expect(resolved.workflowRootPath).toBe(mainRepoPath);
  });

  it('registers each newly resolved repository lazily in the same process', async () => {
    const { service, registerProject, upsertProject } = createService({ noSharedWorktreeSpecs: true });

    await service.resolveBoundProject(mainRepoPath);
    await service.resolveBoundProject(otherRepoPath);

    expect(registerProject).toHaveBeenCalledTimes(2);
    expect(upsertProject).toHaveBeenCalledTimes(2);
    expect(registerProject).toHaveBeenNthCalledWith(
      1,
      mainRepoPath,
      process.pid,
      expect.objectContaining({ workflowRootPath: mainRepoPath })
    );
    expect(registerProject).toHaveBeenNthCalledWith(
      2,
      otherRepoPath,
      process.pid,
      expect.objectContaining({ workflowRootPath: otherRepoPath })
    );
  });

  it('passes an explicit registry instance id through to project registration', async () => {
    const { service, registerProject } = createService({
      rootPaths: [`file://${mainRepoPath}`],
      registryPid: 424242,
      registryInstanceId: 'desktop-bridge-session'
    });

    await service.resolveBoundProject();

    expect(registerProject).toHaveBeenCalledWith(
      mainRepoPath,
      424242,
      expect.objectContaining({ instanceId: 'desktop-bridge-session' })
    );
  });
});
