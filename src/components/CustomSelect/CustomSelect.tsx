import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import './custom-select.scss';

/** Matches `$z-tooltip` in `src/styles/_variables.scss` for stacking above header/modal. */
const PANEL_Z_INDEX = 400;

interface PanelPosition {
  top: number;
  left: number;
  width: number;
}

export interface CustomSelectOption<T extends string | number> {
  value: T;
  label: React.ReactNode;
}

export interface CustomSelectProps<T extends string | number> {
  value: T;
  options: CustomSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: 'compact' | 'field';
  className?: string;
  id?: string;
  disabled?: boolean;
}

// Compare option values with strict equality.
function valuesEqual<T extends string | number>(a: T, b: T): boolean {
  return a === b;
}

/** Accessible custom select with portal panel and keyboard navigation. */
export function CustomSelect<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  variant = 'field',
  className = '',
  id,
  disabled = false,
}: CustomSelectProps<T>): React.ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [panelPos, setPanelPos] = useState<PanelPosition | null>(null);
  const portalTarget = document.body;
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;

  const selectedIndex = useMemo(() => {
    const i = options.findIndex((o) => valuesEqual(o.value, value));
    return i >= 0 ? i : 0;
  }, [options, value]);

  const selectedLabel = useMemo(() => {
    const opt = options[selectedIndex];
    return opt?.label ?? '';
  }, [options, selectedIndex]);

  // Close panel and clear fixed position state.
  const close = useCallback((): void => {
    setOpen(false);
    setPanelPos(null);
  }, []);

  // Position floating panel under the trigger from layout rect.
  const syncPanelPosition = useCallback((): void => {
    const trigger = triggerRef.current;
    if (!trigger || !open) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, [open, portalTarget]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    syncPanelPosition();
  }, [open, syncPanelPosition]);

  useEffect(() => {
    if (!open) return;
    setHighlightIndex(selectedIndex);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    // Close when pointer down occurs outside trigger and panel.
    const onDocPointerDown = (e: MouseEvent | PointerEvent): void => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    };

    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', syncPanelPosition, true);
    window.addEventListener('resize', syncPanelPosition);
    return () => {
      window.removeEventListener('scroll', syncPanelPosition, true);
      window.removeEventListener('resize', syncPanelPosition);
    };
  }, [open, syncPanelPosition]);

  useEffect(() => {
    if (!open) return;

    // Panel keyboard: escape, arrows, enter/space to select.
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, options.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[highlightIndex];
        if (opt) {
          onChange(opt.value);
          close();
          triggerRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, options, highlightIndex, onChange, close]);

  // Toggle the options panel open or closed.
  const toggle = (): void => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  // Arrow keys open panel and adjust highlight from selected index.
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        setHighlightIndex(() => {
          const next = Math.min(
            Math.max(selectedIndex + delta, 0),
            options.length - 1,
          );
          return next;
        });
      }
    }
  };

  const activeOptionId =
    open && options[highlightIndex]
      ? `${baseId}-opt-${highlightIndex}`
      : undefined;

  const rootClass = [
    'custom-select',
    `custom-select--${variant}`,
    open ? 'custom-select--open' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="custom-select__trigger"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="custom-select__value">{selectedLabel}</span>
        <span className="custom-select__chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && panelPos
        ? createPortal(
            <div
              ref={panelRef}
              id={listboxId}
              className={`custom-select__panel custom-select__panel--floating custom-select__panel--${variant}`}
              style={{
                position: 'fixed',
                top: panelPos.top,
                left: panelPos.left,
                width: panelPos.width,
                zIndex: PANEL_Z_INDEX,
                pointerEvents: 'auto',
              }}
              role="listbox"
              aria-label={ariaLabel}
              aria-activedescendant={activeOptionId}
            >
              <div className="custom-select__panel-inner">
                {options.map((opt, i) => {
                  const selected = valuesEqual(opt.value, value);
                  const highlighted = i === highlightIndex;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      id={`${baseId}-opt-${i}`}
                      role="option"
                      aria-selected={selected}
                      className={[
                        'custom-select__option',
                        selected ? 'custom-select__option--selected' : '',
                        highlighted ? 'custom-select__option--highlighted' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onMouseEnter={() => setHighlightIndex(i)}
                      onClick={() => {
                        onChange(opt.value);
                        close();
                        triggerRef.current?.focus();
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </div>
  );
}
