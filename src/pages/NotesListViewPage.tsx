import { ChevronDown, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NoteRow } from '../components/notes/NoteRow';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyState } from '../components/ui/EmptyState';
import { NotesFilterRow } from '../components/ui/NotesFilterRow';
import type { Collection, Note, PreferredLayout, Tag as TagModel } from '../core/models/models';
import {
  defaultNotesSortOrder,
  filterNotes,
  recentNotesSortOrder,
} from '../core/utils/noteFilters';
import { normalizeNotesSortOrder, type NotesSortOrder } from '../core/utils/noteFilters';
import { richTextToPlainText } from '../core/utils/richText';
import { sortTagsByName } from '../core/utils/tagSorting';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore } from '../store/useNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type ListMode = 'all' | 'favorites' | 'recent' | 'trash';
type TrashConfirmState =
  | null
  | { kind: 'clear' }
  | { kind: 'delete'; noteIds: string[]; title?: string };

export function NotesListViewPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useNotesStore((state) => state.notes);
  const clearTrash = useNotesStore((state) => state.clearTrash);
  const deleteNotesPermanently = useNotesStore((state) => state.deleteNotesPermanently);
  const bulkUpdateNoteCollection = useNotesStore((state) => state.bulkUpdateNoteCollection);
  const bulkUpdateNoteTag = useNotesStore((state) => state.bulkUpdateNoteTag);
  const moveNoteToTrash = useNotesStore((state) => state.moveNoteToTrash);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const preferredLayout = useAppStore((state) => state.settings.preferredLayout);
  const pinnedNoteIds = useAppStore((state) => state.settings.pinnedNoteIds);
  const setPreferredLayout = useAppStore((state) => state.setPreferredLayout);
  const reorderPinnedNotes = useAppStore((state) => state.reorderPinnedNotes);
  const pushToast = useToastStore((state) => state.pushToast);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [trashConfirm, setTrashConfirm] = useState<TrashConfirmState>(null);
  const [activePinnedDragId, setActivePinnedDragId] = useState<string | null>(null);
  const [orderedPinnedDragIds, setOrderedPinnedDragIds] = useState<string[]>([]);
  const activePinnedDragIdRef = useRef<string | null>(null);
  const orderedPinnedDragIdsRef = useRef<string[]>([]);
  const pinnedDragStartRef = useRef({ x: 0, y: 0 });
  const pinnedDragMovedRef = useRef(false);
  const tagParam = searchParams.get('tag');
  const collectionParam = searchParams.get('collection');
  const defaultSortOrder: NotesSortOrder = mode === 'recent' ? recentNotesSortOrder : defaultNotesSortOrder;
  const sortOrder = mode === 'recent' ? defaultSortOrder : normalizeNotesSortOrder(searchParams.get('sort'));
  const activeTag = tags.find((tag) => tag.id === tagParam);
  const activeCollection = collections.find((collection) => collection.id === collectionParam);
  const tagId = activeTag?.id ?? null;
  const collectionId = activeCollection?.id ?? null;
  const hasActiveFilter = sortOrder !== defaultSortOrder || Boolean(tagId || collectionId);
  const pinActionsEnabled = mode === 'all';
  const pinOrderingEnabled = pinActionsEnabled && !hasActiveFilter;

  const copy = {
    all: { title: t('notes.title'), subtitle: t('notes.subtitle') },
    favorites: { title: t('notes.favoritesTitle'), subtitle: t('notes.favoritesSubtitle') },
    recent: { title: t('notes.recentTitle'), subtitle: t('notes.recentSubtitle') },
    trash: { title: t('notes.trashTitle'), subtitle: t('notes.trashSubtitle') },
  }[mode];

  const filtered = useMemo(
    () =>
      filterNotes(notes, {
        mode,
        tagId,
        collectionId,
        pinnedFirst: pinOrderingEnabled,
        sortOrder,
      }),
    [collectionId, notes, mode, pinOrderingEnabled, sortOrder, tagId],
  );
  const selectionEnabled = mode === 'all';
  const visibleNoteIdsKey = filtered.map((note) => note.id).join('|');
  const selectedNoteIdSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds]);
  const selectedNotes = useMemo(
    () => filtered.filter((note) => selectedNoteIdSet.has(note.id)),
    [filtered, selectedNoteIdSet],
  );
  const splitPinnedLists = pinOrderingEnabled && filtered.some((note) => note.isPinned);
  const filteredPinnedNotes = useMemo(() => filtered.filter((note) => note.isPinned), [filtered]);
  const persistedPinnedNotes = useMemo(
    () => orderPinnedNotes(filteredPinnedNotes, pinnedNoteIds),
    [filteredPinnedNotes, pinnedNoteIds],
  );
  const pinnedNotes = useMemo(
    () =>
      activePinnedDragId && orderedPinnedDragIds.length
        ? orderPinnedNotes(filteredPinnedNotes, orderedPinnedDragIds)
        : persistedPinnedNotes,
    [activePinnedDragId, filteredPinnedNotes, orderedPinnedDragIds, persistedPinnedNotes],
  );
  const regularNotes = splitPinnedLists ? filtered.filter((note) => !note.isPinned) : filtered;
  const showBulkActions = selectionEnabled && selectedNotes.length > 0;
  const trashCount = notes.filter((note) => note.isTrashed).length;
  const listContextKey = `${mode}|${tagId ?? ''}|${collectionId ?? ''}|${sortOrder}`;

  useEffect(() => {
    setSelectedNoteIds([]);
  }, [listContextKey]);

  useEffect(() => {
    if (!selectionEnabled) {
      setSelectedNoteIds([]);
      return;
    }

    const visibleNoteIds = new Set(filtered.map((note) => note.id));
    setSelectedNoteIds((current) => {
      const next = current.filter((noteId) => visibleNoteIds.has(noteId));
      return next.length === current.length ? current : next;
    });
  }, [selectionEnabled, visibleNoteIdsKey]);

  useEffect(() => {
    if (activePinnedDragId || !pinOrderingEnabled) {
      return;
    }

    updateOrderedPinnedDragIds(persistedPinnedNotes.map((note) => note.id));
  }, [activePinnedDragId, persistedPinnedNotes, pinOrderingEnabled]);

  useEffect(() => {
    if (!pinOrderingEnabled && activePinnedDragIdRef.current) {
      finishPinnedNoteReorder();
    }
  }, [pinOrderingEnabled]);

  useEffect(() => {
    if (!activePinnedDragId) {
      return undefined;
    }

    function handlePointerMove(event: globalThis.PointerEvent) {
      trackPinnedNoteReorderAt(event.clientX, event.clientY);
    }

    function handlePointerUp() {
      finishPinnedNoteReorder();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        cancelPinnedNoteReorder();
      }
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePinnedDragId, pinnedNotes]);

  async function handleClearTrash() {
    if (trashCount) {
      setTrashConfirm({ kind: 'clear' });
    }
  }

  async function confirmTrashAction() {
    if (!trashConfirm) {
      return;
    }

    if (trashConfirm.kind === 'clear') {
      await clearTrash();
      pushToast(t('notes.trashCleared'), 'warning');
    } else {
      await deleteNotesPermanently(trashConfirm.noteIds);
      pushToast(t('notes.deletedForever'), 'warning');
    }
    setTrashConfirm(null);
  }

  function updateFilterParam(name: 'collection' | 'sort' | 'tag', value: string | null) {
    const nextParams = new URLSearchParams(searchParams);
    if (value && !(name === 'sort' && value === defaultSortOrder)) {
      nextParams.set(name, value);
    } else {
      nextParams.delete(name);
    }
    setSearchParams(nextParams);
  }

  function clearFilters() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('collection');
    nextParams.delete('sort');
    nextParams.delete('tag');
    setSearchParams(nextParams);
  }

  function updateNoteSelection(noteId: string, checked: boolean) {
    setSelectedNoteIds((current) => {
      if (checked) {
        return current.includes(noteId) ? current : [...current, noteId];
      }
      return current.filter((id) => id !== noteId);
    });
  }

  async function moveSelectedNotes(nextCollectionId: string) {
    if (!selectedNoteIds.length) {
      return;
    }

    await bulkUpdateNoteCollection(selectedNoteIds, nextCollectionId);
    pushToast(t('notes.bulk.collectionUpdated'), 'success');
  }

  async function updateSelectedTag(tagId: string, assigned: boolean) {
    if (!selectedNoteIds.length) {
      return;
    }

    await bulkUpdateNoteTag(selectedNoteIds, tagId, assigned);
    pushToast(t(assigned ? 'notes.bulk.tagsAssigned' : 'notes.bulk.tagsRemoved'), 'success');
  }

  async function deleteSelectedNotes() {
    if (!selectedNoteIds.length) {
      return;
    }

    await Promise.all(selectedNoteIds.map((noteId) => moveNoteToTrash(noteId)));
    setSelectedNoteIds([]);
    pushToast(t('notes.bulk.deleted'), 'warning');
  }

  function beginPinnedNoteReorder(event: PointerEvent<HTMLButtonElement>, noteId: string) {
    if (event.button !== 0) {
      return;
    }

    activePinnedDragIdRef.current = noteId;
    pinnedDragStartRef.current = { x: event.clientX, y: event.clientY };
    pinnedDragMovedRef.current = false;
    updateOrderedPinnedDragIds(persistedPinnedNotes.map((note) => note.id));
    setActivePinnedDragId(noteId);
  }

  function trackPinnedNoteReorderAt(clientX: number, clientY: number) {
    const draggedId = activePinnedDragIdRef.current;
    if (!draggedId) {
      return;
    }

    const deltaX = Math.abs(clientX - pinnedDragStartRef.current.x);
    const deltaY = Math.abs(clientY - pinnedDragStartRef.current.y);
    if (!pinnedDragMovedRef.current && (deltaX > 4 || deltaY > 4)) {
      pinnedDragMovedRef.current = true;
    }

    if (!pinnedDragMovedRef.current) {
      return;
    }

    const target = document.elementFromPoint(clientX, clientY);
    const row = target instanceof HTMLElement ? target.closest<HTMLElement>('[data-note-id]') : null;
    const overId = row?.dataset.noteId;
    if (!overId || draggedId === overId || !orderedPinnedDragIdsRef.current.includes(overId)) {
      return;
    }

    updateOrderedPinnedDragIds((currentIds) => moveId(currentIds, draggedId, overId));
  }

  function finishPinnedNoteReorder() {
    const nextIds = orderedPinnedDragIdsRef.current;
    const originalIds = persistedPinnedNotes.map((note) => note.id);

    if (activePinnedDragIdRef.current && pinnedDragMovedRef.current && !isSameOrder(originalIds, nextIds)) {
      void reorderPinnedNotes(nextIds);
    }

    resetPinnedDragState();
  }

  function cancelPinnedNoteReorder() {
    updateOrderedPinnedDragIds(persistedPinnedNotes.map((note) => note.id));
    resetPinnedDragState();
  }

  function resetPinnedDragState() {
    activePinnedDragIdRef.current = null;
    pinnedDragMovedRef.current = false;
    setActivePinnedDragId(null);
  }

  function updateOrderedPinnedDragIds(input: string[] | ((currentIds: string[]) => string[])) {
    setOrderedPinnedDragIds((currentIds) => {
      const nextIds = typeof input === 'function' ? input(currentIds) : input;
      if (isSameOrder(currentIds, nextIds)) {
        return currentIds;
      }

      orderedPinnedDragIdsRef.current = nextIds;
      return nextIds;
    });
  }

  function renderNoteRows(noteItems: Note[]) {
    return noteItems.map((note) => (
      <NoteRow
        key={note.id}
        collections={collections}
        layout={preferredLayout}
        note={note}
        onPermanentDelete={
          mode === 'trash'
            ? (noteId) => {
                const trashedNote = notes.find((item) => item.id === noteId);
                setTrashConfirm({ kind: 'delete', noteIds: [noteId], title: richTextToPlainText(trashedNote?.title).trim() });
              }
            : undefined
        }
        onPinnedDragPointerDown={pinOrderingEnabled && note.isPinned ? (event) => beginPinnedNoteReorder(event, note.id) : undefined}
        onSelectionChange={updateNoteSelection}
        pinnedDragActive={activePinnedDragId === note.id}
        pinnedDragEnabled={pinOrderingEnabled && note.isPinned}
        selectable={selectionEnabled}
        selected={selectedNoteIdSet.has(note.id)}
        showPinIndicator={pinActionsEnabled}
        showPinnedDragHandle={pinActionsEnabled}
        tags={tags}
        timeValue={mode === 'recent' ? note.lastOpenedAt ?? note.updatedAt : undefined}
      />
    ));
  }

  return (
    <div className="page-content list-page-grid">
      <header className="page-header-actions">
        <span>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </span>
        {mode === 'trash' && trashCount ? (
          <button className="danger-action-button" type="button" onClick={() => void handleClearTrash()}>
            <Trash2 />
            {t('notes.clearTrash')}
          </button>
        ) : null}
      </header>

      {showBulkActions ? (
        <BulkNoteActionsRow
          allSelected={selectedNotes.length === filtered.length}
          collections={collections}
          onClearSelection={() => setSelectedNoteIds([])}
          onDeleteSelected={() => void deleteSelectedNotes()}
          onMoveCollection={(nextCollectionId) => void moveSelectedNotes(nextCollectionId)}
          onSelectAll={(checked) => setSelectedNoteIds(checked ? filtered.map((note) => note.id) : [])}
          onToggleTag={(tagId, assigned) => void updateSelectedTag(tagId, assigned)}
          selectedCount={selectedNotes.length}
          selectedNotes={selectedNotes}
          tags={tags}
          totalCount={filtered.length}
        />
      ) : (
        <NotesFilterRow
          collections={collections}
          defaultSortOrder={defaultSortOrder}
          onClear={clearFilters}
          onCollectionChange={(nextCollectionId) => updateFilterParam('collection', nextCollectionId)}
          onLayoutChange={(nextLayout: PreferredLayout) => void setPreferredLayout(nextLayout)}
          onSortChange={(nextSortOrder: NotesSortOrder) => updateFilterParam('sort', nextSortOrder)}
          onTagChange={(nextTagId) => updateFilterParam('tag', nextTagId)}
          preferredLayout={preferredLayout}
          selectedCollectionId={collectionId}
          selectedTagId={tagId}
          sortLocked={mode === 'recent'}
          sortOrder={sortOrder}
          tags={tags}
        />
      )}

      {filtered.length ? (
        <div className={splitPinnedLists ? 'note-list-stack' : undefined}>
          {splitPinnedLists ? (
            <div className={['note-list', 'pin-list', preferredLayout === 'grid' && 'notes-grid'].filter(Boolean).join(' ')}>
              {renderNoteRows(pinnedNotes)}
            </div>
          ) : null}

          {regularNotes.length ? (
            <div className={['note-list', splitPinnedLists && 'unpinned-list', preferredLayout === 'grid' && 'notes-grid'].filter(Boolean).join(' ')}>
              {renderNoteRows(regularNotes)}
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState />
      )}
      <TrashConfirmModal
        confirmState={trashConfirm}
        onCancel={() => setTrashConfirm(null)}
        onConfirm={() => void confirmTrashAction()}
        t={t}
      />
    </div>
  );
}

function BulkNoteActionsRow({
  allSelected,
  collections,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onMoveCollection,
  onToggleTag,
  selectedCount,
  selectedNotes,
  tags,
  totalCount,
}: {
  allSelected: boolean;
  collections: Collection[];
  onSelectAll: (checked: boolean) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onMoveCollection: (collectionId: string) => void;
  onToggleTag: (tagId: string, assigned: boolean) => void;
  selectedCount: number;
  selectedNotes: Note[];
  tags: TagModel[];
  totalCount: number;
}) {
  const { t } = useI18n();
  const [moveCollectionId, setMoveCollectionId] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const tagsMenuRef = useRef<HTMLDivElement>(null);
  const sortedTags = useMemo(() => sortTagsByName(tags), [tags]);
  const partiallySelected = selectedCount > 0 && selectedCount < totalCount;

  useClickOutside(tagsMenuRef, tagsOpen, () => setTagsOpen(false));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = partiallySelected;
    }
  }, [partiallySelected]);

  function handleMoveCollection(collectionId: string) {
    setMoveCollectionId(collectionId);
    if (collectionId) {
      onMoveCollection(collectionId);
      setMoveCollectionId('');
    }
  }

  return (
    <div className="bulk-note-actions-row">
      <label className="bulk-selection-summary">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          aria-label={t('notes.bulk.selectAll')}
          onChange={(event) => onSelectAll(event.currentTarget.checked)}
        />
        <span className="bulk-selection-count">{t('notes.bulk.selected', { count: selectedCount })}</span>
      </label>
      <div className="bulk-field">
        <span>{t('notes.bulk.moveCollection')}</span>
        <CustomSelect
          ariaLabel={t('notes.bulk.moveCollection')}
          emptyText={t('notes.filters.noCollections')}
          onChange={handleMoveCollection}
          options={collections.map((collection) => ({
            color: collection.color,
            label: collection.name,
            value: collection.id,
          }))}
          placeholder={t('notes.bulk.movePlaceholder')}
          value={moveCollectionId}
        />
      </div>

      <div className="bulk-field bulk-tags-field" ref={tagsMenuRef}>
        <span>{t('notes.bulk.assignTags')}</span>
        <button className="bulk-tags-trigger" type="button" aria-expanded={tagsOpen} onClick={() => setTagsOpen((value) => !value)}>
          <TagIcon />
          <span>{t('notes.bulk.chooseTags')}</span>
          <ChevronDown />
        </button>
        {tagsOpen ? (
          <div className="bulk-tags-menu">
            {sortedTags.length ? (
              sortedTags.map((tag) => (
                <BulkTagCheckbox key={tag.id} tag={tag} selectedNotes={selectedNotes} onToggle={onToggleTag} />
              ))
            ) : (
              <span className="notes-filter-empty">{t('notes.bulk.noTags')}</span>
            )}
          </div>
        ) : null}
      </div>

      <button className="bulk-clear-button" type="button" onClick={onClearSelection}>
        <X />
        {t('notes.bulk.clearSelection')}
      </button>
      <button className="bulk-clear-button bulk-delete-button danger" type="button" onClick={onDeleteSelected}>
        <Trash2 />
        {t('notes.bulk.deleteSelected')}
      </button>
    </div>
  );
}

