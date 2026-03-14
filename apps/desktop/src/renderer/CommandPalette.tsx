import { useEffect, useRef } from 'react';

export type CommandPaletteItem = {
  id: string;
  title: string;
  category: string;
  meta?: string | undefined;
  shortcut?: string | undefined;
  onSelect: () => void | Promise<void>;
  keywords?: string[] | undefined;
};

export function CommandPalette(props: {
  isOpen: boolean;
  query: string;
  items: CommandPaletteItem[];
  selectedIndex: number;
  onClose: () => void;
  onMoveSelection: (offset: number) => void;
  onQueryChange: (value: string) => void;
  onSelectItem: (item: CommandPaletteItem) => void;
}) {
  const {
    isOpen,
    query,
    items,
    selectedIndex,
    onClose,
    onMoveSelection,
    onQueryChange,
    onSelectItem
  } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="command-palette-backdrop"
      onClick={() => {
        onClose();
      }}
    >
      <div
        aria-label="Command palette"
        aria-modal="true"
        className="command-palette"
        onClick={(event) => {
          event.stopPropagation();
        }}
        role="dialog"
      >
        <div className="command-search-row">
          <input
            aria-label="Command search"
            className="command-search"
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMoveSelection(1);
                return;
              }

              if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMoveSelection(-1);
                return;
              }

              if (event.key === 'Enter') {
                event.preventDefault();
                const nextItem = items[selectedIndex];
                if (nextItem) {
                  onSelectItem(nextItem);
                }
                return;
              }

              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            }}
            placeholder="Jump to project, spec, approval, or action"
            ref={inputRef}
            spellCheck={false}
            type="text"
            value={query}
          />
          <button
            aria-label="Close command palette"
            className="command-palette-close"
            onClick={() => {
              onClose();
            }}
            type="button"
          >
            Esc
          </button>
        </div>
        {items.length === 0 ? (
          <p className="command-empty">No matching actions.</p>
        ) : (
          <div aria-label="Command results" className="command-list" role="listbox">
            {items.map((item, index) => (
              <button
                aria-label={`${item.category} ${item.title}`}
                aria-selected={index === selectedIndex}
                className={`command-item ${index === selectedIndex ? 'command-item-active' : ''}`}
                key={item.id}
                onClick={() => {
                  onSelectItem(item);
                }}
                role="option"
                type="button"
              >
                <div className="command-item-copy">
                  <div className="command-item-title-row">
                    <span className="command-item-category">{item.category}</span>
                    <strong>{item.title}</strong>
                  </div>
                  {item.meta ? <p className="command-item-meta">{item.meta}</p> : null}
                </div>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
