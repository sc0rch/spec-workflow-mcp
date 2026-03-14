import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownDocumentView } from './MarkdownDocumentView.js';

describe('MarkdownDocumentView', () => {
  it('renders markdown with syntax-highlighted code blocks in read-only mode', async () => {
    render(
      <MarkdownDocumentView
        ariaLabel="Requirements document"
        content={'# Requirements\n\nKeep restart recovery obvious.\n\n```ts\nconst ready = true;\n```'}
      />
    );

    expect(await screen.findByRole('document', { name: 'Requirements document' })).toBeInTheDocument();
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('Keep restart recovery obvious.')).toBeInTheDocument();

    const codeBlock = document.querySelector('.document-markdown-view pre.hljs code');
    expect(codeBlock).not.toBeNull();
    expect(codeBlock).toHaveTextContent('const ready = true;');
  });
});
