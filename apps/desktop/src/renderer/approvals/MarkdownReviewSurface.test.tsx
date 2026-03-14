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

    await user.click(await screen.findByRole('button', { name: 'Add comment' }));

    expect(onRequestSelectionComment).toHaveBeenCalledTimes(1);
    const selection = onRequestSelectionComment.mock.calls[0]?.[0];
    expect(selection.selectedText).toBe('Keep');
    expect(selection.startOffset).toEqual(expect.any(Number));
    expect(selection.endOffset).toEqual(expect.any(Number));
    expect(selection.endOffset).toBeGreaterThan(selection.startOffset);
    expect(removeAllRanges).toHaveBeenCalledTimes(1);
  });
});
