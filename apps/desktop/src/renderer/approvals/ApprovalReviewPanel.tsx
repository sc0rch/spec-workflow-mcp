import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import type {
  DesktopApprovalComment,
  DesktopApprovalComposerDraft,
  DesktopApprovalDraft,
  DesktopApprovalDraftInput,
  DesktopApprovalReview,
  DesktopProjectWorkspace
} from '../../shared/desktop-api.js';
import {
  MarkdownReviewSurface,
  type ApprovalSelectionDraft
} from './MarkdownReviewSurface.js';
import { getApprovalDisplayTitle } from './approval-display.js';

interface ApprovalReviewPanelProps {
  readonly projectWorkspace: DesktopProjectWorkspace;
  readonly selectedApprovalId: string | null;
  readonly approvalReview: DesktopApprovalReview | null;
  readonly approvalDraft: DesktopApprovalDraft | null;
  readonly isLoadingApprovalReview: boolean;
  readonly approvalReviewError: string | null;
  readonly approvalActionState: {
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string | undefined;
  };
  readonly onSelectApproval: (approvalId: string) => void;
  readonly onSubmitDecision: (
    action: 'approve' | 'reject',
    comments: DesktopApprovalComment[]
  ) => Promise<void>;
  readonly onSaveDraft: (draft: DesktopApprovalDraftInput | null) => void;
}

type ComposerState =
  | { mode: 'general'; editingCommentId?: string | undefined }
  | ({ mode: 'selection'; editingCommentId?: string | undefined } & ApprovalSelectionDraft)
  | null;

