import { useEffect, useRef, type RefObject } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  onClickOutside: () => void,
) {
  const callbackRef = useRef(onClickOutside);

  useEffect(() => {
    callbackRef.current = onClickOutside;
  }, [onClickOutside]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const node = ref.current;
      const target = event.target;
      if (!node || !(target instanceof Node) || node.contains(target)) {
        return;
      }

      callbackRef.current();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [enabled, ref]);
}
