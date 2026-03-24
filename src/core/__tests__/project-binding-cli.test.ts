import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveGitWorkspaceRoot,
  resolveGitRoot,
  validateProjectPath,
  translatePath,
  initializeWorkspace,
  WorkspaceInitializer
} = vi.hoisted(() => ({
  resolveGitWorkspaceRoot: vi.fn((projectPath: string) => `${projectPath}/workspace`),
  resolveGitRoot: vi.fn((workspacePath: string) => `${workspacePath}/repo-root`),
  validateProjectPath: vi.fn(async (projectPath: string) => projectPath),
  translatePath: vi.fn((projectPath: string) => `translated:${projectPath}`),
  initializeWorkspace: vi.fn(async () => undefined),
  WorkspaceInitializer: vi.fn().mockImplementation(function WorkspaceInitializerMock() {
    return {
      initializeWorkspace
    };
  })
}));

vi.mock('../git-utils.js', () => ({
  resolveGitWorkspaceRoot,
  resolveGitRoot
}));

vi.mock('../path-utils.js', () => ({
  PathUtils: {
    translatePath
  },
  validateProjectPath
}));

vi.mock('../workspace-initializer.js', () => ({
  WorkspaceInitializer
}));

import { resolveBoundProject } from '../project-binding.js';

describe('resolveBoundProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('binds to an explicit project path and uses the shared git root by default', async () => {
    const boundProject = await resolveBoundProject({
      projectPath: '/tmp/spec-project',
      noSharedWorktreeSpecs: false,
      packageVersion: '3.0.0'
    });

    expect(boundProject).toEqual({
      requestedPath: '/tmp/spec-project',
      workspacePath: '/tmp/spec-project/workspace',
      workflowRootPath: '/tmp/spec-project/workspace/repo-root',
      translatedWorkspacePath: 'translated:/tmp/spec-project/workspace',
      translatedWorkflowRootPath: 'translated:/tmp/spec-project/workspace/repo-root',
      noSharedWorktreeSpecs: false,
      source: 'explicit-arg'
    });
    expect(resolveGitWorkspaceRoot).toHaveBeenCalledWith('/tmp/spec-project');
    expect(resolveGitRoot).toHaveBeenCalledWith('/tmp/spec-project/workspace');
    expect(WorkspaceInitializer).toHaveBeenCalledWith(
      '/tmp/spec-project/workspace/repo-root',
      '3.0.0'
    );
    expect(initializeWorkspace).toHaveBeenCalledTimes(1);
  });

  it('falls back to cwd and keeps specs in the current worktree when requested', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/tmp/current-shell');

    try {
      const boundProject = await resolveBoundProject({
        noSharedWorktreeSpecs: true,
        packageVersion: '3.0.0',
        initializeWorkspace: false
      });

      expect(boundProject.requestedPath).toBe('/tmp/current-shell');
      expect(boundProject.workspacePath).toBe('/tmp/current-shell/workspace');
      expect(boundProject.workflowRootPath).toBe('/tmp/current-shell/workspace');
      expect(boundProject.source).toBe('cwd');
      expect(resolveGitRoot).not.toHaveBeenCalled();
      expect(WorkspaceInitializer).not.toHaveBeenCalled();
      expect(initializeWorkspace).not.toHaveBeenCalled();
    } finally {
      cwdSpy.mockRestore();
    }
  });
});
