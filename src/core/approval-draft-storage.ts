import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { PathUtils } from './path-utils.js';
import type { ApprovalComment, ApprovalRequest } from './approval-storage.js';

export interface ApprovalDraftComposer {
  mode: 'general' | 'selection';
  editingCommentId?: string;
  commentDraft: string;
  selectedText?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface ApprovalDraftRecord {
  approvalId: string;
  approvalCreatedAt: string;
  filePath: string;
  category: ApprovalRequest['category'];
  categoryName: string;
  updatedAt: string;
  comments: ApprovalComment[];
  composer?: ApprovalDraftComposer;
}

export class ApprovalDraftStorage {
  private readonly draftsDir: string;

  constructor(
    workflowRootPath: string,
    workspacePath: string
  ) {
    const resolvedWorkflowRootPath = resolve(workflowRootPath);
    const resolvedWorkspacePath = resolve(workspacePath);
    const workspaceHash = createHash('sha1')
      .update(resolvedWorkspacePath)
      .digest('base64url')
      .slice(0, 16);

    this.draftsDir = join(
      PathUtils.getReviewDraftsPath(resolvedWorkflowRootPath),
      'approvals',
      workspaceHash
    );
  }

  async getDraft(approvalId: string): Promise<ApprovalDraftRecord | null> {
    try {
      const content = await fs.readFile(this.getDraftPath(approvalId), 'utf-8');
      return JSON.parse(content) as ApprovalDraftRecord;
    } catch {
      return null;
    }
  }

  async saveDraft(approvalId: string, draft: ApprovalDraftRecord): Promise<void> {
    await fs.mkdir(this.draftsDir, { recursive: true });
    await fs.writeFile(
      this.getDraftPath(approvalId),
      JSON.stringify(draft, null, 2),
      'utf-8'
    );
  }

  async deleteDraft(approvalId: string): Promise<void> {
    try {
      await fs.unlink(this.getDraftPath(approvalId));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private getDraftPath(approvalId: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(approvalId)) {
      throw new Error('Invalid approval draft id.');
    }

    return join(this.draftsDir, `${approvalId}.json`);
  }
}
