import { GitWorkspaceDescriptor } from './git-utils.js';

export interface WorktreeSyncPlan {
  addedProjects: GitWorkspaceDescriptor[];
  removedWorkspacePaths: string[];
}

export function buildWorktreeSyncPlan(
  currentWorkspacePaths: Iterable<string>,
  discoveredProjects: GitWorkspaceDescriptor[]
): WorktreeSyncPlan {
  const currentPathSet = new Set(currentWorkspacePaths);
  const discoveredPathSet = new Set(discoveredProjects.map(project => project.workspacePath));

  return {
    addedProjects: discoveredProjects.filter(project => !currentPathSet.has(project.workspacePath)),
    removedWorkspacePaths: Array.from(currentPathSet)
      .filter(workspacePath => !discoveredPathSet.has(workspacePath))
      .sort()
  };
}
