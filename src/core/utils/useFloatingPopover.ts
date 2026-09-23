import { autoUpdate, computePosition, flip, offset, shift, size, type Placement } from '@floating-ui/dom';
import { useLayoutEffect, type RefObject } from 'react';

/** Keep an inline popover anchored during scroll/resize, without changing focus ownership. */
export function useFloatingPopover(
  open: boolean,
  referenceRef: RefObject<HTMLElement>,
  floatingRef: RefObject<HTMLElement>,
  placement: Placement = 'bottom-start',
  anchorKey?: number | null,
  strategy: 'absolute' | 'fixed' = 'absolute',
) {
  useLayoutEffect(() => {
    const reference = referenceRef.current;
    const floating = floatingRef.current;
    if (!open || !reference || !floating) return;
    let disposed = false;
    const rootStyle = getComputedStyle(document.documentElement);
    const spacing = (token: string) => {
      const value = rootStyle.getPropertyValue(token).trim();
      return parseFloat(value) * (value.endsWith('rem') ? parseFloat(rootStyle.fontSize) : 1);
    };
    const padding = spacing('--nx-space-4');
    const cleanup = autoUpdate(reference, floating, () => {
      void computePosition(reference, floating, {
        placement,
        strategy,
        middleware: [offset(spacing('--nx-space-2')), flip({ padding }), shift({ padding }), size({
          padding,
          apply({ availableWidth, availableHeight, rects }) {
            if (disposed) return;
            floating.style.setProperty('--nx-popover-max-width', `${Math.max(0, availableWidth)}px`);
            floating.style.setProperty('--nx-popover-max-height', `${Math.max(0, availableHeight)}px`);
            floating.style.setProperty('--nx-popover-anchor-width', `${rects.reference.width}px`);
          },
        })],
      }).then(({ x, y }) => {
        if (disposed) return;
        floating.style.setProperty('--nx-popover-left', `${x}px`);
        floating.style.setProperty('--nx-popover-top', `${y}px`);
      });
    });
    floating.style.position = strategy;
    return () => {
      disposed = true;
      cleanup();
      floating.style.removeProperty('position');
      floating.style.removeProperty('--nx-popover-left');
      floating.style.removeProperty('--nx-popover-top');
      floating.style.removeProperty('--nx-popover-max-width');
      floating.style.removeProperty('--nx-popover-max-height');
      floating.style.removeProperty('--nx-popover-anchor-width');
    };
  }, [open, referenceRef, floatingRef, placement, anchorKey, strategy]);
}
