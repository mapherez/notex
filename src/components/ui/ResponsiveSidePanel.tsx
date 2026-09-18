import { X } from 'lucide-react';
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useDrawerSwipe } from '../../core/utils/useDrawerSwipe';

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"], [contenteditable="true"]';

/** One set of panels: a desktop column or a modal sheet with native swipe. */
export function ResponsiveSidePanel({
  children, compact, id, label, onClose, open, triggerRef,
}: {
  children: ReactNode;
  compact: boolean;
  id: string;
  label: string;
  onClose: () => void;
  open: boolean;
  triggerRef: RefObject<HTMLButtonElement>;
}) {
  const { t } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const { dismiss, alignOpen } = useDrawerSwipe({ compact, open, onClose, scrollerRef, sheetRef, side: 'right' });

  useLayoutEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) overlay.inert = !open;
    if (!compact || !open) return;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!overlay || !scroller || !sheet) return;

    const backgrounds = [document.getElementById('root'), document.querySelector<HTMLElement>('.notification-viewport')]
      .filter((element): element is HTMLElement => Boolean(element))
      .map((element) => ({ element, wasInert: element.inert }));
    const previousOverflow = document.body.style.overflow;
    backgrounds.forEach(({ element }) => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    sheet.focus({ preventScroll: true });

    function updateViewport() {
      const viewport = window.visualViewport;
      overlay!.style.setProperty('--nx-drawer-viewport-top', `${viewport?.offsetTop ?? 0}px`);
      overlay!.style.setProperty('--nx-drawer-viewport-left', `${viewport?.offsetLeft ?? 0}px`);
      overlay!.style.setProperty('--nx-drawer-viewport-width', `${viewport?.width ?? window.innerWidth}px`);
      overlay!.style.setProperty('--nx-drawer-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      // Resizing the visible area must not be interpreted as a dismiss swipe.
      alignOpen();
    }
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    window.visualViewport?.addEventListener('scroll', updateViewport);

    function focusControls() {
      return Array.from(sheet!.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest('[inert]'));
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector('.modal-backdrop')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss();
      } else if (event.key === 'Tab') {
        const controls = focusControls();
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          sheet!.focus({ preventScroll: true });
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === sheet)) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    function keepFocusInside(event: FocusEvent) {
      if (!sheet!.contains(event.target as Node) && !document.querySelector('.modal-backdrop')) sheet!.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', keepFocusInside);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
      window.visualViewport?.removeEventListener('scroll', updateViewport);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', keepFocusInside);
      backgrounds.forEach(({ element, wasInert }) => { element.inert = wasInert; });
      document.body.style.overflow = previousOverflow;
      if (triggerRef.current?.isConnected && !document.querySelector('.modal-backdrop')) triggerRef.current.focus({ preventScroll: true });
    };
  }, [compact, open, triggerRef, dismiss, alignOpen]);

  if (!compact) {
    return <aside id={id} className="document-aside note-document-aside" aria-label={label}>{children}</aside>;
  }

  // Keep forms mounted while closed: dismissing the sheet must not discard drafts.
  return createPortal(
    <div ref={overlayRef} className={`side-panel-overlay${open ? ' is-open' : ''}`} aria-hidden={!open}>
      <button className="side-panel-backdrop" type="button" tabIndex={-1} aria-label={t('common.close')} onClick={dismiss} />
      <div
        ref={scrollerRef}
        className="side-panel-scroller"
        onClick={(event) => {
          if (!sheetRef.current?.contains(event.target as Node)) dismiss();
        }}
      >
        <div className="side-panel-spacer" aria-hidden="true" />
        <aside ref={sheetRef} id={id} className="side-panel-sheet" role="dialog" aria-modal={open || undefined} aria-label={label} tabIndex={-1}>
          <div className="side-panel-header">
            <h2>{label}</h2>
            <button className="icon-button side-panel-close" type="button" aria-label={t('common.close')} onClick={dismiss}>
              <X aria-hidden="true" />
            </button>
          </div>
          <div className="side-panel-content document-aside note-document-aside">{children}</div>
        </aside>
      </div>
    </div>, document.body,
  );
}
