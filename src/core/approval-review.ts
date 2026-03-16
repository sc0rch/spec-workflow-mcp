import {
  ApprovalDraftStorage,
  type ApprovalDraftComposer,
  type ApprovalDraftRecord
} from './approval-draft-storage.js';
import {
  ApprovalStorage,
  type ApprovalComment,
  type ApprovalRequest,
  type DiffResult
} from './approval-storage.js';

export interface ApprovalReviewPaths {
  translatedWorkflowRootPath: string;
  translatedWorkspacePath: string;
}

export interface ApprovalReviewSnapshot {
  approval: ApprovalRequest;
  currentContent: string | null;
  diff: DiffResult | null;
  draft: ApprovalDraftRecord | null;
}

export interface SaveApprovalDraftInput {
  comments: ApprovalComment[];
  composer?: ApprovalDraftComposer;
}

export class ApprovalReviewService {
  async getApprovalReview(
    paths: ApprovalReviewPaths,
    approvalId: string
  ): Promise<ApprovalReviewSnapshot | null> {
    const storage = createApprovalStorage(paths);
    const approval = await storage.getApproval(approvalId);

    if (!approval) {
      return null;
    }

    const draftStorage = createApprovalDraftStorage(paths);
    const [currentContent, diff] = await Promise.all([
      storage.getCurrentFileContent(approvalId),
      this.getDiffSnapshot(storage, approvalId)
    ]);
    const draft = await draftStorage.getDraft(approvalId);

    if (draft && draft.approvalCreatedAt !== approval.createdAt) {
      await draftStorage.deleteDraft(approvalId);
    }

    return {
      approval,
      currentContent,
      diff,
      draft: draft?.approvalCreatedAt === approval.createdAt ? draft : null
    };
  }

  async saveApprovalDraft(
    paths: ApprovalReviewPaths,
    approvalId: string,
    draft: SaveApprovalDraftInput | null
  ): Promise<void> {
    const approvalStorage = createApprovalStorage(paths);
    const approval = await approvalStorage.getApproval(approvalId);
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    const draftStorage = createApprovalDraftStorage(paths);
    if (!draft || (draft.comments.length === 0 && !hasComposerContent(draft.composer))) {
      await draftStorage.deleteDraft(approvalId);
      return;
    }

    await draftStorage.saveDraft(approvalId, {
      approvalId,
      approvalCreatedAt: approval.createdAt,
      filePath: approval.filePath,
      category: approval.category,
      categoryName: approval.categoryName,
      updatedAt: new Date().toISOString(),
      comments: draft.comments,
      ...(draft.composer ? { composer: draft.composer } : {})
    });
  }

  async respondToApproval(
    paths: ApprovalReviewPaths,
    approvalId: string,
    action: 'approve' | 'reject' | 'needs-revision',
    response: string,
    annotations?: string,
    comments?: ApprovalComment[]
  ): Promise<void> {
    const storage = createApprovalStorage(paths);
    const actionToStatus: Record<typeof action, 'approved' | 'rejected' | 'needs-revision'> = {
      approve: 'approved',
      reject: 'rejected',
      'needs-revision': 'needs-revision'
    };

    await storage.updateApproval(
      approvalId,
      actionToStatus[action],
      response,
      annotations,
      comments
    );

    await createApprovalDraftStorage(paths).deleteDraft(approvalId);
  }

  private async getDiffSnapshot(
    storage: ApprovalStorage,
    approvalId: string
  ): Promise<DiffResult | null> {
    try {
      return await storage.compareSnapshots(approvalId, 0, 'current');
    } catch {
      return null;
    }
  }
}

function createApprovalStorage(paths: ApprovalReviewPaths): ApprovalStorage {
  return new ApprovalStorage(paths.translatedWorkflowRootPath, {
    fileResolutionPath: paths.translatedWorkspacePath
  });
}

function createApprovalDraftStorage(paths: ApprovalReviewPaths): ApprovalDraftStorage {
  return new ApprovalDraftStorage(
    paths.translatedWorkflowRootPath,
    paths.translatedWorkspacePath
  );
}

function hasComposerContent(composer: ApprovalDraftComposer | undefined): boolean {
  if (!composer) {
    return false;
  }

  return (
    composer.commentDraft.trim().length > 0
    || composer.mode === 'selection'
  );
}
