import { Check, Edit3, Folder, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ColorPicker } from '../components/ui/ColorPicker';
import { CustomSelect } from '../components/ui/CustomSelect';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { IconBadge } from '../components/ui/IconBadge';
import { defaultNewCollectionColor } from '../config/appSettings';
import type { Collection, TagColor } from '../core/models/models';
import {
  focusTextControlAtEnd,
  isEditableShortcutTarget,
  isPlainLetterShortcut,
} from '../core/utils/keyboardShortcuts';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useNotesStore } from '../store/useNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';
import { NotesListViewPage } from './NotesListViewPage';

type CollectionDraft = {
  color: TagColor;
  name: string;
};

export function NotesListPage({ mode }: { mode: 'all' | 'favorites' | 'recent' | 'trash' }) {
  return <NotesListViewPage mode={mode} />;
}

export function CollectionsPage() {
  const { t } = useI18n();
  const [newDraft, setNewDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<CollectionDraft>({ name: '', color: defaultNewCollectionColor });
  const [deleteCandidate, setDeleteCandidate] = useState<Collection | null>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editSaveButtonRef = useRef<HTMLButtonElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const collections = useKnowledgeStore((state) => state.collections);
  const notes = useNotesStore((state) => state.notes);
  const createCollection = useKnowledgeStore((state) => state.createCollection);
  const updateCollection = useKnowledgeStore((state) => state.updateCollection);
  const deleteCollection = useKnowledgeStore((state) => state.deleteCollection);
  const settings = useAppStore((state) => state.settings);
  const setPrimaryCollection = useAppStore((state) => state.setPrimaryCollection);
  const pushToast = useToastStore((state) => state.pushToast);

  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => editNameInputRef.current?.focus());
    }
  }, [editingId]);

  useEffect(() => {
    function handleCollectionPageShortcut(event: KeyboardEvent) {
      if (editingId || deleteCandidate || !isPlainLetterShortcut(event) || isEditableShortcutTarget(event.target)) {
        return;
      }

      event.preventDefault();
      setNewDraft((draft) => ({ ...draft, name: `${draft.name}${event.key}` }));
      requestAnimationFrame(() => focusTextControlAtEnd(newNameInputRef.current));
    }

    window.addEventListener('keydown', handleCollectionPageShortcut);
    return () => window.removeEventListener('keydown', handleCollectionPageShortcut);
  }, [deleteCandidate, editingId]);

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

  function cancelEdit() {
    setEditingId(null);
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
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelEdit();
                        }
                      }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveEdit(collection.id);
                      }}
                    >
                      <IconBadge icon={Folder} color={editingDraft.color} />
                      <input
                        ref={editNameInputRef}
                        aria-label={t('collections.name')}
                        value={editingDraft.name}
                        onChange={(event) => setEditingDraft((draft) => ({ ...draft, name: event.target.value }))}
                      />
                      <ColorPicker
                        ariaLabel={t('collections.color')}
                        onKeyboardCancel={() => editNameInputRef.current?.focus()}
                        onKeyboardCommit={() => editSaveButtonRef.current?.focus()}
                        onChange={(color) => setEditingDraft((draft) => ({ ...draft, color }))}
                        value={editingDraft.color}
                      />
                      <div className="collection-card-actions">
                        <button ref={editSaveButtonRef} className="collection-action-button" disabled={!editingDraft.name.trim()} type="submit">
                          <Check />
                          {t('common.save')}
                        </button>
                        <button className="collection-action-button" type="button" onClick={cancelEdit}>
                          <X />
                          {t('common.cancel')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="collection-card-header">
                      <Link className="collection-card-link-overlay" to={`/notes?collection=${collection.id}`} aria-label={collection.name} />
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
                        <button className="collection-action-button danger" type="button" aria-label={t('collections.delete')} onClick={() => setDeleteCandidate(collection)}>
                          <Trash2 />
                        </button>
                      </div>
                    </div>
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
              ref={newNameInputRef}
              aria-label={t('collections.name')}
              value={newDraft.name}
              onChange={(event) => setNewDraft((draft) => ({ ...draft, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setNewDraft((draft) => ({ ...draft, name: '' }));
                  event.currentTarget.blur();
                }
              }}
              placeholder={t('collections.name')}
            />
            <div className="collection-create-actions">
              <ColorPicker ariaLabel={t('collections.color')} onChange={(color) => setNewDraft((draft) => ({ ...draft, color }))} value={newDraft.color} />
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
              options={[
                {
                  label: t('noteDetail.noCollection'),
                  value: '',
                },
                ...collections.map((collection) => ({
                  color: collection.color,
                  label: collection.name,
                  value: collection.id,
                })),
              ]}
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
