import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ApprovalDraftStorage } from '../approval-draft-storage.js';
import { ApprovalStorage } from '../approval-storage.js';
import { ApprovalReviewService } from '../approval-review.js';

describe('ApprovalReviewService', () => {
  let tempDir: string;
  let workflowRootPath: string;
  let workspacePath: string;
  let service: ApprovalReviewService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-workflow-approval-review-'));
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

  it('loads saved approval drafts and clears them after a response', async () => {
    const storage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    const approvalId = await storage.createApproval(
      'Review desktop shell',
      'src/desktop.ts',
      'spec',
      'desktop-rewrite'
    );

    await service.saveApprovalDraft(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId,
      {
        comments: [
          {
            id: 'draft-comment-1',
            type: 'selection',
            comment: 'Tighten this sentence.',
            timestamp: '2026-03-16T09:00:00.000Z',
            selectedText: 'export const desktop = true;',
            startOffset: 0,
            endOffset: 28
          }
        ],
        composer: {
          mode: 'general',
          commentDraft: 'Draft note'
        }
      }
    );

    const reviewWithDraft = await service.getApprovalReview(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId
    );

    expect(reviewWithDraft?.draft?.comments).toHaveLength(1);
    expect(reviewWithDraft?.draft?.composer?.commentDraft).toBe('Draft note');

    await service.respondToApproval(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId,
      'reject',
      'Changes requested.'
    );

    const clearedReview = await service.getApprovalReview(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId
    );

    expect(clearedReview?.draft).toBeNull();
  });

  it('drops stale approval drafts when the approval timestamp changes', async () => {
    const storage = new ApprovalStorage(workflowRootPath, {
      fileResolutionPath: workspacePath
    });
    const approvalId = await storage.createApproval(
      'Review desktop shell',
      'src/desktop.ts',
      'spec',
      'desktop-rewrite'
    );
    const approval = await storage.getApproval(approvalId);
    expect(approval).not.toBeNull();

    const draftStorage = new ApprovalDraftStorage(workflowRootPath, workspacePath);
    await draftStorage.saveDraft(approvalId, {
      approvalId,
      approvalCreatedAt: '2000-01-01T00:00:00.000Z',
      filePath: 'src/desktop.ts',
      category: 'spec',
      categoryName: 'desktop-rewrite',
      updatedAt: '2026-03-16T09:00:00.000Z',
      comments: [
        {
          id: 'draft-comment-1',
          type: 'general',
          comment: 'Stale',
          timestamp: '2026-03-16T09:00:00.000Z'
        }
      ]
    });

    const review = await service.getApprovalReview(
      {
        translatedWorkflowRootPath: workflowRootPath,
        translatedWorkspacePath: workspacePath
      },
      approvalId
    );

    expect(review?.draft).toBeNull();
    await expect(draftStorage.getDraft(approvalId)).resolves.toBeNull();
  });
});
