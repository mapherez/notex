import { useLayoutEffect, useState } from 'react';

// Narrow windows and tablets use one-column notes. A secondary touch screen
// alone must not replace the mature desktop layout on a hybrid computer.
const adaptedContentQuery = '(max-width: 64rem), (max-width: 90rem) and (pointer: coarse)';
const touchInputQuery = '(any-pointer: coarse)';

export function useAdaptedContent() {
  const [adapted, setAdapted] = useState(() => window.matchMedia(adaptedContentQuery).matches);

  useLayoutEffect(() => {
    const media = window.matchMedia(adaptedContentQuery);
    const update = () => setAdapted(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return adapted;
}

export function useTouchInputAvailable() {
  const [available, setAvailable] = useState(() =>
    window.matchMedia(touchInputQuery).matches || navigator.maxTouchPoints > 0,
  );

  useLayoutEffect(() => {
    const media = window.matchMedia(touchInputQuery);
    const update = () => setAvailable(media.matches || navigator.maxTouchPoints > 0);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return available;
}
