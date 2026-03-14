import { ToolContext } from '../types.js';

export async function resolvePromptProjectPath(
  context: ToolContext,
  projectPath?: string
): Promise<string> {
  const boundProject = await context.resolveBoundProject(projectPath);
  return boundProject.workspacePath;
}

export async function tryResolvePromptProjectPath(
  context: ToolContext,
  projectPath?: string
): Promise<string | undefined> {
  try {
    return await resolvePromptProjectPath(context, projectPath);
  } catch {
    return undefined;
  }
}
