import { useEffect, useRef, type KeyboardEvent } from 'react';

// DOM focus follows the highlighted option; selection remains an explicit click
// or Enter. Shared by dropdowns and the thumbnail grid.
export function useMenuOptionFocus(
  open: boolean,
  close: () => void,
  columns = 1,
  initialIndex = 0,
  focusOnOpen = true,
) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const options = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? []);

  useEffect(() => {
    if (!open || !focusOnOpen) return;
    const items = options();
    (items[initialIndex] ?? items[0])?.focus({ preventScroll: true });
    // Initialize only when opening; changing the selected value must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOnOpen, open]);

  function closeAndFocus() {
    close();
    triggerRef.current?.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeAndFocus();
      return;
    }
    const items = options();
    if (!items.length) return;
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLElement));
    const offsets: Record<string, number> = { ArrowDown: columns, ArrowUp: -columns, ArrowRight: 1, ArrowLeft: -1 };
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key in offsets) next = ((index + offsets[event.key]) % items.length + items.length) % items.length;
    else return;
    event.preventDefault(); event.stopPropagation();
    items[next]?.focus({ preventScroll: true });
    items[next]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return { triggerRef, menuRef, closeAndFocus, onKeyDown };
}
