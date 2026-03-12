import { describe, expect, it } from 'vitest';
import { buildWorktreeSyncPlan } from '../worktree-sync.js';
import { GitWorkspaceDescriptor } from '../git-utils.js';

function project(workspacePath: string, workflowRootPath: string): GitWorkspaceDescriptor {
  return {
    workspacePath,
    workflowRootPath,
    repoRootPath: '/repo/main',
    repoName: 'main',
    isMainWorkspace: workspacePath === '/repo/main'
  };
}

describe('buildWorktreeSyncPlan', () => {
  it('returns newly discovered worktrees as additions', () => {
    const discoveredProjects = [
      project('/repo/main', '/repo/main'),
      project('/repo/worktrees/a', '/repo/worktrees/a'),
      project('/repo/worktrees/b', '/repo/worktrees/b')
    ];

    const plan = buildWorktreeSyncPlan(
      ['/repo/main', '/repo/worktrees/a'],
      discoveredProjects
    );

    expect(plan.addedProjects.map(entry => entry.workspacePath)).toEqual(['/repo/worktrees/b']);
    expect(plan.removedWorkspacePaths).toEqual([]);
  });

  it('returns removed worktrees that are no longer discovered', () => {
    const discoveredProjects = [
      project('/repo/main', '/repo/main'),
      project('/repo/worktrees/a', '/repo/worktrees/a')
    ];

    const plan = buildWorktreeSyncPlan(
      ['/repo/main', '/repo/worktrees/a', '/repo/worktrees/b'],
      discoveredProjects
    );

    expect(plan.addedProjects).toEqual([]);
    expect(plan.removedWorkspacePaths).toEqual(['/repo/worktrees/b']);
  });

  it('handles unchanged project sets without updates', () => {
    const discoveredProjects = [
      project('/repo/main', '/repo/main'),
      project('/repo/worktrees/a', '/repo/worktrees/a')
    ];

    const plan = buildWorktreeSyncPlan(
      ['/repo/main', '/repo/worktrees/a'],
      discoveredProjects
    );

    expect(plan.addedProjects).toEqual([]);
    expect(plan.removedWorkspacePaths).toEqual([]);
  });
});
