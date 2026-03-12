import { access, readFile } from 'fs/promises';
import { ToolContext } from '../types.js';
import { resolveGitRoot, resolveGitWorkspaceRoot } from './git-utils.js';
import { PathUtils, validateProjectPath } from './path-utils.js';

export interface ResolvedProjectPaths {
  requestedProjectPath: string;
  workspacePath: string;
  workflowRootPath: string;
  translatedWorkspacePath: string;
  translatedWorkflowRootPath: string;
  noSharedWorktreeSpecs: boolean;
}

/**
 * Resolve the effective workspace/worktree for a tool call.
 *
 * The incoming `projectPath` acts as a workspace selector. The workflow root is
 * then derived from the server mode:
 * - shared mode: selected workspace -> shared git root
 * - no-shared mode: selected workspace -> workspace-local .spec-workflow
 */
export async function resolveToolProjectPaths(
  projectPathArg: string | undefined,
  context: ToolContext
): Promise<ResolvedProjectPaths> {
  const selectedPath = projectPathArg || context.workspacePath || context.projectPath;
  if (!selectedPath) {
    throw new Error('Project path is required but not provided in context or arguments');
  }

  const requestedProjectPath = await validateProjectPath(selectedPath);
  const workspacePath = await validateProjectPath(resolveGitWorkspaceRoot(requestedProjectPath));
  const noSharedWorktreeSpecs = !!context.noSharedWorktreeSpecs;
  const workflowRootCandidate = noSharedWorktreeSpecs
    ? workspacePath
    : resolveGitRoot(workspacePath);
  const workflowRootPath = await validateProjectPath(workflowRootCandidate);

  return {
    requestedProjectPath,
    workspacePath,
    workflowRootPath,
    translatedWorkspacePath: PathUtils.translatePath(workspacePath),
    translatedWorkflowRootPath: PathUtils.translatePath(workflowRootPath),
    noSharedWorktreeSpecs
  };
}

export function getRelativeFileCandidates(
  resolvedProject: ResolvedProjectPaths,
  filePath: string
): string[] {
  return Array.from(new Set([
    PathUtils.safeJoin(resolvedProject.workspacePath, filePath),
    PathUtils.safeJoin(resolvedProject.workflowRootPath, filePath)
  ]));
}

export async function readProjectRelativeFile(
  resolvedProject: ResolvedProjectPaths,
  filePath: string
): Promise<{ content: string; resolvedPath: string }> {
  const candidates = getRelativeFileCandidates(resolvedProject, filePath);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return {
        content: await readFile(candidate, 'utf-8'),
        resolvedPath: candidate
      };
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error(`File not found in workspace or workflow root: ${filePath}`);
}
