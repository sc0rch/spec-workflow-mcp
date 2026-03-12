import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { homedir } from 'os';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { createSpecPrompt } from '../create-spec.js';
import { createSteeringDocPrompt } from '../create-steering-doc.js';
import { implementTaskPrompt } from '../implement-task.js';
import { specStatusPrompt } from '../spec-status.js';
import { refreshTasksPrompt } from '../refresh-tasks.js';
import type { ToolContext } from '../../types.js';

describe('prompt project binding', () => {
  let tempRoot: string;
  let mainRepoPath: string;
  let worktreePath: string;
  let context: ToolContext;

  beforeEach(async () => {
    const baseDir = join(homedir(), '.tmp-prompt-project-binding');
    await mkdir(baseDir, { recursive: true });
    tempRoot = await mkdtemp(join(baseDir, 'case-'));
    mainRepoPath = join(tempRoot, 'repo-main');
    worktreePath = join(tempRoot, 'repo-wt-a');
    await mkdir(mainRepoPath, { recursive: true });
    await mkdir(worktreePath, { recursive: true });

    context = {
      projectPath: mainRepoPath,
      workspacePath: mainRepoPath,
      noSharedWorktreeSpecs: true,
      dashboardUrl: 'http://localhost:5000'
    };
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it('create-spec prompt includes the explicit projectPath binding', async () => {
    const messages = await createSpecPrompt.handler({
      specName: 'feature-a',
      documentType: 'requirements',
      projectPath: worktreePath
    }, context);

    const text = String(messages[0].content.type === 'text' ? messages[0].content.text : '');
    expect(text).toContain(`Project: ${worktreePath}`);
    expect(text).toContain(`projectPath "${worktreePath}"`);
  });

  it('create-steering-doc prompt includes the explicit projectPath binding', async () => {
    const messages = await createSteeringDocPrompt.handler({
      docType: 'product',
      projectPath: worktreePath
    }, context);

    const text = String(messages[0].content.type === 'text' ? messages[0].content.text : '');
    expect(text).toContain(`Project: ${worktreePath}`);
    expect(text).toContain(`projectPath "${worktreePath}"`);
  });

  it('implement-task prompt tells agents to use projectPath for status and logging calls', async () => {
    const messages = await implementTaskPrompt.handler({
      specName: 'feature-a',
      taskId: '1.1',
      projectPath: worktreePath
    }, context);

    const text = String(messages[0].content.type === 'text' ? messages[0].content.text : '');
    expect(text).toContain(`Project: ${worktreePath}`);
    expect(text).toContain(`spec-status tool with specName "feature-a" and projectPath "${worktreePath}"`);
    expect(text).toContain(`projectPath: "${worktreePath}"`);
  });

  it('spec-status prompt includes the selected project binding', async () => {
    const messages = await specStatusPrompt.handler({
      specName: 'feature-a',
      projectPath: worktreePath
    }, context);

    const text = String(messages[0].content.type === 'text' ? messages[0].content.text : '');
    expect(text).toContain(`Project: ${worktreePath}`);
    expect(text).toContain(`projectPath "${worktreePath}"`);
  });

  it('refresh-tasks prompt binds downstream actions to the selected worktree', async () => {
    const messages = await refreshTasksPrompt.handler({
      specName: 'feature-a',
      projectPath: worktreePath
    }, context);

    const text = String(messages[0].content.type === 'text' ? messages[0].content.text : '');
    expect(text).toContain(`Use projectPath "${worktreePath}" for all stateful spec-workflow tool calls`);
    expect(text).toContain(`create-spec-doc with projectPath "${worktreePath}"`);
  });
});
