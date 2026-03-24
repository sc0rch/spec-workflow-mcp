import { createHash } from 'crypto';
import { basename } from 'path';

export function generateProjectId(workspacePath: string): string {
  const hash = createHash('sha1').update(workspacePath).digest('base64url');
  return hash.substring(0, 16);
}

export function generateProjectDisplayName(
  workspacePath: string,
  workflowRootPath: string
): string {
  const workspaceName = basename(workspacePath);
  const repoName = basename(workflowRootPath);

  if (workspacePath === workflowRootPath) {
    return repoName;
  }

  return `${repoName} · ${workspaceName}`;
}
