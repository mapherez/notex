import { Check, ChevronDown, Edit3, Folder, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { IconBadge } from '../components/ui/IconBadge';
import { NotesFilterRow } from '../components/ui/NotesFilterRow';
import { NoteRow } from '../components/ui/NoteRow';
import { defaultNewCollectionColor } from '../config/appSettings';
import type { Collection, Note, PreferredLayout, Tag as TagModel, TagColor } from '../core/models/models';
import { defaultNotesSortOrder, filterNotes, normalizeNotesSortOrder, recentNotesSortOrder, type NotesSortOrder } from '../core/utils/noteFilters';
import { sortTagsByName } from '../core/utils/tagSorting';
import { useClickOutside } from '../core/utils/useClickOutside';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type ListMode = 'all' | 'favorites' | 'recent' | 'trash';
type CollectionDraft = {
  color: TagColor;
  name: string;
};
type TrashConfirmState =
  | null
  | { kind: 'clear' }
  | { kind: 'delete'; noteIds: string[]; title?: string };

export function NotesListPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const clearTrash = useKnowledgeStore((state) => state.clearTrash);
  const bulkMoveToTrash = useKnowledgeStore((state) => state.bulkMoveToTrash);
  const deleteNotesPermanently = useKnowledgeStore((state) => state.deleteNotesPermanently);
  const bulkUpdateNoteCollection = useKnowledgeStore((state) => state.bulkUpdateNoteCollection);
  const bulkUpdateNoteTag = useKnowledgeStore((state) => state.bulkUpdateNoteTag);
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
    [collectionId, mode, notes, pinOrderingEnabled, sortOrder, tagId],
  );
  const selectionEnabled = mode === 'all';
  const visibleNoteIdsKey = filtered.map((note) => note.id).join('|');
  const selectedNoteIdSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds]);
  const selectedNotes = useMemo(
    () => filtered.filter((note) => selectedNoteIdSet.has(note.id)),
    [filtered, selectedNoteIdSet],
  );
  const splitPinnedLists = pinOrderingEnabled && filtered.some((note) => note.isPinned);
  const pinnedNotes = useMemo(
    () => orderPinnedNotes(filtered.filter((note) => note.isPinned), orderedPinnedDragIds.length ? orderedPinnedDragIds : pinnedNoteIds),
    [filtered, orderedPinnedDragIds, pinnedNoteIds],
  );
  const regularNotes = splitPinnedLists ? filtered.filter((note) => !note.isPinned) : filtered;
  const showBulkActions = selectionEnabled && selectedNotes.length > 0;
  const trashCount = notes.filter((note) => note.isTrashed).length;

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
    if (activePinnedDragId) {
      return;
    }

    updateOrderedPinnedDragIds(pinnedNotes.map((note) => note.id));
  }, [activePinnedDragId, pinnedNotes]);

  useEffect(() => {
    if (!activePinnedDragId) {
      return;
    }

    function handlePointerUp() {
      finishPinnedNoteReorder();
    }

    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        cancelPinnedNoteReorder();
      }
    }

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePinnedDragId, pinnedNotes]);

  async function handleClearTrash() {
    if (!trashCount) {
      return;
    }

    setTrashConfirm({ kind: 'clear' });
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

  async function moveSelectedNotes(collectionId: string) {
    if (!selectedNoteIds.length) {
      return;
    }

    await bulkUpdateNoteCollection(selectedNoteIds, collectionId);
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

    await bulkMoveToTrash(selectedNoteIds);
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
    setActivePinnedDragId(noteId);
  }

  function trackPinnedNoteReorder(event: PointerEvent<HTMLElement>) {
    if (!activePinnedDragIdRef.current || pinnedDragMovedRef.current) {
      return;
    }

    const deltaX = Math.abs(event.clientX - pinnedDragStartRef.current.x);
    const deltaY = Math.abs(event.clientY - pinnedDragStartRef.current.y);
    if (deltaX > 4 || deltaY > 4) {
      pinnedDragMovedRef.current = true;
    }
  }

  function previewPinnedNoteReorder(overId: string) {
    const draggedId = activePinnedDragIdRef.current;
    if (!draggedId || draggedId === overId || !pinnedDragMovedRef.current) {
      return;
    }

    updateOrderedPinnedDragIds((currentIds) => moveId(currentIds, draggedId, overId));
  }

  function finishPinnedNoteReorder() {
    const nextIds = orderedPinnedDragIdsRef.current;
    const originalIds = pinnedNotes.map((note) => note.id);

    if (activePinnedDragIdRef.current && pinnedDragMovedRef.current && !isSameOrder(originalIds, nextIds)) {
      void reorderPinnedNotes(nextIds);
    }

    resetPinnedDragState();
  }

  function cancelPinnedNoteReorder() {
    updateOrderedPinnedDragIds(pinnedNotes.map((note) => note.id));
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

  function renderNoteRows(noteItems: Note[], pinnedList = false) {
    return noteItems.map((note) => (
      <NoteRow
        key={note.id}
        note={note}
        tags={tags}
        collections={collections}
        timeValue={mode === 'recent' ? note.lastOpenedAt ?? note.updatedAt : undefined}
        selectable={selectionEnabled}
        selected={selectedNoteIdSet.has(note.id)}
        onSelectionChange={updateNoteSelection}
        onPermanentDelete={
          mode === 'trash'
            ? (noteId) => {
                const trashedNote = notes.find((item) => item.id === noteId);
                setTrashConfirm({ kind: 'delete', noteIds: [noteId], title: trashedNote?.title });
              }
            : undefined
        }
        tagDisplayLimit={preferredLayout === 'grid' ? 2 : undefined}
        showPinActions={pinActionsEnabled}
        showPinIndicator={pinOrderingEnabled}
        showPinnedDragHandle={pinOrderingEnabled && pinnedList}
        pinnedDragActive={activePinnedDragId === note.id}
        onPinnedDragPointerDown={pinOrderingEnabled && pinnedList ? (event) => beginPinnedNoteReorder(event, note.id) : undefined}
        onPinnedDragPointerEnter={pinOrderingEnabled && pinnedList ? () => previewPinnedNoteReorder(note.id) : undefined}
        onPinnedDragPointerMove={pinOrderingEnabled && pinnedList ? trackPinnedNoteReorder : undefined}
        onPinnedDragPointerUp={pinOrderingEnabled && pinnedList ? finishPinnedNoteReorder : undefined}
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
        {mode === "trash" && trashCount ? (
          <button
            className="danger-action-button"
            type="button"
            onClick={() => void handleClearTrash()}
          >
            <Trash2 />
            {t("notes.clearTrash")}
          </button>
        ) : null}
      </header>

      {showBulkActions ? (
        <BulkNoteActionsRow
          allSelected={selectedNotes.length === filtered.length}
          collections={collections}
          onSelectAll={(checked) =>
            setSelectedNoteIds(checked ? filtered.map((note) => note.id) : [])
          }
          onClearSelection={() => setSelectedNoteIds([])}
          onMoveCollection={(nextCollectionId) =>
            void moveSelectedNotes(nextCollectionId)
          }
          onDeleteSelected={() => void deleteSelectedNotes()}
          onToggleTag={(tagId, assigned) =>
            void updateSelectedTag(tagId, assigned)
          }
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
          onCollectionChange={(nextCollectionId) =>
            updateFilterParam("collection", nextCollectionId)
          }
          onLayoutChange={(nextLayout: PreferredLayout) =>
            void setPreferredLayout(nextLayout)
          }
          onSortChange={(nextSortOrder: NotesSortOrder) =>
            updateFilterParam("sort", nextSortOrder)
          }
          onTagChange={(nextTagId) => updateFilterParam("tag", nextTagId)}
          preferredLayout={preferredLayout}
          selectedCollectionId={collectionId}
          selectedTagId={tagId}
          sortLocked={mode === "recent"}
          sortOrder={sortOrder}
          tags={tags}
        />
      )}

      {filtered.length ? (
        <div className={splitPinnedLists ? "note-list-stack" : undefined}>
          {splitPinnedLists && (
            <div
              className={[
                "note-list",
                "pin-list",
                preferredLayout === "grid" && "notes-grid",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {renderNoteRows(pinnedNotes, true)}
            </div>
          )}

          {!!regularNotes.length && (
            <div
              className={[
                "note-list",
                splitPinnedLists && "unpinned-list",
                preferredLayout === "grid" && "notes-grid",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {renderNoteRows(regularNotes)}
            </div>
          )}
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
      : t('notes.deleteForeverConfirm', { title: confirmState.title ?? t('notes.title') });

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

export function CollectionsPage() {
  const { t } = useI18n();
  const [newDraft, setNewDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
  const [deleteCandidate, setDeleteCandidate] = useState<Collection | null>(null);
  const collections = useKnowledgeStore((state) => state.collections);
  const notes = useKnowledgeStore((state) => state.notes);
  const createCollection = useKnowledgeStore((state) => state.createCollection);
  const updateCollection = useKnowledgeStore((state) => state.updateCollection);
  const deleteCollection = useKnowledgeStore((state) => state.deleteCollection);
  const settings = useAppStore((state) => state.settings);
  const setPrimaryCollection = useAppStore((state) => state.setPrimaryCollection);
  const pushToast = useToastStore((state) => state.pushToast);

  async function createCollectionFromDraft() {
    const created = await createCollection(newDraft.name, newDraft.color);
    if (!created) {
      return;
    }

    setNewDraft({ name: '', color: defaultNewCollectionColor });
    pushToast(t('collections.created'), 'success');
  }

  function beginEdit(collection: Collection) {
    setEditingId(collection.id);
    setEditingDraft({
      name: collection.name,
      color: collection.color ?? 'neutral',
    });
  }

  async function saveEdit(collectionId: string) {
    await updateCollection(collectionId, editingDraft);
    setEditingId(null);
    pushToast(t('collections.updated'), 'success');
  }

  async function confirmRemoveCollection() {
    if (!deleteCandidate) {
      return;
    }

    if (settings.primaryCollectionId === deleteCandidate.id) {
      await setPrimaryCollection(collections.find((collection) => collection.id !== deleteCandidate.id)?.id ?? '');
    }

    await deleteCollection(deleteCandidate.id);
    setEditingId(null);
    setDeleteCandidate(null);
    pushToast(t('collections.deleted'), 'warning');
  }

  return (
    <div className="page-content list-page-grid collections-page">
      <header>
        <h1 className="page-title">{t('notes.collectionsTitle')}</h1>
        <p className="page-subtitle">{t('notes.collectionsSubtitle')}</p>
      </header>

      <div className="collections-layout">
        <section className="collections-main-section" aria-label={t('navigation.collections')}>
          <div className="collection-grid">
            {collections.map((collection) => {
              const count = notes.filter((note) => note.collectionId === collection.id && !note.isTrashed).length;
              const isEditing = editingId === collection.id;
              return (
                <article className="collection-card" key={collection.id}>
                  {isEditing ? (
                    <form
                      className="collection-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit(collection.id);
                      }}
                    >
                      <IconBadge icon={Folder} color={editingDraft.color} />
                      <input
                        aria-label={t('collections.name')}
                        value={editingDraft.name}
                        onChange={(event) => setEditingDraft((draft) => ({ ...draft, name: event.target.value }))}
                      />
                      <ColorPicker
                        ariaLabel={t('collections.color')}
                        onChange={(color) => setEditingDraft((draft) => ({ ...draft, color }))}
                        value={editingDraft.color}
                      />
                      <div className="collection-card-actions">
                        <button className="collection-action-button" disabled={!editingDraft.name.trim()} type="submit">
                          <Check />
                          {t('common.save')}
                        </button>
                        <button className="collection-action-button" type="button" onClick={() => setEditingId(null)}>
                          <X />
                          {t('common.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="collection-card-header">
                        <Link
                          className="collection-card-link-overlay"
                          to={`/notes?collection=${collection.id}`}
                          aria-label={collection.name}
                        />
                        <div className="collection-card-main">
                          <IconBadge icon={Folder} color={collection.color} />
                          <div>
                            <div className="stat-label">{collection.name}</div>
                            <div className="stat-delta">
                              {count} {t('navigation.notes')}
                            </div>
                          </div>
                        </div>
                        <div className="collection-card-actions">
                          <button className="collection-action-button" type="button" aria-label={t('collections.edit')} onClick={() => beginEdit(collection)}>
                            <Edit3 />
                          </button>
                          <button
                            className="collection-action-button danger"
                            type="button"
                            aria-label={t('collections.delete')}
                            onClick={() => setDeleteCandidate(collection)}
                          >
                            <Trash2 />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <aside className="collections-side-panel">
          <form
            className="settings-card collection-create-card"
            onSubmit={(event) => {
              event.preventDefault();
              void createCollectionFromDraft();
            }}
          >
            <h2 className="settings-title">{t('collections.addNewCollection')}</h2>
            <input
              aria-label={t('collections.name')}
              value={newDraft.name}
              onChange={(event) => setNewDraft((draft) => ({ ...draft, name: event.target.value }))}
              placeholder={t('collections.name')}
            />
            <div className="collection-create-actions">
              <ColorPicker
                ariaLabel={t('collections.color')}
                onChange={(color) => setNewDraft((draft) => ({ ...draft, color }))}
                value={newDraft.color}
              />
              <button type="submit">
                <Plus />
                {t('collections.create')}
              </button>
            </div>
          </form>

          <section className="settings-card collection-preference-card">
            <h2 className="settings-title">{t('collections.primaryCollection')}</h2>
            <p className="settings-description">{t('collections.primaryCollectionDescription')}</p>
            <CustomSelect
              ariaLabel={t('collections.primaryCollection')}
              emptyText={t('notes.filters.noCollections')}
              onChange={(collectionId) => {
                void setPrimaryCollection(collectionId).then(() => pushToast(t('collections.primaryCollectionUpdated'), 'success'));
              }}
              options={collections.map((collection) => ({
                color: collection.color,
                label: collection.name,
                value: collection.id,
              }))}
              placeholder={t('notes.filters.allCollections')}
              value={settings.primaryCollectionId}
            />
          </section>
        </aside>
      </div>
      {deleteCandidate ? (
        <DeleteConfirmModal
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          description={t('collections.deleteConfirm')}
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={() => void confirmRemoveCollection()}
          title={t('collections.deleteTitle', { name: deleteCandidate.name })}
        />
      ) : null}
    </div>
  );
}
