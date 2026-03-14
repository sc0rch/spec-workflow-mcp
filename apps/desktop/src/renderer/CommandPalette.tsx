import { useEffect, useId, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const listboxId = useId();
  const activeOptionId = items[selectedIndex] ? `${listboxId}-option-${selectedIndex}` : undefined;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previousFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    inputRef.current?.focus();
    inputRef.current?.select();

    return () => {
      previousFocusedElementRef.current?.focus();
      previousFocusedElementRef.current = null;
    };
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
        aria-labelledby={titleId}
        aria-modal="true"
        className="command-palette"
        onClick={(event) => {
          event.stopPropagation();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
            return;
          }

          if (event.key !== 'Tab') {
            return;
          }

          const focusableElements = getFocusableElements(dialogRef.current);
          if (focusableElements.length === 0) {
            return;
          }

          const activeElement = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];

          if (!firstFocusable || !lastFocusable || !activeElement) {
            return;
          }

          if (event.shiftKey && activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
            return;
          }

          if (!event.shiftKey && activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <h2 className="sr-only" id={titleId}>Command palette</h2>
        <div className="command-search-row">
          <input
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={true}
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
            role="combobox"
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
          <div aria-label="Command results" className="command-list" id={listboxId} role="listbox">
            {items.map((item, index) => (
              <div
                aria-label={`${item.category} ${item.title}`}
                aria-selected={index === selectedIndex}
                className={`command-item ${index === selectedIndex ? 'command-item-active' : ''}`}
                id={`${listboxId}-option-${index}`}
                key={item.id}
                onClick={() => {
                  onSelectItem(item);
                }}
                role="option"
              >
                <div className="command-item-copy">
                  <div className="command-item-title-row">
                    <span className="command-item-category">{item.category}</span>
                    <strong>{item.title}</strong>
                  </div>
                  {item.meta ? <p className="command-item-meta">{item.meta}</p> : null}
                </div>
                {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}