function TrashConfirmModal({
  confirmState,
  onCancel,
  onConfirm,
  t,
}: {
  confirmState: TrashConfirmState;
  onCancel: () => void;
  onConfirm: () => void;
  t: ReturnType<typeof useI18n>['t'];
}) {
  if (!confirmState) {
    return null;
  }

  const title = confirmState.kind === 'clear' ? t('notes.clearTrash') : t('notes.deleteForever');
  const description =
    confirmState.kind === 'clear'
      ? t('notes.clearTrashConfirm')
      : t('notes.deleteForeverConfirm', { title: confirmState.title ?? t('notes.untitled') });

  return (
    <div className="modal-backdrop">
      <section className="choice-modal" role="dialog" aria-modal="true" aria-labelledby="trash-confirm-title">
        <h2 id="trash-confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="choice-modal-actions two-column-actions">
          <button type="button" onClick={onCancel}>
            <X />
            <span>{t('common.cancel')}</span>
          </button>
          <button type="button" onClick={onConfirm}>
            <Trash2 />
            <span>{t('common.delete')}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function BulkTagCheckbox({
  onToggle,
  selectedNotes,
  tag,
}: {
  onToggle: (tagId: string, assigned: boolean) => void;
  selectedNotes: Note[];
  tag: TagModel;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  const assignedCount = selectedNotes.filter((note) => note.tagIds.includes(tag.id)).length;
  const checked = selectedNotes.length > 0 && assignedCount === selectedNotes.length;
  const indeterminate = assignedCount > 0 && !checked;

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="bulk-tag-option">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => onToggle(tag.id, event.currentTarget.checked)}
      />
      <span className={`notes-filter-dot ${tag.color ?? 'neutral'}`} />
      <span># {tag.name}</span>
    </label>
  );
}

function orderPinnedNotes(notes: Note[], orderedIds: string[]) {
  const noteById = new Map(notes.map((note) => [note.id, note]));
  const usedIds = new Set<string>();
  const orderedNotes = orderedIds.flatMap((noteId) => {
    const note = noteById.get(noteId);
    if (!note) {
      return [];
    }

    usedIds.add(note.id);
    return [note];
  });

  return [...orderedNotes, ...notes.filter((note) => !usedIds.has(note.id))];
}

function isSameOrder(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
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
