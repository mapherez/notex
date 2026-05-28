import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DynamicNoteRow } from '../components/dynamic/DynamicNoteRow';
import { DeleteConfirmModal } from '../components/ui/DeleteConfirmModal';
import { EmptyState } from '../components/ui/EmptyState';
import { NotesFilterRow } from '../components/ui/NotesFilterRow';
import type { DynamicNote, PreferredLayout } from '../core/models/models';
import {
  defaultDynamicNotesSortOrder,
  filterDynamicNotes,
  recentDynamicNotesSortOrder,
} from '../core/utils/dynamicNoteFilters';
import { normalizeNotesSortOrder, type NotesSortOrder } from '../core/utils/noteFilters';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useDynamicNotesStore } from '../store/useDynamicNotesStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';
import { useToastStore } from '../store/useToastStore';

type ListMode = 'all' | 'favorites' | 'recent' | 'trash';
type TrashConfirmState =
  | null
  | { kind: 'clear' }
  | { kind: 'delete'; noteIds: string[]; title?: string };

export function DynamicNotesListPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trashConfirm, setTrashConfirm] = useState<TrashConfirmState>(null);
  const dynamicNotes = useDynamicNotesStore((state) => state.dynamicNotes);
  const clearTrash = useDynamicNotesStore((state) => state.clearDynamicTrash);
  const deleteNotesPermanently = useDynamicNotesStore((state) => state.deleteDynamicNotesPermanently);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const preferredLayout = useAppStore((state) => state.settings.preferredLayout);
  const setPreferredLayout = useAppStore((state) => state.setPreferredLayout);
  const pushToast = useToastStore((state) => state.pushToast);
  const tagParam = searchParams.get('tag');
  const collectionParam = searchParams.get('collection');
  const defaultSortOrder: NotesSortOrder = mode === 'recent' ? recentDynamicNotesSortOrder : defaultDynamicNotesSortOrder;
  const sortOrder = mode === 'recent' ? defaultSortOrder : normalizeNotesSortOrder(searchParams.get('sort'));
  const activeTag = tags.find((tag) => tag.id === tagParam);
  const activeCollection = collections.find((collection) => collection.id === collectionParam);
  const tagId = activeTag?.id ?? null;
  const collectionId = activeCollection?.id ?? null;
  const trashCount = dynamicNotes.filter((note) => note.isTrashed).length;

  const copy = {
    all: { title: t('dynamicNotes.title'), subtitle: t('dynamicNotes.subtitle') },
    favorites: { title: t('notes.favoritesTitle'), subtitle: t('notes.favoritesSubtitle') },
    recent: { title: t('notes.recentTitle'), subtitle: t('notes.recentSubtitle') },
    trash: { title: t('notes.trashTitle'), subtitle: t('notes.trashSubtitle') },
  }[mode];

  const filtered = useMemo(
    () =>
      filterDynamicNotes(dynamicNotes, {
        mode,
        tagId,
        collectionId,
        pinnedFirst: mode === 'all' && !tagId && !collectionId,
        sortOrder,
      }),
    [collectionId, dynamicNotes, mode, sortOrder, tagId],
  );

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

  return (
    <div className="page-content list-page-grid">
      <header className="page-header-actions">
        <span>
          <h1 className="page-title">{copy.title}</h1>
          <p className="page-subtitle">{copy.subtitle}</p>
        </span>
        {mode === 'trash' && trashCount ? (
          <button className="danger-action-button" type="button" onClick={() => setTrashConfirm({ kind: 'clear' })}>
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

      {filtered.length ? (
        <div className={preferredLayout === 'grid' ? 'note-list notes-grid' : 'note-list'}>
          {filtered.map((note: DynamicNote) => (
            <DynamicNoteRow
              key={note.id}
              collections={collections}
              layout={preferredLayout}
              note={note}
              onPermanentDelete={
                mode === 'trash'
                  ? (noteId) => {
                      const trashedNote = dynamicNotes.find((item) => item.id === noteId);
                      setTrashConfirm({ kind: 'delete', noteIds: [noteId], title: trashedNote?.title });
                    }
                  : undefined
              }
              tags={tags}
              timeValue={mode === 'recent' ? note.lastOpenedAt ?? note.updatedAt : undefined}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {trashConfirm ? (
        <DeleteConfirmModal
          cancelLabel={t('common.cancel')}
          confirmLabel={t('common.delete')}
          description={
            trashConfirm.kind === 'clear'
              ? t('notes.clearTrashConfirm')
              : t('notes.deleteForeverConfirm', { title: trashConfirm.title ?? t('dynamicNotes.untitled') })
          }
          onCancel={() => setTrashConfirm(null)}
          onConfirm={() => void confirmTrashAction()}
          title={trashConfirm.kind === 'clear' ? t('notes.clearTrash') : t('notes.deleteForever')}
        />
      ) : null}
    </div>
  );
}
