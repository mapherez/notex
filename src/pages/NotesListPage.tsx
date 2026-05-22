import { Check, ChevronDown, Edit3, Folder, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { CustomSelect } from '../components/ui/CustomSelect';
import { IconBadge } from '../components/ui/IconBadge';
import { NotesFilterRow } from '../components/ui/NotesFilterRow';
import { NoteRow } from '../components/ui/NoteRow';
import { defaultNewCollectionColor } from '../config/appSettings';
import type { Collection, Note, Tag as TagModel, TagColor } from '../core/models/models';
import { defaultNotesSortOrder, filterNotes, normalizeNotesSortOrder, recentNotesSortOrder, type NotesSortOrder } from '../core/utils/noteFilters';
import { tagColorOptions } from '../core/utils/tagColors';
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

export function NotesListPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const clearTrash = useKnowledgeStore((state) => state.clearTrash);
  const bulkUpdateNoteCollection = useKnowledgeStore((state) => state.bulkUpdateNoteCollection);
  const bulkUpdateNoteTag = useKnowledgeStore((state) => state.bulkUpdateNoteTag);
  const preferredLayout = useAppStore((state) => state.settings.preferredLayout);
  const pushToast = useToastStore((state) => state.pushToast);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const tagParam = searchParams.get('tag');
  const collectionParam = searchParams.get('collection');
  const defaultSortOrder: NotesSortOrder = mode === 'recent' ? recentNotesSortOrder : defaultNotesSortOrder;
  const sortOrder = mode === 'recent' ? defaultSortOrder : normalizeNotesSortOrder(searchParams.get('sort'));
  const activeTag = tags.find((tag) => tag.id === tagParam);
  const activeCollection = collections.find((collection) => collection.id === collectionParam);
  const tagId = activeTag?.id ?? null;
  const collectionId = activeCollection?.id ?? null;

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
        sortOrder,
      }),
    [collectionId, mode, notes, sortOrder, tagId],
  );
  const selectionEnabled = mode === 'all';
  const visibleNoteIdsKey = filtered.map((note) => note.id).join('|');
  const selectedNoteIdSet = useMemo(() => new Set(selectedNoteIds), [selectedNoteIds]);
  const selectedNotes = useMemo(
    () => filtered.filter((note) => selectedNoteIdSet.has(note.id)),
    [filtered, selectedNoteIdSet],
  );
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

  async function handleClearTrash() {
    if (!trashCount || !window.confirm(t('notes.clearTrashConfirm'))) {
      return;
    }

    await clearTrash();
    pushToast(t('notes.trashCleared'), 'warning');
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

      <NotesFilterRow
        collections={collections}
        defaultSortOrder={defaultSortOrder}
        onClear={clearFilters}
        onCollectionChange={(nextCollectionId) => updateFilterParam('collection', nextCollectionId)}
        onSortChange={(nextSortOrder: NotesSortOrder) => updateFilterParam('sort', nextSortOrder)}
        onTagChange={(nextTagId) => updateFilterParam('tag', nextTagId)}
        selectedCollectionId={collectionId}
        selectedTagId={tagId}
        sortLocked={mode === 'recent'}
        sortOrder={sortOrder}
        tags={tags}
      />

      {selectionEnabled && selectedNotes.length ? (
        <BulkNoteActionsRow
          allSelected={selectedNotes.length === filtered.length}
          collections={collections}
          onSelectAll={(checked) => setSelectedNoteIds(checked ? filtered.map((note) => note.id) : [])}
          onClearSelection={() => setSelectedNoteIds([])}
          onMoveCollection={(nextCollectionId) => void moveSelectedNotes(nextCollectionId)}
          onToggleTag={(tagId, assigned) => void updateSelectedTag(tagId, assigned)}
          selectedCount={selectedNotes.length}
          selectedNotes={selectedNotes}
          tags={tags}
          totalCount={filtered.length}
        />
      ) : null}

      {filtered.length ? (
        <div className={preferredLayout === 'grid' ? 'note-list notes-grid' : 'note-list'}>
          {filtered.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              tags={tags}
              collections={collections}
              timeValue={mode === 'recent' ? note.lastOpenedAt ?? note.updatedAt : undefined}
              selectable={selectionEnabled}
              selected={selectedNoteIdSet.has(note.id)}
              onSelectionChange={updateNoteSelection}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function BulkNoteActionsRow({
  allSelected,
  collections,
  onSelectAll,
  onClearSelection,
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

export function CollectionsPage() {
  const { t } = useI18n();
  const [newDraft, setNewDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
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

  async function removeCollection(collectionId: string) {
    if (!window.confirm(t('collections.deleteConfirm'))) {
      return;
    }

    if (settings.primaryCollectionId === collectionId) {
      await setPrimaryCollection(collections.find((collection) => collection.id !== collectionId)?.id ?? '');
    }

    await deleteCollection(collectionId);
    setEditingId(null);
    pushToast(t('collections.deleted'), 'warning');
  }

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t('notes.collectionsTitle')}</h1>
        <p className="page-subtitle">{t('notes.collectionsSubtitle')}</p>
      </header>

      <form
        className="collection-create-row"
        onSubmit={(event) => {
          event.preventDefault();
          void createCollectionFromDraft();
        }}
      >
        <input
          value={newDraft.name}
          onChange={(event) => setNewDraft((draft) => ({ ...draft, name: event.target.value }))}
          placeholder={t('collections.newPlaceholder')}
        />
        <CustomSelect
          ariaLabel={t('collections.color')}
          onChange={(color) => setNewDraft((draft) => ({ ...draft, color: color as TagColor }))}
          options={tagColorOptions.map((color) => ({
            color,
            label: t(`tags.colors.${color}`),
            value: color,
          }))}
          value={newDraft.color}
        />
        <button type="submit">
          <Plus />
          {t('collections.create')}
        </button>
      </form>

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
                  <CustomSelect
                    ariaLabel={t('collections.color')}
                    onChange={(color) => setEditingDraft((draft) => ({ ...draft, color: color as TagColor }))}
                    options={tagColorOptions.map((color) => ({
                      color,
                      label: t(`tags.colors.${color}`),
                      value: color,
                    }))}
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
                    <Link className="collection-card-main" to={`/notes?collection=${collection.id}`}>
                      <IconBadge icon={Folder} color={collection.color} />
                      <div>
                        <div className="stat-label">{collection.name}</div>
                        <div className="stat-delta">
                          {count} {t('navigation.notes')}
                        </div>
                      </div>
                    </Link>
                    <div className="collection-card-actions">
                      <button className="collection-action-button" type="button" aria-label={t('collections.edit')} onClick={() => beginEdit(collection)}>
                        <Edit3 />
                      </button>
                      <button
                        className="collection-action-button danger"
                        type="button"
                        aria-label={t('collections.delete')}
                        onClick={() => void removeCollection(collection.id)}
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
    </div>
  );
}

