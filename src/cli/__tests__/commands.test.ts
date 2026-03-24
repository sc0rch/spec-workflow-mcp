import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  parseFlags,
  runApprovalsDeleteCommand,
  runApprovalsInspectCommand,
  runApprovalsRequestCommand,
  runApprovalsRespondCommand,
  runApprovalsStatusCommand,
  runLogImplementationCommand,
  runSpecStatusCommand
} from '../commands.js';

describe('CLI command handlers', () => {
  const tempRoot = join(homedir(), '.spec-workflow-cli-tests');
  let projectDir: string;
  let specDir: string;

  beforeEach(async () => {
    await mkdir(tempRoot, { recursive: true });
    projectDir = await mkdtemp(join(tempRoot, 'spec-workflow-cli-'));
    specDir = join(projectDir, '.spec-workflow', 'specs', 'demo-spec');
    await mkdir(specDir, { recursive: true });
    await writeFile(
      join(specDir, 'requirements.md'),
      '# Requirements\n\nKeep approvals and logs accessible.\n',
      'utf-8'
    );
    await writeFile(
      join(specDir, 'design.md'),
      '# Design\n\nUse a CLI-first workflow.\n',
      'utf-8'
    );
    await writeFile(
      join(specDir, 'tasks.md'),
      '- [ ] 1.1 Ship CLI flow\n- [ ] 1.2 Add implementation logging\n',
      'utf-8'
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('returns spec status with project context for an explicit project path', async () => {
    const result = await runSpecStatusCommand(
      parseFlags(['spec-status', '--spec-name', 'demo-spec']),
      commandOptions(projectDir)
    );

    expect(result.success).toBe(true);
    expect(result.projectContext).toMatchObject({
      projectPath: projectDir,
      specName: 'demo-spec',
      currentPhase: 'implementation'
    });
    expect(result.data).toMatchObject({
      name: 'demo-spec',
      overallStatus: 'implementing'
    });
  });

  it('creates, inspects, approves, and deletes an approval through the CLI handlers', async () => {
    const requestResult = await runApprovalsRequestCommand(
      parseFlags([
        'approvals',
        'request',
        '--title',
        'Review requirements',
        '--file-path',
        '.spec-workflow/specs/demo-spec/requirements.md',
        '--type',
        'document',
        '--category',
        'spec',
        '--category-name',
        'demo-spec'
      ]),
      commandOptions(projectDir)
    );

    expect(requestResult.success).toBe(true);
    const approvalId = (requestResult.data as { approvalId: string }).approvalId;

    const pendingStatus = await runApprovalsStatusCommand(
      parseFlags(['approvals', 'status', '--approval-id', approvalId]),
      commandOptions(projectDir)
    );
    expect(pendingStatus.success).toBe(true);
    expect(pendingStatus.data).toMatchObject({
      approvalId,
      status: 'pending'
    });

    const inspectResult = await runApprovalsInspectCommand(
      parseFlags(['approvals', 'inspect', '--approval-id', approvalId]),
      commandOptions(projectDir)
    );
    expect(inspectResult.success).toBe(true);
    expect(inspectResult.data).toMatchObject({
      approval: {
        id: approvalId,
        filePath: '.spec-workflow/specs/demo-spec/requirements.md'
      }
    });

    const respondResult = await runApprovalsRespondCommand(
      parseFlags([
        'approvals',
        'respond',
        '--approval-id',
        approvalId,
        '--action',
        'approve',
        '--response',
        'Approved.'
      ]),
      commandOptions(projectDir)
    );
    expect(respondResult.success).toBe(true);

    const approvedStatus = await runApprovalsStatusCommand(
      parseFlags(['approvals', 'status', '--approval-id', approvalId]),
      commandOptions(projectDir)
    );
    expect(approvedStatus.data).toMatchObject({
      approvalId,
      status: 'approved',
      response: 'Approved.'
    });

    const deleteResult = await runApprovalsDeleteCommand(
      parseFlags(['approvals', 'delete', '--approval-id', approvalId]),
      commandOptions(projectDir)
    );
    expect(deleteResult.success).toBe(true);
  });

  it('records an implementation log from a JSON input file', async () => {
    const inputPath = join(projectDir, 'implementation-input.json');
    await writeFile(
      inputPath,
      JSON.stringify({
        specName: 'demo-spec',
        taskId: '1.1',
        summary: 'Implemented the CLI-first approval flow',
        filesModified: ['src/index.ts'],
        filesCreated: ['SKILL.md'],
        statistics: {
          linesAdded: 42,
          linesRemoved: 7
        },
        artifacts: {}
      }),
      'utf-8'
    );

    const result = await runLogImplementationCommand(
      parseFlags(['log-implementation', '--input', inputPath]),
      commandOptions(projectDir)
    );

    expect(result.success).toBe(true);
    expect(result.projectContext).toMatchObject({
      projectPath: projectDir,
      specName: 'demo-spec'
    });
    expect(result.data).toMatchObject({
      entry: {
        taskId: '1.1',
        summary: 'Implemented the CLI-first approval flow'
      },
      taskStats: {
        totalImplementations: 1
      }
    });

    const logDirectory = join(specDir, 'Implementation Logs');
    const [logFile] = await readdir(logDirectory);
    const logContent = await readFile(join(logDirectory, logFile), 'utf-8');
    expect(logContent).toContain('Implemented the CLI-first approval flow');
  });
});

function commandOptions(projectPath: string) {
  return {
    projectPath,
    noSharedWorktreeSpecs: false,
    packageVersion: '3.0.0'
  };
}
