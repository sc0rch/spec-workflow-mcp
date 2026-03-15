import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownReviewSurface } from './MarkdownReviewSurface.js';

describe('MarkdownReviewSurface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders markdown with syntax-highlighted code blocks', async () => {
    render(
      <MarkdownReviewSurface
        activeCommentId={null}
        comments={[]}
        content={'# Requirements\n\nKeep restart recovery obvious.\n\n```ts\nconst ready = true;\n```'}
        onRequestSelectionComment={vi.fn()}
        onSelectComment={vi.fn()}
      />
    );

    expect(await screen.findByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Keep restart recovery obvious.')).toBeInTheDocument();

    const codeBlock = document.querySelector('.approval-markdown-view pre.hljs code');
    expect(codeBlock).not.toBeNull();
    expect(codeBlock).toHaveTextContent('const ready = true;');
  });

  it('shows a floating add comment action for selected text', async () => {
    const user = userEvent.setup();
    const onRequestSelectionComment = vi.fn();
    const removeAllRanges = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    render(
      <MarkdownReviewSurface
        activeCommentId={null}
        comments={[]}
        content={'# Requirements\n\nKeep restart recovery obvious.'}
        onRequestSelectionComment={onRequestSelectionComment}
        onSelectComment={vi.fn()}
      />
    );

    expect(screen.getByRole('document', { name: 'Approval review content' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add comment' })).not.toBeInTheDocument();

    const selectedParagraph = await screen.findByText('Keep restart recovery obvious.');
    const textNode = selectedParagraph.firstChild;
    expect(textNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(textNode as Text, 0);
    range.setEnd(textNode as Text, 4);
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 100,
        right: 220,
        bottom: 120,
        left: 180,
        width: 40,
        height: 20,
        x: 180,
        y: 100,
        toJSON: () => ({})
      })
    });

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'Keep',
      getRangeAt: () => range,
      removeAllRanges
    } as unknown as Selection);

    const reviewSurface = document.querySelector('.approval-render-surface');
    expect(reviewSurface).not.toBeNull();
    fireEvent.mouseUp(reviewSurface as HTMLElement);
    fireEvent(document, new Event('selectionchange'));

    expect(await screen.findByRole('button', { name: 'Add comment' })).toBeEnabled();

    await user.click(await screen.findByRole('button', { name: 'Add comment' }));

    expect(onRequestSelectionComment).toHaveBeenCalledTimes(1);
    const selection = onRequestSelectionComment.mock.calls[0]?.[0];
    expect(selection.selectedText).toBe('Keep');
    expect(selection.startOffset).toEqual(expect.any(Number));
    expect(selection.endOffset).toEqual(expect.any(Number));
    expect(selection.endOffset).toBeGreaterThan(selection.startOffset);
    expect(removeAllRanges).toHaveBeenCalledTimes(1);
  });

  it('updates selection comment affordance from keyboard-driven selection changes', async () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    render(
      <MarkdownReviewSurface
        activeCommentId={null}
        comments={[]}
        content={'# Requirements\n\nKeep restart recovery obvious.'}
        onRequestSelectionComment={vi.fn()}
        onSelectComment={vi.fn()}
      />
    );

    const selectedParagraph = await screen.findByText('Keep restart recovery obvious.');
    const textNode = selectedParagraph.firstChild;
    expect(textNode).not.toBeNull();

    const range = document.createRange();
    range.setStart(textNode as Text, 0);
    range.setEnd(textNode as Text, 7);
    Object.defineProperty(range, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 120,
        right: 210,
        bottom: 138,
        left: 160,
        width: 50,
        height: 18,
        x: 160,
        y: 120,
        toJSON: () => ({})
      })
    });

    vi.spyOn(window, 'getSelection').mockReturnValue({
      rangeCount: 1,
      isCollapsed: false,
      toString: () => 'Keep re',
      getRangeAt: () => range,
      removeAllRanges: vi.fn()
    } as unknown as Selection);

    const reviewSurface = screen.getByRole('document', { name: 'Approval review content' });
    reviewSurface.focus();
    fireEvent.keyUp(reviewSurface, { key: 'ArrowRight', shiftKey: true });
    document.dispatchEvent(new Event('selectionchange'));

    expect(await screen.findByRole('button', { name: 'Add comment' })).toBeEnabled();
  });

  it('highlights commented text inside rendered markdown', async () => {
    render(
      <MarkdownReviewSurface
        activeCommentId="comment-1"
        comments={[
          {
            id: 'comment-1',
            type: 'selection',
            comment: 'Tighten this sentence.',
            selectedText: 'Keep restart recovery obvious.',
            startOffset: 0,
            endOffset: 30,
            timestamp: '2026-03-16T10:00:00.000Z'
          }
        ]}
        content={'Keep restart recovery obvious.'}
        onRequestSelectionComment={vi.fn()}
        onSelectComment={vi.fn()}
      />
    );

    const highlight = await screen.findByTitle('Tighten this sentence.');
    expect(highlight).toHaveClass('approval-inline-comment-active');
    expect(highlight).toHaveTextContent('Keep restart recovery obvious.');
  });
});
