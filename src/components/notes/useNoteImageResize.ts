import { useEffect, useRef, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { editorSettings } from '../../config/appSettings';

type Corner = 'top-left' | 'bottom-right';
type ResizeSession = {
  pointerId: number;
  handle: HTMLButtonElement;
  corner: Corner;
  root: HTMLDivElement;
  image: HTMLImageElement;
  scrollHost: HTMLElement;
  spaces: HTMLElement[];
  startWidth: number;
  width: number;
  ratio: number;
  lastX: number;
  lastY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
  growing: boolean;
  frame: number;
  time: number;
  startScroll: number;
  dispose: () => void;
};

function viewportPoint(clientX: number, clientY: number) {
  return { x: clientX - (window.visualViewport?.offsetLeft ?? 0), y: clientY - (window.visualViewport?.offsetTop ?? 0) };
}

function scrollBy(host: HTMLElement, delta: number) {
  if (host === document.scrollingElement) window.scrollBy({ top: delta, behavior: 'instant' });
  else host.scrollTop += delta;
}

function scrollPosition(host: HTMLElement) {
  return host === document.scrollingElement ? (window.visualViewport?.pageTop ?? window.scrollY) : host.scrollTop;
}

function scrollHostFor(root: HTMLElement): HTMLElement {
  for (let parent = root.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (!parent.isContentEditable && /^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return document.scrollingElement as HTMLElement;
}

/** Keep the editor/document untouched until release; geometry lives on the node view. */
export function useNoteImageResize({ rootRef, width, minWidth, maxWidth, enabled, onCommit }: {
  rootRef: RefObject<HTMLDivElement | null>;
  width: number;
  minWidth: number;
  maxWidth: number;
  enabled: boolean;
  onCommit: (width: number) => void;
}) {
  const sessionRef = useRef<ResizeSession | null>(null);
  const latest = useRef({ width, minWidth, maxWidth, enabled, onCommit });
  latest.current = { width, minWidth, maxWidth, enabled, onCommit };

  function clampWidth(value: number, snap = true) {
    const { minWidth, maxWidth } = latest.current;
    const step = editorSettings.imageSizing.resizeStep;
    return Math.max(minWidth, Math.min(maxWidth, snap ? Math.round(value / step) * step : value));
  }

  function place(session: ResizeSession) {
    const { root, image, corner } = session;
    const bounds = root.getBoundingClientRect();
    session.width = Math.min(bounds.width, clampWidth(session.width, false));
    root.style.setProperty('--nx-note-image-width', `${session.width}px`);
    // Temporarily release horizontal alignment so either corner can follow the
    // pointer. Clamp translation too: a corner touching an edge is not a size cap.
    const viewportLeft = window.visualViewport?.offsetLeft ?? 0;
    const desiredLeft = session.lastX - session.offsetX + viewportLeft - bounds.left
      - (corner === 'bottom-right' ? session.width : 0);
    const left = Math.max(0, Math.min(bounds.width - session.width, desiredLeft));
    root.style.setProperty('--nx-note-image-resize-left', `${left}px`);
    const imageBounds = image.getBoundingClientRect();
    const cornerY = corner === 'top-left' ? imageBounds.top : imageBounds.bottom;
    const actualY = cornerY - (window.visualViewport?.offsetTop ?? 0) + session.offsetY;
    scrollBy(session.scrollHost, actualY - session.lastY);
    session.handle.setAttribute('aria-valuenow', String(Math.round(session.width)));
  }

  function finish(commit: boolean) {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    cancelAnimationFrame(session.frame);
    session.dispose();
    if (session.handle.hasPointerCapture(session.pointerId)) session.handle.releasePointerCapture(session.pointerId);
    const cornerY = () => {
      const rect = session.image.getBoundingClientRect();
      return (session.corner === 'top-left' ? rect.top : rect.bottom) - (window.visualViewport?.offsetTop ?? 0);
    };
    const before = cornerY();
    session.root.classList.remove('is-resizing');
    session.root.style.removeProperty('--nx-note-image-resize-left');
    const changed = commit && session.moved && session.width !== session.startWidth;
    session.root.style.setProperty('--nx-note-image-width', `${changed ? session.width : latest.current.width}px`);
    session.spaces.forEach(space => space.remove());
    if (commit) scrollBy(session.scrollHost, cornerY() - before);
    else scrollBy(session.scrollHost, session.startScroll - scrollPosition(session.scrollHost));
    session.scrollHost.classList.remove('note-image-resize-scroll');
    session.handle.setAttribute('aria-valuenow', String(Math.round(changed ? session.width : latest.current.width)));
    if (changed) latest.current.onCommit(session.width);
  }

  function begin(event: PointerEvent<HTMLButtonElement>, corner: Corner) {
    const root = rootRef.current;
    const image = root?.querySelector<HTMLImageElement>('img');
    if (!latest.current.enabled || !root || !image?.naturalWidth || event.button !== 0 || !event.isPrimary || sessionRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    if ((event.pointerType === 'touch' || event.pointerType === 'pen')
      && document.activeElement instanceof HTMLElement && document.activeElement.isContentEditable) document.activeElement.blur();
    const bounds = image.getBoundingClientRect();
    const point = viewportPoint(event.clientX, event.clientY);
    const initialCorner = viewportPoint(corner === 'top-left' ? bounds.left : bounds.right, corner === 'top-left' ? bounds.top : bounds.bottom);
    const scrollHost = scrollHostFor(root);
    const startScroll = scrollPosition(scrollHost);
    const insertionHost = scrollHost === document.scrollingElement ? document.body : scrollHost;
    // Head/tail room allows compensation at the beginning/end of a short note,
    // including while shrinking it. Spacers are outside ProseMirror's document.
    const reserve = window.visualViewport?.height ?? window.innerHeight;
    const spaces = [document.createElement('div'), document.createElement('div')];
    spaces.forEach(space => {
      space.className = 'note-image-resize-space';
      space.setAttribute('aria-hidden', 'true');
      space.style.setProperty('--nx-note-image-resize-space', `${reserve}px`);
    });
    scrollHost.classList.add('note-image-resize-scroll');
    insertionHost.prepend(spaces[0]);
    insertionHost.append(spaces[1]);
    scrollBy(scrollHost, image.getBoundingClientRect().top - bounds.top);
    root.classList.add('is-resizing');
    // Removing the grid's alignment must not move the image on pointerdown.
    root.style.setProperty('--nx-note-image-resize-left', `${bounds.left - root.getBoundingClientRect().left}px`);
    const session: ResizeSession = {
      pointerId: event.pointerId, handle: event.currentTarget, corner, root, image, scrollHost, spaces,
      startWidth: bounds.width, width: bounds.width, ratio: bounds.height / bounds.width,
      lastX: point.x, lastY: point.y,
      offsetX: point.x - initialCorner.x,
      offsetY: point.y - initialCorner.y,
      moved: false, growing: false, frame: 0, time: performance.now(), startScroll, dispose: () => {},
    };
    sessionRef.current = session;
    session.handle.setPointerCapture(event.pointerId);

    function move(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== session.pointerId) return;
      pointer.preventDefault();
      pointer.stopPropagation();
      const next = viewportPoint(pointer.clientX, pointer.clientY);
      const sign = corner === 'top-left' ? -1 : 1;
      const dx = sign * (next.x - session.lastX);
      const dy = sign * (next.y - session.lastY) / session.ratio;
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      session.width = clampWidth(session.width + delta, false);
      session.moved ||= Math.abs(delta) > 0;
      if (delta !== 0) session.growing = delta > 0;
      session.lastX = next.x;
      session.lastY = next.y;
    }
    function end(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId !== session.pointerId) return;
      pointer.preventDefault();
      pointer.stopPropagation();
      move(pointer);
      session.width = clampWidth(session.width);
      place(session);
      finish(true);
    }
    function cancel(pointer: globalThis.PointerEvent) {
      if (pointer.pointerId === session.pointerId) finish(false);
    }
    function key(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(false); }
    }
    const cancelViewport = () => finish(false);
    const initialViewportWidth = window.innerWidth;
    const cancelLayout = () => { if (window.innerWidth !== initialViewportWidth) finish(false); };
    const cancelSecondContact = (pointer: globalThis.PointerEvent) => { if (pointer.pointerId !== session.pointerId) finish(false); };
    const cancelHidden = () => { if (document.hidden) finish(false); };
    const viewport = window.visualViewport;
    const initialScale = viewport?.scale ?? 1;
    const cancelZoom = () => { if ((viewport?.scale ?? 1) !== initialScale) finish(false); };
    window.addEventListener('pointermove', move, { capture: true, passive: false });
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', cancel, true);
    session.handle.addEventListener('lostpointercapture', cancel);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', cancelViewport);
    window.addEventListener('resize', cancelLayout);
    window.addEventListener('pointerdown', cancelSecondContact, true);
    document.addEventListener('visibilitychange', cancelHidden);
    viewport?.addEventListener('resize', cancelZoom);
    session.dispose = () => {
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', cancel, true);
      session.handle.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', cancelViewport);
      window.removeEventListener('resize', cancelLayout);
      window.removeEventListener('pointerdown', cancelSecondContact, true);
      document.removeEventListener('visibilitychange', cancelHidden);
      viewport?.removeEventListener('resize', cancelZoom);
    };
    function tick(time: number) {
      if (sessionRef.current !== session) return;
      if (!session.root.isConnected || !session.image.isConnected || !session.handle.isConnected) { finish(false); return; }
      const elapsed = Math.min(32, time - session.time) / 1000;
      session.time = time;
      const height = window.visualViewport?.height ?? window.innerHeight;
      const edge = Math.min(editorSettings.imageSizing.edgeScrollZone, height / 4);
      const proximity = corner === 'top-left' ? (edge - session.lastY) / edge : (session.lastY - (height - edge)) / edge;
      if (session.moved && session.growing && proximity > 0) {
        const growth = Math.min(1, proximity) * editorSettings.imageSizing.maxEdgeScrollSpeed * elapsed / session.ratio;
        session.width = clampWidth(session.width + growth, false);
      }
      place(session);
      session.frame = requestAnimationFrame(tick);
    }
    session.frame = requestAnimationFrame(tick);
  }

  function keyboardResize(event: KeyboardEvent<HTMLButtonElement>) {
    const step = editorSettings.imageSizing.keyboardResizeStep;
    const current = Math.min(latest.current.maxWidth, latest.current.width);
    const next = event.key === 'Home' ? latest.current.minWidth : event.key === 'End' ? latest.current.maxWidth
      : ['ArrowRight', 'ArrowUp'].includes(event.key) ? current + step
        : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? current - step : null;
    if (next === null || !latest.current.enabled) return;
    event.preventDefault();
    event.stopPropagation();
    latest.current.onCommit(clampWidth(next));
  }

  useEffect(() => {
    if (!enabled) finish(false);
  }, [enabled]);
  // A concurrent document mutation must not be overwritten by a stale gesture.
  useEffect(() => { finish(false); }, [width]);
  useEffect(() => () => finish(false), []);

  return { begin, keyboardResize };
}
