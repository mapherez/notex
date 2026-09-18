import { useLayoutEffect, useState } from 'react';

// Narrow windows and tablets use one-column notes. A secondary touch screen
// alone must not replace the mature desktop layout on a hybrid computer.
const adaptedContentQuery = '(max-width: 64rem), (max-width: 90rem) and (pointer: coarse)';

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
