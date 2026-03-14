import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  DesktopApprovalReview,
  DesktopProjectWorkspace
} from '../../shared/desktop-api.js';
import { ApprovalReviewPanel } from './ApprovalReviewPanel.js';

const projectWorkspace: DesktopProjectWorkspace = {
  specs: [
    {
      name: 'desktop-rewrite',
      displayName: 'Desktop Rewrite',
      lastModified: '2026-03-14T12:10:00.000Z',
      phaseState: 'active',
      phases: {
        requirements: {
          exists: true,
          lastModified: '2026-03-14T09:10:00.000Z',
          content: 'Keep restart recovery obvious.'
        },
        design: {
          exists: false
        },
        tasks: {
          exists: false
        }
      },
      taskSummary: {
        total: 1,
        completed: 0,
        pending: 0,
        inProgress: 1
      },
      pendingApprovalCount: 1,
      activeTask: {
        id: '1.1',
        description: 'Review the requirements copy',
        status: 'in-progress'
      },
      implementationEntries: []
    }
  ],
  pendingApprovals: [
    {
      approvalId: 'approval-1',
      title: 'Review desktop rewrite requirements',
      filePath: '.spec-workflow/specs/desktop-rewrite/requirements.md',
      type: 'document',
      category: 'spec',
      categoryName: 'desktop-rewrite',
      createdAt: '2026-03-14T11:00:00.000Z'
    }
  ]
};

const approvalReview: DesktopApprovalReview = {
  approval: {
    id: 'approval-1',
    title: 'Review desktop rewrite requirements',
    filePath: '.spec-workflow/specs/desktop-rewrite/requirements.md',
    type: 'document',
    status: 'pending',
    createdAt: '2026-03-14T11:00:00.000Z',
    category: 'spec',
    categoryName: 'desktop-rewrite',
    comments: [
      {
        type: 'selection',
        comment: 'Tighten this sentence.',
        timestamp: '2026-03-14T11:15:00.000Z',
        selectedText: 'Keep restart recovery obvious.',
        startOffset: 0,
        endOffset: 30
      }
    ]
  },
  currentContent: 'Keep restart recovery obvious.',
  diff: null
};

describe('ApprovalReviewPanel', () => {
  it('normalizes existing selection comments without ids so inline highlights still render', async () => {
    const { container } = render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    expect(await screen.findByText('Tighten this sentence.')).toBeInTheDocument();
    expect(container.querySelector('.approval-inline-comment')).not.toBeNull();
  });
});
