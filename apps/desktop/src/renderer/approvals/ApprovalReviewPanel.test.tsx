import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      tasks: [
        {
          id: '1.1',
          description: 'Review the requirements copy',
          status: 'in-progress',
          lineNumber: 0,
          indentLevel: 0,
          isHeader: false
        }
      ],
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
  draft: null,
  diff: null
};

describe('ApprovalReviewPanel', () => {
  it('normalizes existing selection comments without ids so inline highlights still render', async () => {
    const { container } = render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalDraft={null}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSaveDraft={vi.fn()}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    expect(await screen.findByText('Tighten this sentence.')).toBeInTheDocument();
    expect(container.querySelector('.approval-inline-comment')).not.toBeNull();
  });

  it('does not render redundant queue meta for document approvals', () => {
    const { container } = render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalDraft={null}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSaveDraft={vi.fn()}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    expect(container.querySelector('.approval-queue-meta')).toBeNull();
  });

  it('shows selected text as plain preview and lets the reviewer remove the comment', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalDraft={null}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSaveDraft={vi.fn()}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    expect(container.querySelector('.approval-comment-selection')).toHaveTextContent(
      'Keep restart recovery obvious.'
    );
    expect(screen.queryByRole('button', { name: 'Keep restart recovery obvious.' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete comment/i })).toHaveTextContent('Remove');

    await user.click(screen.getByRole('button', { name: /Delete comment/i }));

    expect(screen.queryByText('Tighten this sentence.')).not.toBeInTheDocument();
  });

  it('lets the reviewer edit an existing comment and focus its highlighted text from the comments column', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalDraft={null}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSaveDraft={vi.fn()}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    const selectionPreview = container.querySelector('.approval-comment-selection');
    expect(selectionPreview).not.toBeNull();
    await user.click(selectionPreview as HTMLElement);

    expect(container.querySelector('.approval-inline-comment-active')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /Edit comment/i }));

    const commentField = await screen.findByLabelText('Approval comment');
    expect(commentField).toHaveValue('Tighten this sentence.');

    await user.clear(commentField);
    await user.type(commentField, 'Clarify this sentence.');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(screen.getByText('Clarify this sentence.')).toBeInTheDocument();
    expect(screen.queryByText('Tighten this sentence.')).not.toBeInTheDocument();
  });

  it('persists a saved comment immediately instead of waiting for debounce', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();

    render(
      <ApprovalReviewPanel
        approvalActionState={{ status: 'idle' }}
        approvalDraft={null}
        approvalReview={approvalReview}
        approvalReviewError={null}
        isLoadingApprovalReview={false}
        onSaveDraft={onSaveDraft}
        onSelectApproval={vi.fn()}
        onSubmitDecision={vi.fn().mockResolvedValue(undefined)}
        projectWorkspace={projectWorkspace}
        selectedApprovalId="approval-1"
      />
    );

    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    const commentField = await screen.findByLabelText('Approval comment');
    await user.type(commentField, 'Persist this now.');
    onSaveDraft.mockClear();

    await user.click(screen.getByRole('button', { name: 'Save comment' }));

    expect(onSaveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        comments: expect.arrayContaining([
          expect.objectContaining({
            comment: 'Persist this now.',
            type: 'general'
          })
        ])
      })
    );
  });
});
