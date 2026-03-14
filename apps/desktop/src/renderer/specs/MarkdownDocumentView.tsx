import { useMemo } from 'react';
import { renderMarkdownToHtml } from '../markdown.js';

interface MarkdownDocumentViewProps {
  readonly ariaLabel: string;
  readonly content: string;
}

export function MarkdownDocumentView({ ariaLabel, content }: MarkdownDocumentViewProps) {
  const renderedHtml = useMemo(() => renderMarkdownToHtml(content), [content]);

  return (
    <div
      aria-label={ariaLabel}
      className="document-render-surface"
      role="document"
    >
      <div
        className="document-markdown-view approval-markdown-view"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </div>
  );
}
