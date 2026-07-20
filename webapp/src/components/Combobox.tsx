import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

interface ComboboxProps<T> {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  /** Extra trailing option (e.g. "Add manually →") rendered after the matched items. */
  footer?: { label: string; onSelect: () => void };
}

/** Keyboard-accessible search combobox: arrow-nav, Enter to select, Escape to close, ARIA combobox/listbox/option roles. */
export function Combobox<T>({
  id, value, onChange, placeholder, open, onOpenChange, items, getKey, renderItem, onSelect, footer,
}: ComboboxProps<T>) {
  const listboxId = useId();
  const [activeIndex, setActiveIndex] = useState(-1);
  const optionCount = items.length + (footer ? 1 : 0);

  function commitIndex(i: number) {
    if (i < 0 || i >= optionCount) return;
    if (i < items.length) onSelect(items[i]);
    else footer?.onSelect();
    onOpenChange(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown') onOpenChange(true);
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, optionCount - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (activeIndex >= 0) { e.preventDefault(); commitIndex(activeIndex); } }
    else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false); setActiveIndex(-1); }
  }

  const showList = open && optionCount > 0;

  return (
    <>
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); onOpenChange(true); setActiveIndex(-1); }}
        onFocus={() => onOpenChange(true)}
        onBlur={() => setTimeout(() => onOpenChange(false), 150)}
        onKeyDown={handleKeyDown}
      />
      {showList && (
        <ul className="exercise-dropdown" role="listbox" id={listboxId}>
          {items.map((it, i) => (
            <li key={getKey(it)} id={`${listboxId}-opt-${i}`} role="option" aria-selected={i === activeIndex}>
              <button type="button" className={i === activeIndex ? 'active' : undefined} onMouseDown={() => commitIndex(i)} onMouseEnter={() => setActiveIndex(i)}>
                {renderItem(it)}
              </button>
            </li>
          ))}
          {footer && (
            <li id={`${listboxId}-opt-${items.length}`} role="option" aria-selected={activeIndex === items.length}>
              <button
                type="button"
                className={`muted${activeIndex === items.length ? ' active' : ''}`}
                onMouseDown={() => commitIndex(items.length)}
                onMouseEnter={() => setActiveIndex(items.length)}
              >
                {footer.label}
              </button>
            </li>
          )}
        </ul>
      )}
    </>
  );
}
