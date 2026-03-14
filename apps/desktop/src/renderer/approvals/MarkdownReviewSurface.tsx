import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import type { DesktopApprovalComment } from '../../shared/desktop-api.js';

export interface ApprovalSelectionDraft {
  readonly selectedText: string;
  readonly startOffset: number;
  readonly endOffset: number;
}

interface MarkdownReviewSurfaceProps {
  readonly content: string;
  readonly comments: DesktopApprovalComment[];
  readonly activeCommentId: string | null;
  readonly onRequestSelectionComment: (selection: ApprovalSelectionDraft) => void;
  readonly onSelectComment: (commentId: string) => void;
}

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return `<pre class="hljs"><code>${hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`;
    }

    return `<pre class="hljs"><code>${markdown.utils.escapeHtml(code)}</code></pre>`;
  }
});

export function MarkdownReviewSurface({
  content,
  comments,
  activeCommentId,
  onRequestSelectionComment,
  onSelectComment
}: MarkdownReviewSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<(ApprovalSelectionDraft & {
    top: number;
    left: number;
  }) | null>(null);
  const renderedHtml = useMemo(() => markdown.render(content), [content]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.innerHTML = renderedHtml;
    applyCommentHighlights(container, comments, activeCommentId);

    if (activeCommentId) {
      container.querySelector<HTMLElement>(`[data-comment-id="${activeCommentId}"]`)?.scrollIntoView({
        block: 'center'
      });
    }
  }, [activeCommentId, comments, renderedHtml]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const annotated = target.closest<HTMLElement>('[data-comment-id]');
      if (!annotated) {
        return;
      }

      const commentId = annotated.dataset.commentId;
      if (commentId) {
        onSelectComment(commentId);
      }
    };

    container.addEventListener('click', handleClick);
    return () => {
      container.removeEventListener('click', handleClick);
    };
  }, [onSelectComment]);

  useEffect(() => {
    const clearSelectionDraft = () => {
      setSelectionDraft(null);
    };

    window.addEventListener('scroll', clearSelectionDraft, true);
    return () => {
      window.removeEventListener('scroll', clearSelectionDraft, true);
    };
  }, []);

  const handlePointerUp = () => {
    window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const nextDraft = getSelectionDraft(container);
      setSelectionDraft(nextDraft);
    });
  };

  const handleAddComment = () => {
    if (!selectionDraft) {
      return;
    }

    onRequestSelectionComment(selectionDraft);
    setSelectionDraft(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div className="approval-markdown-shell">
      <div className="approval-review-toolbar">
        <p className="helper-copy">Select text to comment on a specific passage.</p>
      </div>
      <div className="approval-render-surface" onMouseUp={handlePointerUp}>
        <div className="approval-markdown-view" ref={containerRef} />
      </div>
      {selectionDraft ? (
        <button
          className="primary-action approval-selection-button"
          onClick={handleAddComment}
          style={{ top: selectionDraft.top, left: selectionDraft.left }}
          type="button"
        >
          Add comment
        </button>
      ) : null}
    </div>
  );
}

function getSelectionDraft(container: HTMLElement): (ApprovalSelectionDraft & {
  top: number;
  left: number;
}) | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const selectedText = selection.toString().trim();
  if (selectedText.length === 0) {
    return null;
  }

  const startOffset = getRangeOffset(container, range, 'start');
  const endOffset = getRangeOffset(container, range, 'end');
  if (startOffset === endOffset) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  const buttonWidth = 132;
  const margin = 12;

  return {
    selectedText,
    startOffset,
    endOffset,
    top: Math.max(rect.top - 44, margin),
    left: Math.min(rect.right + 8, window.innerWidth - buttonWidth - margin)
  };
}

function getRangeOffset(
  container: HTMLElement,
  range: Range,
  edge: 'start' | 'end'
): number {
  const offsetRange = document.createRange();
  offsetRange.selectNodeContents(container);

  if (edge === 'start') {
    offsetRange.setEnd(range.startContainer, range.startOffset);
  } else {
    offsetRange.setEnd(range.endContainer, range.endOffset);
  }

  return offsetRange.toString().length;
}

function applyCommentHighlights(
  container: HTMLElement,
  comments: DesktopApprovalComment[],
  activeCommentId: string | null
): void {
  const highlightableComments = comments
    .filter(
      (comment): comment is DesktopApprovalComment & {
        id: string;
        startOffset: number;
        endOffset: number;
      } =>
        comment.type === 'selection' &&
        typeof comment.id === 'string' &&
        typeof comment.startOffset === 'number' &&
        typeof comment.endOffset === 'number' &&
        comment.endOffset > comment.startOffset
    )
    .sort((left, right) => right.startOffset - left.startOffset);

  for (const comment of highlightableComments) {
    const range = createContentRange(container, comment.startOffset, comment.endOffset);
    if (!range) {
      continue;
    }

    const marker = document.createElement('mark');
    marker.className = `approval-inline-comment${comment.id === activeCommentId ? ' approval-inline-comment-active' : ''}`;
    marker.dataset.commentId = comment.id;
    marker.title = comment.comment;

    try {
      range.surroundContents(marker);
    } catch {
      // Ignore invalid or overlapping ranges.
    }
  }
}

function createContentRange(
  container: HTMLElement,
  startOffset: number,
  endOffset: number
): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let currentOffset = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startNodeOffset = 0;
  let endNodeOffset = 0;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const nextOffset = currentOffset + node.data.length;

    if (!startNode && startOffset >= currentOffset && startOffset <= nextOffset) {
      startNode = node;
      startNodeOffset = startOffset - currentOffset;
    }

    if (!endNode && endOffset >= currentOffset && endOffset <= nextOffset) {
      endNode = node;
      endNodeOffset = endOffset - currentOffset;
      break;
    }

    currentOffset = nextOffset;
  }

  if (!startNode || !endNode) {
    return null;
  }

  range.setStart(startNode, startNodeOffset);
  range.setEnd(endNode, endNodeOffset);
  return range;
}