export function ApprovalReviewPanel({
  projectWorkspace,
  selectedApprovalId,
  approvalReview,
  approvalDraft,
  isLoadingApprovalReview,
  approvalReviewError,
  approvalActionState,
  onSelectApproval,
  onSubmitDecision,
  onSaveDraft
}: ApprovalReviewPanelProps) {
  const [comments, setComments] = useState<DesktopApprovalComment[]>([]);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [composerState, setComposerState] = useState<ComposerState>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<DesktopApprovalDraftInput | null>(null);

  const persistDraft = useEffectEvent((nextDraft: DesktopApprovalDraftInput | null, immediate = false) => {
    pendingDraftRef.current = nextDraft;

    if (saveDraftTimeoutRef.current) {
      clearTimeout(saveDraftTimeoutRef.current);
      saveDraftTimeoutRef.current = null;
    }

    if (immediate) {
      onSaveDraft(nextDraft);
      return;
    }

    saveDraftTimeoutRef.current = setTimeout(() => {
      onSaveDraft(nextDraft);
      saveDraftTimeoutRef.current = null;
    }, 300);
  });

  const focusComment = (commentId: string) => {
    setActiveCommentId((currentCommentId) => {
      if (currentCommentId !== commentId) {
        return commentId;
      }

      window.requestAnimationFrame(() => {
        setActiveCommentId(commentId);
      });
      return null;
    });
  };

  useEffect(() => {
    setComments(
      (approvalDraft?.comments ?? approvalReview?.approval.comments ?? []).map((comment, index) =>
        ensureCommentId(comment, index)
      )
    );
    setComposerState(createComposerState(approvalDraft?.composer));
    setCommentDraft(approvalDraft?.composer?.commentDraft ?? '');
    setActiveCommentId(approvalDraft?.composer?.editingCommentId ?? null);
  }, [approvalDraft, approvalReview?.approval.id]);

  useEffect(() => {
    if (!approvalReview) {
      return undefined;
    }

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
        saveDraftTimeoutRef.current = null;
        onSaveDraft(pendingDraftRef.current);
      }
    };
  }, [approvalReview, onSaveDraft]);

  useEffect(() => {
    if (!approvalReview) {
      return undefined;
    }

    const nextDraft = createApprovalDraftInput(comments, composerState, commentDraft);
    persistDraft(nextDraft);

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
        saveDraftTimeoutRef.current = null;
      }
    };
  }, [approvalReview, commentDraft, comments, composerState, persistDraft]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || composerState) {
        return;
      }

      const isModifierKey = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      const hasComments = comments.length > 0;
      if (!isModifierKey || approvalActionState.status === 'saving') {
        return;
      }

      if (!hasComments && event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void onSubmitDecision('approve', comments);
        return;
      }

      if (
        event.shiftKey
        && ((hasComments && (key === 'x' || key === 'r')) || (!hasComments && key === 'x'))
      ) {
        event.preventDefault();
        void onSubmitDecision('reject', comments);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [approvalActionState.status, comments, composerState, onSubmitDecision]);

  if (projectWorkspace.pendingApprovals.length === 0) {
    return (
      <article className="panel workspace-message-card workspace-span-2">
        <h2>Approvals</h2>
        <p className="panel-copy">Nothing is waiting for review right now.</p>
      </article>
    );
  }

  const selectedApproval = projectWorkspace.pendingApprovals.find(
    (approval) => approval.approvalId === selectedApprovalId
  ) ?? projectWorkspace.pendingApprovals[0];
  const relatedSpec = selectedApproval.category === 'spec'
    ? projectWorkspace.specs.find((spec) => spec.name === selectedApproval.categoryName)
    : null;
  const hasComments = comments.length > 0;
  const isSavingDecision = approvalActionState.status === 'saving';
  const isMarkdownReview = approvalReview?.currentContent
    ? isMarkdownFile(selectedApproval.filePath)
    : false;

  return (
    <article className="workspace-card workspace-span-2 workspace-detail-card approval-workspace workspace-mode workspace-mode-approvals">
      <div className="section-header">
        <h2>Approvals</h2>
      </div>

      <div aria-label="Approval queue" className="approval-queue" role="list">
        {projectWorkspace.pendingApprovals.map((approval) => (
          <button
            aria-pressed={selectedApproval.approvalId === approval.approvalId}
            className={`approval-queue-item ${selectedApproval.approvalId === approval.approvalId ? 'approval-queue-item-active' : ''}`}
            key={approval.approvalId}
            onClick={() => {
              onSelectApproval(approval.approvalId);
            }}
            type="button"
          >
            <strong>{getApprovalDisplayTitle(approval)}</strong>
            {approval.type === 'action' ? (
              <span className="approval-queue-meta">
                {`${formatDisplayName(approval.categoryName)} · action`}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="approval-layout">
        <article className="approval-review-shell">
          <div className="section-header">
            <div>
              <h2>{getApprovalDisplayTitle(selectedApproval)}</h2>
              <p className="approval-meta">
                {selectedApproval.filePath} · {formatDisplayName(selectedApproval.categoryName)} · {formatTimestamp(selectedApproval.createdAt, 'Unknown time')}
              </p>
            </div>
          </div>

          <details className="review-context">
            <summary>
              {relatedSpec
                ? `${relatedSpec.displayName} · ${formatDisplayName(relatedSpec.phaseState)}`
                : 'Spec context unavailable'}
            </summary>
            {relatedSpec ? (
              <ul className="focus-list">
                <li>
                  {relatedSpec.activeTask
                    ? `Current task: ${relatedSpec.activeTask.id} ${relatedSpec.activeTask.description}.`
                    : 'No task is in progress for this spec yet.'}
                </li>
                <li>
                  {relatedSpec.nextTask
                    ? `Next task: ${relatedSpec.nextTask.id} ${relatedSpec.nextTask.description}.`
                    : 'No task is queued after the current work.'}
                </li>
                <li>
                  {relatedSpec.latestImplementation
                    ? `Latest implementation log: ${relatedSpec.latestImplementation.summary}.`
                    : 'No implementation logs recorded for this spec yet.'}
                </li>
              </ul>
            ) : (
              <p className="panel-copy">
                This review points to a file only, so spec context is not available here.
              </p>
            )}
          </details>

          {renderReviewBody({
            approvalReview,
            isLoadingApprovalReview,
            approvalReviewError,
            isMarkdownReview,
            comments,
            activeCommentId,
            onRequestSelectionComment: (selection) => {
              setComposerState({ mode: 'selection', ...selection });
              setCommentDraft('');
            },
            onSelectComment: focusComment
          })}
        </article>

        <aside className="approval-comments-panel">
          <div className="section-header">
            <h3>Comments</h3>
            <button
              className="secondary-action"
              onClick={() => {
                setComposerState({ mode: 'general' });
                setCommentDraft('');
              }}
              type="button"
            >
              Add comment
            </button>
          </div>

          {composerState ? (
            <section className="approval-comment-composer">
              <div className="section-header">
                <h3>{composerState.mode === 'selection' ? 'Selection comment' : 'General comment'}</h3>
                <button
                  className="secondary-action"
                  onClick={() => {
                    setComposerState(null);
                    setCommentDraft('');
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
              {composerState.mode === 'selection' ? (
                <blockquote className="approval-comment-quote">{composerState.selectedText}</blockquote>
              ) : null}
              <textarea
                aria-label="Approval comment"
                className="approval-note"
                onChange={(event) => {
                  setCommentDraft(event.target.value);
                }}
                placeholder="Explain what should change."
                rows={4}
                spellCheck={false}
                value={commentDraft}
              />
              <div className="action-row">
                <button
                  className="primary-action"
                  disabled={commentDraft.trim().length === 0}
                  onClick={() => {
                    const nextComment = createComment(commentDraft, composerState);
                    const nextComments = !composerState.editingCommentId
                      ? [...comments, nextComment]
                      : comments.map((currentComment) =>
                          currentComment.id === composerState.editingCommentId
                            ? {
                                ...nextComment,
                                id: currentComment.id,
                                timestamp: currentComment.timestamp
                              }
                            : currentComment
                        );
                    const focusedCommentId = composerState.editingCommentId ?? nextComment.id ?? null;
                    setComments(nextComments);
                    if (focusedCommentId) {
                      focusComment(focusedCommentId);
                    }
                    setComposerState(null);
                    setCommentDraft('');
                    persistDraft(createApprovalDraftInput(nextComments, null, ''), true);
                  }}
                  type="button"
                >
                  {composerState.editingCommentId ? 'Save changes' : 'Save comment'}
                </button>
              </div>
            </section>
          ) : null}

          <div className="approval-comments-list">
            {comments.length === 0 ? (
              <div className="approval-comments-empty">
                <p className="panel-copy">No review comments yet.</p>
                {isMarkdownReview ? (
                  <p className="panel-copy approval-comments-helper">
                    Select text, then add a comment.
                  </p>
                ) : null}
              </div>
            ) : (
              comments.map((comment) => (
                <article
                  aria-pressed={comment.type === 'selection' && comment.id ? activeCommentId === comment.id : undefined}
                  className={`approval-comment-card ${activeCommentId === comment.id ? 'approval-comment-card-active' : ''} ${comment.type === 'selection' && comment.id ? 'approval-comment-card-selectable' : ''}`}
                  key={comment.id ?? comment.timestamp}
                  onClick={() => {
                    if (comment.type === 'selection' && comment.id) {
                      focusComment(comment.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      comment.type === 'selection'
                      && comment.id
                      && (event.key === 'Enter' || event.key === ' ')
                    ) {
                      event.preventDefault();
                      focusComment(comment.id);
                    }
                  }}
                  role={comment.type === 'selection' && comment.id ? 'button' : undefined}
                  tabIndex={comment.type === 'selection' && comment.id ? 0 : undefined}
                >
                  <div className="section-header">
                    <span className="queue-item-kind">
                      {comment.type === 'selection' ? 'Selection' : 'General'}
                    </span>
                    <div className="approval-comment-actions">
                      <button
                        aria-label={`Edit comment ${comment.id ?? comment.timestamp}`}
                        className="secondary-action approval-comment-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          setComposerState(
                            comment.type === 'selection'
                              && typeof comment.startOffset === 'number'
                              && typeof comment.endOffset === 'number'
                              && comment.selectedText
                              ? {
                                  mode: 'selection',
                                  editingCommentId: comment.id,
                                  selectedText: comment.selectedText,
                                  startOffset: comment.startOffset,
                                  endOffset: comment.endOffset
                                }
                              : {
                                  mode: 'general',
                                  editingCommentId: comment.id
                                }
                          );
                          setCommentDraft(comment.comment);
                          if (comment.id) {
                            focusComment(comment.id);
                          }
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        aria-label={`Delete comment ${comment.id ?? comment.timestamp}`}
                        className="secondary-action approval-comment-delete"
                        onClick={(event) => {
                          event.stopPropagation();
                          const nextComments = comments.filter(
                            (currentComment) => currentComment !== comment
                          );
                          setComments(nextComments);
                          if (activeCommentId === comment.id) {
                            setActiveCommentId(null);
                          }
                          persistDraft(
                            createApprovalDraftInput(nextComments, composerState, commentDraft),
                            true
                          );
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  {comment.type === 'selection' && comment.selectedText ? (
                    <p className="approval-comment-selection">
                      {comment.selectedText}
                    </p>
                  ) : null}
                  <p className="stack-card-copy">{comment.comment}</p>
                </article>
              ))
            )}
          </div>

          <section className="approval-sidebar-actions">
            {approvalActionState.message ? (
              <p className="panel-copy approval-action-status">{approvalActionState.message}</p>
            ) : null}
            <div className="action-row approval-action-row">
              {hasComments ? (
                <button
                  className="primary-action"
                  disabled={isSavingDecision}
                  onClick={() => {
                    void onSubmitDecision('reject', comments);
                  }}
                  type="button"
                >
                  {isSavingDecision ? 'Saving decision...' : 'Request revisions'}
                </button>
              ) : (
                <>
                  <button
                    className="primary-action"
                    disabled={isSavingDecision}
                    onClick={() => {
                      void onSubmitDecision('approve', comments);
                    }}
                    type="button"
                  >
                    {isSavingDecision ? 'Saving decision...' : 'Approve'}
                  </button>
                  <button
                    className="secondary-action"
                    disabled={isSavingDecision}
                    onClick={() => {
                      void onSubmitDecision('reject', comments);
                    }}
                    type="button"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>
    </article>
  );
}

function renderReviewBody(options: {
  approvalReview: DesktopApprovalReview | null;
  isLoadingApprovalReview: boolean;
  approvalReviewError: string | null;
  isMarkdownReview: boolean;
  comments: DesktopApprovalComment[];
  activeCommentId: string | null;
  onRequestSelectionComment: (selection: ApprovalSelectionDraft) => void;
  onSelectComment: (commentId: string) => void;
}): ReactNode {
  const {
    approvalReview,
    isLoadingApprovalReview,
    approvalReviewError,
    isMarkdownReview,
    comments,
    activeCommentId,
    onRequestSelectionComment,
    onSelectComment
  } = options;

  if (isLoadingApprovalReview) {
    return <p className="panel-copy">Loading review content...</p>;
  }

  if (approvalReviewError) {
    return <p className="issue issue-error">{approvalReviewError}</p>;
  }

  if (!approvalReview) {
    return <p className="panel-copy">No review content available.</p>;
  }

  if (approvalReview.currentContent && isMarkdownReview) {
    return (
      <MarkdownReviewSurface
        activeCommentId={activeCommentId}
        comments={comments}
        content={approvalReview.currentContent}
        onRequestSelectionComment={onRequestSelectionComment}
        onSelectComment={onSelectComment}
      />
    );
  }

  if (approvalReview.diff) {
    return (
      <pre className="diff-view" data-testid="approval-diff">
        {formatDiffPreview(approvalReview.diff)}
      </pre>
    );
  }

  return (
    <pre className="phase-content">{approvalReview.currentContent ?? 'No review content available.'}</pre>
  );
}

function createComment(commentText: string, composerState: Exclude<ComposerState, null>): DesktopApprovalComment {
  const baseComment: DesktopApprovalComment = {
    id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: composerState.mode,
    comment: commentText.trim(),
    timestamp: new Date().toISOString()
  };

  if (composerState.mode === 'selection') {
    return {
      ...baseComment,
      selectedText: composerState.selectedText,
      startOffset: composerState.startOffset,
      endOffset: composerState.endOffset
    };
  }

  return baseComment;
}

function createComposerState(
  composer: DesktopApprovalComposerDraft | undefined
): ComposerState {
  if (!composer) {
    return null;
  }

  if (
    composer.mode === 'selection'
    && composer.selectedText
    && typeof composer.startOffset === 'number'
    && typeof composer.endOffset === 'number'
  ) {
    return {
      mode: 'selection',
      editingCommentId: composer.editingCommentId,
      selectedText: composer.selectedText,
      startOffset: composer.startOffset,
      endOffset: composer.endOffset
    };
  }

  return {
    mode: 'general',
    editingCommentId: composer.editingCommentId
  };
}

function createApprovalDraftInput(
  comments: DesktopApprovalComment[],
  composerState: ComposerState,
  commentDraft: string
): DesktopApprovalDraftInput | null {
  const composer = createComposerDraft(composerState, commentDraft);
  if (comments.length === 0 && !composer) {
    return null;
  }

  return {
    comments,
    ...(composer ? { composer } : {})
  };
}

function createComposerDraft(
  composerState: ComposerState,
  commentDraft: string
): DesktopApprovalComposerDraft | undefined {
  if (!composerState) {
    return undefined;
  }

  if (composerState.mode === 'selection') {
    return {
      mode: 'selection',
      commentDraft,
      ...(composerState.editingCommentId ? { editingCommentId: composerState.editingCommentId } : {}),
      selectedText: composerState.selectedText,
      startOffset: composerState.startOffset,
      endOffset: composerState.endOffset
    };
  }

  if (!composerState.editingCommentId && commentDraft.trim().length === 0) {
    return undefined;
  }

  return {
    mode: 'general',
    commentDraft,
    ...(composerState.editingCommentId ? { editingCommentId: composerState.editingCommentId } : {})
  };
}

function ensureCommentId(comment: DesktopApprovalComment, index: number): DesktopApprovalComment {
  if (comment.id) {
    return comment;
  }

  return {
    ...comment,
    id: `existing-comment-${comment.timestamp}-${index}`
  };
}

function isMarkdownFile(filePath: string): boolean {
  return /\.mdx?$/i.test(filePath);
}

function formatDisplayName(value: string): string {
  return value
    .split('-')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function formatTimestamp(value: string | null, fallback: string): string {
  if (!value) {
    return fallback;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatDiffPreview(diff: NonNullable<DesktopApprovalReview['diff']>): string {
  return diff.chunks
    .flatMap((chunk) => chunk.lines)
    .map((line) => {
      const prefix = line.type === 'add'
        ? '+'
        : line.type === 'delete'
          ? '-'
          : ' ';
      return `${prefix} ${line.content}`;
    })
    .join('\n');
}
