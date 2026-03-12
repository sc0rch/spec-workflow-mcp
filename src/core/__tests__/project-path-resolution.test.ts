import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { resolveToolProjectPaths, readProjectRelativeFile } from '../project-path-resolution.js';
import { resolveGitRoot, resolveGitWorkspaceRoot } from '../git-utils.js';
import type { ToolContext } from '../../types.js';

vi.mock('../git-utils.js', () => ({
  resolveGitWorkspaceRoot: vi.fn((path: string) => path),
  resolveGitRoot: vi.fn((path: string) => path)
}));

const mockedResolveGitWorkspaceRoot = vi.mocked(resolveGitWorkspaceRoot);
const mockedResolveGitRoot = vi.mocked(resolveGitRoot);

describe('project-path-resolution', () => {
  let tempRoot: string;
  let mainRepoPath: string;
  let worktreePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    const baseDir = join(process.cwd(), '.tmp-project-path-resolution');
    await mkdir(baseDir, { recursive: true });
    tempRoot = await mkdtemp(join(baseDir, 'case-'));
    mainRepoPath = join(tempRoot, 'repo-main');
    worktreePath = join(tempRoot, 'repo-wt-a');

    await mkdir(mainRepoPath, { recursive: true });
    await mkdir(worktreePath, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('treats explicit projectPath as a workspace selector in no-shared mode', async () => {
    mockedResolveGitWorkspaceRoot.mockImplementation((path: string) => path);

    const context: ToolContext = {
      projectPath: mainRepoPath,
      workspacePath: mainRepoPath,
      noSharedWorktreeSpecs: true
    };

    const resolved = await resolveToolProjectPaths(worktreePath, context);

    expect(resolved.workspacePath).toBe(worktreePath);
    expect(resolved.workflowRootPath).toBe(worktreePath);
    expect(mockedResolveGitRoot).not.toHaveBeenCalled();
  });

  it('routes worktree selections back to the shared git root in shared mode', async () => {
    mockedResolveGitWorkspaceRoot.mockImplementation((path: string) => path);
    mockedResolveGitRoot.mockImplementation((path: string) => (
      path === worktreePath ? mainRepoPath : path
    ));

    const context: ToolContext = {
      projectPath: mainRepoPath,
      workspacePath: mainRepoPath,
      noSharedWorktreeSpecs: false
    };

    const resolved = await resolveToolProjectPaths(worktreePath, context);

    expect(resolved.workspacePath).toBe(worktreePath);
    expect(resolved.workflowRootPath).toBe(mainRepoPath);
    expect(mockedResolveGitRoot).toHaveBeenCalledWith(worktreePath);
  });

  it('prefers workspace-relative files over shared workflow-root files', async () => {
    const relativePath = 'src/service.ts';
    await mkdir(join(worktreePath, 'src'), { recursive: true });
    await mkdir(join(mainRepoPath, 'src'), { recursive: true });
    await writeFile(join(worktreePath, relativePath), 'workspace-content', 'utf-8');
    await writeFile(join(mainRepoPath, relativePath), 'shared-content', 'utf-8');

    const file = await readProjectRelativeFile({
      requestedProjectPath: worktreePath,
      workspacePath: worktreePath,
      workflowRootPath: mainRepoPath,
      translatedWorkspacePath: worktreePath,
      translatedWorkflowRootPath: mainRepoPath,
      noSharedWorktreeSpecs: false
    }, relativePath);

    expect(file.content).toBe('workspace-content');
    expect(file.resolvedPath).toBe(join(worktreePath, relativePath));
  });

  it('falls back to the workflow root when the workspace copy does not exist', async () => {
    const relativePath = '.spec-workflow/specs/test-spec/requirements.md';
    await mkdir(join(mainRepoPath, '.spec-workflow', 'specs', 'test-spec'), { recursive: true });
    await writeFile(join(mainRepoPath, relativePath), '# Shared requirements', 'utf-8');

    const file = await readProjectRelativeFile({
      requestedProjectPath: worktreePath,
      workspacePath: worktreePath,
      workflowRootPath: mainRepoPath,
      translatedWorkspacePath: worktreePath,
      translatedWorkflowRootPath: mainRepoPath,
      noSharedWorktreeSpecs: false
    }, relativePath);

    expect(file.content).toBe('# Shared requirements');
    expect(file.resolvedPath).toBe(join(mainRepoPath, relativePath));
  });
});
