import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/** Native scroll snap shared by the left navigation and right note panels. */
export function useDrawerSwipe({ compact, open, onClose, scrollerRef, sheetRef, side }: {
  compact: boolean;
  open: boolean;
  onClose: () => void;
  scrollerRef: RefObject<HTMLDivElement>;
  sheetRef: RefObject<HTMLElement>;
  side: 'left' | 'right';
}) {
  const closeRef = useRef(onClose);
  const dismissRef = useRef<() => void>(() => undefined);
  const alignRef = useRef<() => void>(() => undefined);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!compact || !open || !scroller || !sheet) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let hasOpened = false;
    let closing = false;
    let notified = false;
    let frame = 0;
    const maxScroll = () => scroller.scrollWidth - scroller.clientWidth;
    const openPosition = () => side === 'left' ? 0 : maxScroll();
    const closedPosition = () => side === 'left' ? maxScroll() : 0;
    const notifyClosed = () => {
      if (notified) return;
      notified = true;
      closeRef.current();
    };
    dismissRef.current = () => {
      if (closing) return;
      closing = true;
      if (!hasOpened) notifyClosed();
      else scroller.scrollTo({ left: closedPosition(), behavior: reducedMotion ? 'instant' : 'smooth' });
    };
    alignRef.current = () => {
      // A viewport resize must not be interpreted as a dismiss swipe.
      if (hasOpened && !closing) scroller.scrollTo({ left: openPosition(), behavior: 'instant' });
    };

    // Explicit initialisation also works in Safari without scroll-initial-target.
    scroller.scrollTo({ left: closedPosition(), behavior: 'instant' });
    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        if (!closing) scroller.scrollTo({ left: openPosition(), behavior: reducedMotion ? 'instant' : 'smooth' });
      });
    });
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (entry.intersectionRatio >= 0.99) hasOpened = true;
      if (hasOpened && entry.intersectionRatio <= 0.001) notifyClosed();
    }, { root: scroller, threshold: [0, 0.001, 0.99] });
    observer.observe(sheet);
    const resizeObserver = new ResizeObserver(() => alignRef.current());
    resizeObserver.observe(scroller);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      dismissRef.current = () => undefined;
      alignRef.current = () => undefined;
    };
  }, [compact, open, scrollerRef, sheetRef, side]);

  const dismiss = useCallback(() => dismissRef.current(), []);
  const alignOpen = useCallback(() => alignRef.current(), []);
  return { dismiss, alignOpen };
}
