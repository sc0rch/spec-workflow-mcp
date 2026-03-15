import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { DesktopApprovalComment } from '../../shared/desktop-api.js';
import { renderMarkdownToHtml } from '../markdown.js';

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
  const renderedHtml = useMemo(() => renderMarkdownToHtml(content), [content]);

  const refreshSelectionDraft = useEffectEvent(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    setSelectionDraft(getSelectionDraft(container));
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    container.innerHTML = renderedHtml;
    applyCommentHighlights(container, comments, activeCommentId);

    if (activeCommentId) {
      const activeCommentElement = container.querySelector<HTMLElement>(
        `[data-comment-id="${activeCommentId}"]`
      );
      if (activeCommentElement && typeof activeCommentElement.scrollIntoView === 'function') {
        activeCommentElement.scrollIntoView({
          block: 'center'
        });
      }
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
    const handleSelectionChange = () => {
      window.requestAnimationFrame(() => {
        refreshSelectionDraft();
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

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
      refreshSelectionDraft();
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
      <div
        aria-label="Approval review content"
        className="approval-render-surface"
        onKeyUp={handlePointerUp}
        onMouseUp={handlePointerUp}
        role="document"
        tabIndex={0}
      >
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

  return offsetRange.cloneContents().textContent?.length ?? 0;
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
    const highlightRange = resolveHighlightRange(container, comment);
    if (!highlightRange) {
      continue;
    }

    wrapTextRange(
      container,
      highlightRange.startOffset,
      highlightRange.endOffset,
      comment.id,
      comment.comment,
      comment.id === activeCommentId
    );
  }
}

function resolveHighlightRange(
  container: HTMLElement,
  comment: DesktopApprovalComment & {
    id: string;
    startOffset: number;
    endOffset: number;
  }
): { startOffset: number; endOffset: number } | null {
  const contentText = container.textContent ?? '';
  const directText = contentText.slice(comment.startOffset, comment.endOffset);
  if (
    directText.length > 0
    && (!comment.selectedText || normalizeText(directText) === normalizeText(comment.selectedText))
  ) {
    return {
      startOffset: comment.startOffset,
      endOffset: comment.endOffset
    };
  }

  if (!comment.selectedText) {
    return null;
  }

  const normalizedNeedle = normalizeText(comment.selectedText);
  if (normalizedNeedle.length === 0) {
    return null;
  }

  const normalizedContent = normalizeTextWithMap(contentText);
  const fallbackIndex = normalizedContent.normalizedText.indexOf(normalizedNeedle);
  if (fallbackIndex === -1) {
    return null;
  }

  const rawStart = normalizedContent.rawIndexMap[fallbackIndex];
  const rawEnd = normalizedContent.rawIndexMap[fallbackIndex + normalizedNeedle.length - 1];
  if (rawStart === undefined || rawEnd === undefined) {
    return null;
  }

  return {
    startOffset: rawStart,
    endOffset: rawEnd + 1
  };
}

function wrapTextRange(
  container: HTMLElement,
  startOffset: number,
  endOffset: number,
  commentId: string,
  commentText: string,
  isActive: boolean
): void {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  let currentOffset = 0;

  for (const node of textNodes) {
    const nextOffset = currentOffset + node.data.length;
    const overlapStart = Math.max(startOffset, currentOffset);
    const overlapEnd = Math.min(endOffset, nextOffset);

    if (overlapStart < overlapEnd) {
      const relativeStart = overlapStart - currentOffset;
      const relativeEnd = overlapEnd - currentOffset;
      let targetNode = node;

      if (relativeStart > 0) {
        targetNode = targetNode.splitText(relativeStart);
      }

      if (relativeEnd - relativeStart < targetNode.data.length) {
        targetNode.splitText(relativeEnd - relativeStart);
      }

      const marker = document.createElement('mark');
      marker.className = `approval-inline-comment${isActive ? ' approval-inline-comment-active' : ''}`;
      marker.dataset.commentId = commentId;
      marker.title = commentText;
      targetNode.parentNode?.replaceChild(marker, targetNode);
      marker.appendChild(targetNode);
    }

    currentOffset = nextOffset;
  }
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTextWithMap(value: string): {
  normalizedText: string;
  rawIndexMap: number[];
} {
  let normalizedText = '';
  const rawIndexMap: number[] = [];
  let pendingSpace = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!character) {
      continue;
    }

    if (/\s/.test(character)) {
      pendingSpace = normalizedText.length > 0;
      continue;
    }

    if (pendingSpace) {
      normalizedText += ' ';
      rawIndexMap.push(index);
      pendingSpace = false;
    }

    normalizedText += character;
    rawIndexMap.push(index);
  }

  return {
    normalizedText: normalizedText.trimEnd(),
    rawIndexMap
  };
}
