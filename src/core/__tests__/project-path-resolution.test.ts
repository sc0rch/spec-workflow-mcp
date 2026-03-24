import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { mkdtemp, mkdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { readProjectRelativeFile } from '../project-path-resolution.js';
import { BoundProject } from '../../types.js';

function createBoundProject(workspacePath: string, workflowRootPath: string): BoundProject {
  return {
    requestedPath: workspacePath,
    workspacePath,
    workflowRootPath,
    translatedWorkspacePath: workspacePath,
    translatedWorkflowRootPath: workflowRootPath,
    noSharedWorktreeSpecs: false,
    source: 'explicit-arg'
  };
}

describe('project-path-resolution', () => {
  let tempRoot: string;
  let mainRepoPath: string;
  let worktreePath: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'spec-workflow-project-path-resolution-'));
    mainRepoPath = join(tempRoot, 'repo-main');
    worktreePath = join(tempRoot, 'repo-wt-a');

    await mkdir(mainRepoPath, { recursive: true });
    await mkdir(worktreePath, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('prefers workspace-relative files over shared workflow-root files', async () => {
    const relativePath = 'src/service.ts';
    await mkdir(join(worktreePath, 'src'), { recursive: true });
    await mkdir(join(mainRepoPath, 'src'), { recursive: true });
    await writeFile(join(worktreePath, relativePath), 'workspace-content', 'utf-8');
    await writeFile(join(mainRepoPath, relativePath), 'shared-content', 'utf-8');

    const file = await readProjectRelativeFile(
      createBoundProject(worktreePath, mainRepoPath),
      relativePath
    );

    expect(file.content).toBe('workspace-content');
    expect(file.resolvedPath).toBe(join(worktreePath, relativePath));
  });

  it('falls back to the workflow root when the workspace copy does not exist', async () => {
    const relativePath = '.spec-workflow/specs/test-spec/requirements.md';
    await mkdir(join(mainRepoPath, '.spec-workflow', 'specs', 'test-spec'), { recursive: true });
    await writeFile(join(mainRepoPath, relativePath), '# Shared requirements', 'utf-8');

    const file = await readProjectRelativeFile(
      createBoundProject(worktreePath, mainRepoPath),
      relativePath
    );

    expect(file.content).toBe('# Shared requirements');
    expect(file.resolvedPath).toBe(join(mainRepoPath, relativePath));
  });
});
