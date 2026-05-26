import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tag } from '../../core/models/models';
import { TagChip } from './TagChip';

type SortableTagListProps = {
  ariaLabel: string;
  className?: string;
  getHref?: (tag: Tag) => string | undefined;
  onRemove?: (tagId: string) => void;
  onReorder: (tagIds: string[]) => void | Promise<void>;
  removable?: boolean;
  tags: Tag[];
};

export function SortableTagList({
  ariaLabel,
  className,
  getHref,
  onRemove,
  onReorder,
  removable = false,
  tags,
}: SortableTagListProps) {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState(() => tags.map((tag) => tag.id));
  const orderedIdsRef = useRef(orderedIds);
  const activeIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef({ x: 0, y: 0 });
  const pointerMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const tagMap = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const orderedTags = useMemo(() => {
    const usedIds = new Set<string>();
    const ordered = orderedIds.flatMap((tagId) => {
      const tag = tagMap.get(tagId);
      if (!tag) {
        return [];
      }

      usedIds.add(tag.id);
      return [tag];
    });

    return [...ordered, ...tags.filter((tag) => !usedIds.has(tag.id))];
  }, [orderedIds, tagMap, tags]);

  useEffect(() => {
    if (activeId) {
      return;
    }

    updateOrderedIds(tags.map((tag) => tag.id));
  }, [activeId, tags]);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    function handlePointerUp() {
      finishPointerReorder();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        cancelPointerReorder();
      }
    }

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeId, tags]);

  function commitReorder(activeId: string, overId: string) {
    if (activeId === overId) {
      return;
    }

    const nextIds = moveId(orderedTags.map((tag) => tag.id), activeId, overId);
    updateOrderedIds(nextIds);
    void onReorder(nextIds);
  }

  function beginPointerReorder(event: PointerEvent<HTMLSpanElement>, tagId: string) {
    if (event.button !== 0 || isRemoveButton(event.target)) {
      return;
    }

    activeIdRef.current = tagId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    pointerMovedRef.current = false;
    suppressClickRef.current = false;
    setActiveId(tagId);
  }

  function trackPointerMovement(event: PointerEvent<HTMLSpanElement>) {
    if (!activeIdRef.current || pointerMovedRef.current) {
      return;
    }

    const deltaX = Math.abs(event.clientX - pointerStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pointerStartRef.current.y);
    if (deltaX > 4 || deltaY > 4) {
      pointerMovedRef.current = true;
    }
  }

  function previewPointerReorder(overId: string) {
    const draggedId = activeIdRef.current;
    if (!draggedId || draggedId === overId || !pointerMovedRef.current) {
      return;
    }

    updateOrderedIds((currentIds) => moveId(currentIds, draggedId, overId));
  }

  function handleClick(event: MouseEvent<HTMLSpanElement>, href?: string) {
    if (!href || suppressClickRef.current) {
      return;
    }

    event.preventDefault();
    navigate(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>, tag: Tag, href?: string) {
    if ((event.key === 'Enter' || event.key === ' ') && href) {
      event.preventDefault();
      navigate(href);
      return;
    }

    if (
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
      (!event.altKey && !event.ctrlKey && !event.metaKey)
    ) {
      return;
    }

    event.preventDefault();
    const currentIndex = tags.findIndex((item) => item.id === tag.id);
    const nextIndex = event.key === 'ArrowLeft' ? currentIndex - 1 : currentIndex + 1;
    const target = tags[nextIndex];
    if (target) {
      commitReorder(tag.id, target.id);
    }
  }

  function resetDragState() {
    activeIdRef.current = null;
    pointerMovedRef.current = false;
    setActiveId(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function finishPointerReorder() {
    const nextIds = orderedIdsRef.current;
    const originalIds = tags.map((tag) => tag.id);

    if (activeIdRef.current && pointerMovedRef.current && !isSameOrder(originalIds, nextIds)) {
      suppressClickRef.current = true;
      void onReorder(nextIds);
    }

    resetDragState();
  }

  function cancelPointerReorder() {
    updateOrderedIds(tags.map((tag) => tag.id));
    resetDragState();
  }

  function updateOrderedIds(input: string[] | ((currentIds: string[]) => string[])) {
    setOrderedIds((currentIds) => {
      const nextIds = typeof input === 'function' ? input(currentIds) : input;
      orderedIdsRef.current = nextIds;
      return nextIds;
    });
  }

  return (
    <div className={clsx('sortable-tag-list', className)} aria-label={ariaLabel} role="list">
      {orderedTags.map((tag) => {
        const href = getHref?.(tag);

        return (
          <span
            aria-label={tag.name}
            className={clsx('sortable-tag-list__item', {
              'sortable-tag-list__item--active': activeId === tag.id,
            })}
            key={tag.id}
            onClick={(event) => handleClick(event, href)}
            onPointerDown={(event) => beginPointerReorder(event, tag.id)}
            onPointerEnter={() => previewPointerReorder(tag.id)}
            onPointerMove={trackPointerMovement}
            onPointerUp={finishPointerReorder}
            onKeyDown={(event) => handleKeyDown(event, tag, href)}
            role="listitem"
            tabIndex={0}
            title={ariaLabel}
          >
            <TagChip
              tag={tag}
              removable={removable}
              onRemove={() => onRemove?.(tag.id)}
            />
          </span>
        );
      })}
    </div>
  );
}

function isSameOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function isRemoveButton(target: EventTarget) {
  return target instanceof Element && Boolean(target.closest('.tag-remove'));
}

function moveId(ids: string[], activeId: string, overId: string) {
  const activeIndex = ids.indexOf(activeId);
  const overIndex = ids.indexOf(overId);

  if (activeIndex === -1 || overIndex === -1) {
    return ids;
  }

  const nextIds = [...ids];
  const [movedId] = nextIds.splice(activeIndex, 1);
  nextIds.splice(overIndex, 0, movedId);
  return nextIds;
}
