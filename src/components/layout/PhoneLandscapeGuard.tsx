import { RotateCw, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useI18n } from '../../i18n/I18nProvider';

const unsupportedPhoneLandscapeQuery = [
  '(orientation: landscape)',
  '(pointer: coarse)',
  '(max-width: 64rem)',
  '(max-height: 32rem)',
].join(' and ');

export function PhoneLandscapeGuard({
  backgroundRef,
}: {
  backgroundRef: RefObject<HTMLElement | null>;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(() =>
    window.matchMedia(unsupportedPhoneLandscapeQuery).matches,
  );
  const guardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const media = window.matchMedia(unsupportedPhoneLandscapeQuery);
    const update = () => setVisible(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;

    const background = backgroundRef.current;
    const backgroundWasInert = background?.inert ?? false;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) activeElement.blur();
    if (background) background.inert = true;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      guardRef.current?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      if (background) background.inert = backgroundWasInert;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [backgroundRef, visible]);

  if (!visible) return null;

  return (
    <div
      className="phone-landscape-guard"
      ref={guardRef}
      role="alert"
      tabIndex={-1}
    >
      <div className="phone-landscape-guard__content">
        <div className="phone-landscape-guard__icon" aria-hidden="true">
          <Smartphone />
          <RotateCw />
        </div>
        <h1>{t('orientation.phoneLandscapeTitle')}</h1>
        <p>{t('orientation.phoneLandscapeDescription')}</p>
      </div>
    </div>
  );
}
