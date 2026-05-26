import { useCallback, useEffect, useState } from 'react';
import type { KeyboardEvent } from 'react';

export function useKeyboardListNavigation({
  enabled,
  itemCount,
  onEscape,
  onSelect,
}: {
  enabled: boolean;
  itemCount: number;
  onEscape?: () => void;
  onSelect: (index: number) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!enabled || itemCount <= 0) {
      setActiveIndex(-1);
      return;
    }

    setActiveIndex((currentIndex) => (currentIndex < 0 ? 0 : Math.min(currentIndex, itemCount - 1)));
  }, [enabled, itemCount]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!enabled) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((currentIndex) => {
          if (itemCount <= 0) {
            return -1;
          }

          return currentIndex < 0 ? 0 : (currentIndex + 1) % itemCount;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((currentIndex) => {
          if (itemCount <= 0) {
            return -1;
          }

          return currentIndex <= 0 ? itemCount - 1 : currentIndex - 1;
        });
        return;
      }

      if (event.key === 'Enter' && itemCount > 0) {
        event.preventDefault();
        onSelect(activeIndex >= 0 ? activeIndex : 0);
        return;
      }

      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
      }
    },
    [activeIndex, enabled, itemCount, onEscape, onSelect],
  );

  return {
    activeIndex,
    onKeyDown,
    setActiveIndex,
  };
}
