import { BoundProject } from '../types.js';
import { resolveGitRoot, resolveGitWorkspaceRoot } from './git-utils.js';
import { PathUtils, validateProjectPath } from './path-utils.js';
import { WorkspaceInitializer } from './workspace-initializer.js';

export interface ResolveBoundProjectOptions {
  projectPath?: string;
  noSharedWorktreeSpecs: boolean;
  packageVersion: string;
  initializeWorkspace?: boolean;
}

export async function resolveBoundProject(
  options: ResolveBoundProjectOptions
): Promise<BoundProject> {
  const selectedPath = options.projectPath?.trim() || process.cwd();
  const source = options.projectPath?.trim() ? 'explicit-arg' : 'cwd';
  const requestedPath = await validateProjectPath(selectedPath);
  const workspacePath = await validateProjectPath(resolveGitWorkspaceRoot(requestedPath));
  const workflowRootCandidate = options.noSharedWorktreeSpecs
    ? workspacePath
    : resolveGitRoot(workspacePath);
  const workflowRootPath = await validateProjectPath(workflowRootCandidate);

  if (options.initializeWorkspace !== false) {
    const workspaceInitializer = new WorkspaceInitializer(workflowRootPath, options.packageVersion);
    await workspaceInitializer.initializeWorkspace();
  }

  return {
    requestedPath,
    workspacePath,
    workflowRootPath,
    translatedWorkspacePath: PathUtils.translatePath(workspacePath),
    translatedWorkflowRootPath: PathUtils.translatePath(workflowRootPath),
    noSharedWorktreeSpecs: options.noSharedWorktreeSpecs,
    source
  };
}

export function getProjectBindingErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
