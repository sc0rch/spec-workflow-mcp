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

    const [currentContent, diff] = await Promise.all([
      storage.getCurrentFileContent(approvalId),
      this.getDiffSnapshot(storage, approvalId)
    ]);

    return {
      approval,
      currentContent,
      diff
    };
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
