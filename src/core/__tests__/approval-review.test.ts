import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { ApprovalStorage } from '../approval-storage.js';
import { ApprovalReviewService } from '../approval-review.js';

describe('ApprovalReviewService', () => {
  let tempDir: string;
  let workflowRootPath: string;
  let workspacePath: string;
  let service: ApprovalReviewService;

  beforeEach(async () => {
    const baseDir = join(process.cwd(), '.tmp-approval-review');
    await fs.mkdir(baseDir, { recursive: true });
    tempDir = join(baseDir, `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workflowRootPath = join(tempDir, 'repo-main');
    workspacePath = workflowRootPath;
    await fs.mkdir(join(workspacePath, 'src'), { recursive: true });
    await fs.writeFile(join(workspacePath, 'src', 'desktop.ts'), 'export const desktop = true;\n', 'utf-8');
    service = new ApprovalReviewService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('loads approval content and a diff-first snapshot', async () => {
    const storage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    const approvalId = await storage.createApproval(
      'Review desktop shell',
      'src/desktop.ts',
      'spec',
      'desktop-rewrite'
    );

    const review = await service.getApprovalReview(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId
    );

    expect(review?.approval.title).toBe('Review desktop shell');
    expect(review?.currentContent).toContain('export const desktop = true;');
    expect(review?.diff?.additions).toBeGreaterThan(0);
  });

  it('updates approval status through action names', async () => {
    const storage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    const approvalId = await storage.createApproval(
      'Review desktop shell',
      'src/desktop.ts',
      'spec',
      'desktop-rewrite'
    );

    await service.respondToApproval(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId,
      'approve',
      'Looks good.'
    );

    const updatedApproval = await storage.getApproval(approvalId);
    expect(updatedApproval?.status).toBe('approved');
    expect(updatedApproval?.response).toBe('Looks good.');
  });
});
