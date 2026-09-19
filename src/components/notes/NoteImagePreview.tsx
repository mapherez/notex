import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { editorSettings } from '../../config/appSettings';
import { useI18n } from '../../i18n/I18nProvider';
import { AppModal } from '../ui/AppModal';

type Point = { x: number; y: number };
type Transform = { scale: number; x: number; y: number };

const fittedTransform: Transform = { scale: 1, x: 0, y: 0 };

export function fitImagePreviewSize(
  naturalSize: { height: number; width: number },
  viewportSize: { height: number; width: number },
) {
  if (naturalSize.width <= 0 || naturalSize.height <= 0) return { height: 0, width: 0 };
  const fraction = editorSettings.imagePreview.initialViewportFraction;
  const scale = Math.min(
    1,
    viewportSize.width * fraction / naturalSize.width,
    viewportSize.height * fraction / naturalSize.height,
  );
  return {
    height: naturalSize.height * scale,
    width: naturalSize.width * scale,
  };
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function constrainImagePreviewTransform(
  transform: Transform,
  fittedSize: { height: number; width: number },
  viewportSize: { height: number; width: number },
): Transform {
  const scale = Math.max(1, Math.min(editorSettings.imagePreview.maxScale, transform.scale));
  const maxX = Math.max(0, (fittedSize.width * scale - viewportSize.width) / 2);
  const maxY = Math.max(0, (fittedSize.height * scale - viewportSize.height) / 2);
  return {
    scale,
    x: maxX === 0 ? 0 : Math.max(-maxX, Math.min(maxX, transform.x)),
    y: maxY === 0 ? 0 : Math.max(-maxY, Math.min(maxY, transform.y)),
  };
}

export function NoteImagePreview({
  alt,
  onClose,
  open,
  src,
}: {
  alt: string;
  onClose: () => void;
  open: boolean;
  src: string;
}) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const transformRef = useRef<Transform>(fittedTransform);
  const panRef = useRef<{ pointerId: number; point: Point; transform: Transform } | null>(null);
  const pinchRef = useRef<{
    distance: number;
    focus: Point;
    scale: number;
  } | null>(null);

  const renderTransform = useCallback((next: Transform) => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;
    const constrained = constrainImagePreviewTransform(
      next,
      { height: image.offsetHeight, width: image.offsetWidth },
      { height: stage.clientHeight, width: stage.clientWidth },
    );
    transformRef.current = constrained;
    image.style.setProperty('--nx-image-preview-scale', String(constrained.scale));
    image.style.setProperty('--nx-image-preview-x', `${constrained.x}px`);
    image.style.setProperty('--nx-image-preview-y', `${constrained.y}px`);
  }, []);

  const reset = useCallback(() => {
    pointersRef.current.clear();
    panRef.current = null;
    pinchRef.current = null;
    const stage = stageRef.current;
    const image = imageRef.current;
    if (stage && image?.naturalWidth && image.naturalHeight) {
      const viewport = window.visualViewport;
      const fitted = fitImagePreviewSize(
        { height: image.naturalHeight, width: image.naturalWidth },
        {
          height: Math.min(stage.clientHeight, viewport?.height ?? window.innerHeight),
          width: Math.min(stage.clientWidth, viewport?.width ?? window.innerWidth),
        },
      );
      image.style.setProperty('--nx-image-preview-height', `${fitted.height}px`);
      image.style.setProperty('--nx-image-preview-width', `${fitted.width}px`);
    } else {
      image?.style.removeProperty('--nx-image-preview-height');
      image?.style.removeProperty('--nx-image-preview-width');
    }
    renderTransform(fittedTransform);
  }, [renderTransform]);

  useLayoutEffect(() => {
    if (!open) return;
    reset();
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(reset);
    observer.observe(stage);
    window.visualViewport?.addEventListener('resize', reset);
    return () => {
      observer.disconnect();
      window.visualViewport?.removeEventListener('resize', reset);
    };
  }, [open, reset, src]);

  useEffect(() => {
    if (!open) pointersRef.current.clear();
  }, [open]);

  function startGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.entries()];
    if (pointers.length === 1) {
      panRef.current = {
        pointerId: event.pointerId,
        point: pointers[0][1],
        transform: transformRef.current,
      };
      pinchRef.current = null;
      return;
    }
    if (pointers.length === 2) {
      const center = midpoint(pointers[0][1], pointers[1][1]);
      const stageBounds = stageRef.current?.getBoundingClientRect();
      const stageCenter = {
        x: (stageBounds?.left ?? 0) + (stageBounds?.width ?? 0) / 2,
        y: (stageBounds?.top ?? 0) + (stageBounds?.height ?? 0) / 2,
      };
      const current = transformRef.current;
      pinchRef.current = {
        distance: Math.max(1, distance(pointers[0][1], pointers[1][1])),
        focus: {
          x: (center.x - stageCenter.x - current.x) / current.scale,
          y: (center.y - stageCenter.y - current.y) / current.scale,
        },
        scale: current.scale,
      };
      panRef.current = null;
    }
  }

  function moveGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pointers = [...pointersRef.current.entries()];
    if (pointers.length === 2 && pinchRef.current) {
      const first = pointers[0][1];
      const second = pointers[1][1];
      const center = midpoint(first, second);
      const stageBounds = stageRef.current?.getBoundingClientRect();
      const stageCenter = {
        x: (stageBounds?.left ?? 0) + (stageBounds?.width ?? 0) / 2,
        y: (stageBounds?.top ?? 0) + (stageBounds?.height ?? 0) / 2,
      };
      const scale = pinchRef.current.scale * distance(first, second) / pinchRef.current.distance;
      renderTransform({
        scale,
        x: center.x - stageCenter.x - pinchRef.current.focus.x * scale,
        y: center.y - stageCenter.y - pinchRef.current.focus.y * scale,
      });
      return;
    }
    if (pointers.length === 1 && panRef.current?.pointerId === event.pointerId && transformRef.current.scale > 1) {
      renderTransform({
        ...panRef.current.transform,
        x: panRef.current.transform.x + event.clientX - panRef.current.point.x,
        y: panRef.current.transform.y + event.clientY - panRef.current.point.y,
      });
    }
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const remaining = [...pointersRef.current.entries()];
    pinchRef.current = null;
    panRef.current = remaining.length === 1
      ? { pointerId: remaining[0][0], point: remaining[0][1], transform: transformRef.current }
      : null;
  }

  return (
    <AppModal
      className="note-image-preview"
      labelledBy="note-image-preview-title"
      onClose={onClose}
      open={open}
    >
      <h2 className="note-image-preview__title" id="note-image-preview-title">
        {t('notes.editor.imagePreview')}
      </h2>
      <div
        className="note-image-preview__stage"
        ref={stageRef}
        onPointerCancel={finishGesture}
        onPointerDown={startGesture}
        onPointerMove={moveGesture}
        onPointerUp={finishGesture}
      >
        <img
          ref={imageRef}
          alt={alt}
          draggable={false}
          src={src}
          onLoad={reset}
        />
      </div>
    </AppModal>
  );
}
