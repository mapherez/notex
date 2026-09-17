import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

const focusableSelector = 'a[href], button:not([disabled]), [tabindex="0"]';

function drawerMedia() {
  const breakpoint = getComputedStyle(document.documentElement).getPropertyValue('--nx-breakpoint-tablet').trim();
  return window.matchMedia(`(max-width: ${breakpoint})`);
}

/** The same sidebar is persistent on desktop and modal below its CSS breakpoint. */
export function useSidebarDrawer(
  open: boolean,
  onClose: () => void,
  backgroundRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLButtonElement>,
) {
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [compact, setCompact] = useState(() => drawerMedia().matches);

  useLayoutEffect(() => {
    const media = drawerMedia();
    function update() {
      setCompact(media.matches);
      closeRef.current();
    }
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    sidebar.inert = compact && !open;
    if (sidebar.inert && sidebar.contains(document.activeElement)) triggerRef.current?.focus();
    if (!compact || !open) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgrounds = [backgroundRef.current, document.querySelector<HTMLElement>('.notification-viewport')]
      .filter((element): element is HTMLElement => Boolean(element))
      .map((element) => ({ element, wasInert: element.inert ?? false }));
    const previousOverflow = document.body.style.overflow;
    backgrounds.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      sidebar.querySelector<HTMLElement>('.sidebar-close')?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const controls = Array.from(sidebar!.querySelectorAll<HTMLElement>(focusableSelector));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (!sidebar!.contains(event.target as Node) && !document.querySelector('.modal-backdrop')) {
        sidebar!.querySelector<HTMLElement>('.sidebar-close')?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', keepFocusInside);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', keepFocusInside);
      backgrounds.forEach(({ element, wasInert }) => { element.inert = wasInert; });
      document.body.style.overflow = previousOverflow;
      // A newly opened AppModal manages its own focus; resizing to desktop keeps
      // focus in the persistent sidebar instead of focusing its hidden trigger.
      if (drawerMedia().matches && previousFocus?.isConnected && !document.querySelector('.modal-backdrop')) {
        previousFocus.focus();
      }
    };
  }, [compact, open, backgroundRef, triggerRef]);

  return { compact, sidebarRef };
}
