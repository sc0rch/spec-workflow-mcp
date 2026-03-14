import { access, readFile } from 'fs/promises';
import { BoundProject } from '../types.js';
import { PathUtils } from './path-utils.js';

export function getRelativeFileCandidates(
  resolvedProject: BoundProject,
  filePath: string
): string[] {
  return Array.from(new Set([
    PathUtils.safeJoin(resolvedProject.workspacePath, filePath),
    PathUtils.safeJoin(resolvedProject.workflowRootPath, filePath)
  ]));
}

export async function readProjectRelativeFile(
  resolvedProject: BoundProject,
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
