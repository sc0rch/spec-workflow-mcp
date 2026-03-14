import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ProjectActivityService } from '../project-activity.js';
import { ApprovalStorage } from '../approval-storage.js';
import { ImplementationLogManager } from '../implementation-log-manager.js';

describe('ProjectActivityService', () => {
  let tempDir: string;
  let workflowRootPath: string;
  let workspacePath: string;
  let service: ProjectActivityService;

  beforeEach(async () => {
    const baseDir = join(process.cwd(), '.tmp-project-activity');
    await fs.mkdir(baseDir, { recursive: true });
    tempDir = join(baseDir, `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workflowRootPath = join(tempDir, 'repo-main');
    workspacePath = join(tempDir, 'repo-main');
    await fs.mkdir(workflowRootPath, { recursive: true });
    service = new ProjectActivityService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns pending approval count and latest implementation across specs', async () => {
    const approvalFilePath = join(workspacePath, 'src', 'feature.ts');
    await fs.mkdir(join(workspacePath, 'src'), { recursive: true });
    await fs.writeFile(approvalFilePath, 'export const feature = true;', 'utf-8');

    const approvalStorage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    await approvalStorage.createApproval('Review feature', 'src/feature.ts', 'spec', 'desktop-rewrite');

    const firstSpecPath = await createSpec(workflowRootPath, 'alpha-spec');
    const secondSpecPath = await createSpec(workflowRootPath, 'beta-spec');

    const firstLogManager = new ImplementationLogManager(firstSpecPath);
    await firstLogManager.addLogEntry({
      taskId: '1.1',
      timestamp: '2026-03-14T10:00:00.000Z',
      summary: 'Initial desktop shell work',
      filesModified: ['apps/desktop/src/main/index.ts'],
      filesCreated: [],
      statistics: {
        linesAdded: 10,
        linesRemoved: 0,
        filesChanged: 1
      },
      artifacts: {}
    });

    const secondLogManager = new ImplementationLogManager(secondSpecPath);
    await secondLogManager.addLogEntry({
      taskId: '2.3',
      timestamp: '2026-03-14T11:30:00.000Z',
      summary: 'Added project activity service',
      filesModified: ['src/core/project-activity.ts'],
      filesCreated: [],
      statistics: {
        linesAdded: 40,
        linesRemoved: 0,
        filesChanged: 1
      },
      artifacts: {}
    });

    const activity = await service.getProjectActivity({
      translatedWorkflowRootPath: workflowRootPath,
      translatedWorkspacePath: workspacePath
    });

    expect(activity.pendingApprovalCount).toBe(1);
    expect(activity.latestImplementation).toEqual({
      taskId: '2.3',
      summary: 'Added project activity service',
      timestamp: '2026-03-14T11:30:00.000Z',
      specName: 'beta-spec',
      specDisplayName: 'Beta Spec'
    });
  });

  it('returns empty activity when no approvals or logs exist', async () => {
    const activity = await service.getProjectActivity({
      translatedWorkflowRootPath: workflowRootPath,
      translatedWorkspacePath: workspacePath
    });

    expect(activity).toEqual({
      pendingApprovalCount: 0,
      latestImplementation: undefined
    });
  });
});

async function createSpec(projectPath: string, specName: string): Promise<string> {
  const specPath = join(projectPath, '.spec-workflow', 'specs', specName);
  await fs.mkdir(specPath, { recursive: true });
  await fs.writeFile(join(specPath, 'requirements.md'), '# Requirements', 'utf-8');
  return specPath;
}
