import { Check, Edit3, Folder, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import type { Collection, TagColor } from '../core/models/models';
import { filterNotes } from '../core/utils/noteFilters';
import { tagColorOptions } from '../core/utils/tagColors';
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
  const preferredLayout = useAppStore((state) => state.settings.preferredLayout);
  const pushToast = useToastStore((state) => state.pushToast);
  const tagId = searchParams.get('tag');
  const collectionId = searchParams.get('collection');
  const activeTag = tags.find((tag) => tag.id === tagId);
  const activeCollection = collections.find((collection) => collection.id === collectionId);

  const copy = {
    all: { title: t('notes.title'), subtitle: t('notes.subtitle') },
    favorites: { title: t('notes.favoritesTitle'), subtitle: t('notes.favoritesSubtitle') },
    recent: { title: t('notes.recentTitle'), subtitle: t('notes.recentSubtitle') },
    trash: { title: t('notes.trashTitle'), subtitle: t('notes.trashSubtitle') },
  }[mode];

  const filtered = filterNotes(notes, {
    mode,
    tagId,
    collectionId,
  });
  const hasFilters = Boolean(tagId || collectionId);
  const trashCount = notes.filter((note) => note.isTrashed).length;

  async function handleClearTrash() {
    if (!trashCount || !window.confirm(t('notes.clearTrashConfirm'))) {
      return;
    }

    await clearTrash();
    pushToast(t('notes.trashCleared'), 'warning');
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
            <Trash2 size={18} />
            {t('notes.clearTrash')}
          </button>
        ) : null}
      </header>

      {hasFilters ? (
        <div className="filter-bar">
          <span>{t('notes.filteredBy')}</span>
          {activeTag ? <strong># {activeTag.name}</strong> : null}
          {activeCollection ? <strong>{activeCollection.name}</strong> : null}
          <button type="button" onClick={() => setSearchParams({})}>
            {t('notes.clearFilters')}
          </button>
        </div>
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
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

export function CollectionsPage() {
  const { t } = useI18n();
  const [newDraft, setNewDraft] = useState<CollectionDraft>({ name: '', color: 'blue' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CollectionDraft>({ name: '', color: 'blue' });
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

    setNewDraft({ name: '', color: 'blue' });
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
        <select
          className="select-control"
          value={newDraft.color}
          onChange={(event) => setNewDraft((draft) => ({ ...draft, color: event.target.value as TagColor }))}
        >
          {tagColorOptions.map((color) => (
            <option key={color} value={color}>
              {t(`tags.colors.${color}`)}
            </option>
          ))}
        </select>
        <button type="submit">
          <Plus size={17} />
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
                  <select
                    aria-label={t('collections.color')}
                    className="select-control"
                    value={editingDraft.color}
                    onChange={(event) => setEditingDraft((draft) => ({ ...draft, color: event.target.value as TagColor }))}
                  >
                    {tagColorOptions.map((color) => (
                      <option key={color} value={color}>
                        {t(`tags.colors.${color}`)}
                      </option>
                    ))}
                  </select>
                  <div className="collection-card-actions">
                    <button className="collection-action-button" disabled={!editingDraft.name.trim()} type="submit">
                      <Check size={16} />
                      {t('common.save')}
                    </button>
                    <button className="collection-action-button" type="button" onClick={() => setEditingId(null)}>
                      <X size={16} />
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
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="collection-action-button danger"
                        type="button"
                        aria-label={t('collections.delete')}
                        onClick={() => void removeCollection(collection.id)}
                      >
                        <Trash2 size={16} />
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
