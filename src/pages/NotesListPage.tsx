import { Folder } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import { useI18n } from '../i18n/I18nProvider';
import { useKnowledgeStore } from '../store/useKnowledgeStore';

type ListMode = 'all' | 'favorites' | 'recent' | 'trash';

export function NotesListPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const moveToTrash = useKnowledgeStore((state) => state.moveToTrash);
  const restoreNote = useKnowledgeStore((state) => state.restoreNote);

  const copy = {
    all: { title: t('notes.title'), subtitle: t('notes.subtitle') },
    favorites: { title: t('notes.favoritesTitle'), subtitle: t('notes.favoritesSubtitle') },
    recent: { title: t('notes.recentTitle'), subtitle: t('notes.recentSubtitle') },
    trash: { title: t('notes.trashTitle'), subtitle: t('notes.trashSubtitle') },
  }[mode];

  const filtered = notes.filter((note) => {
    if (mode === 'trash') {
      return note.isTrashed;
    }
    if (note.isTrashed) {
      return false;
    }
    if (mode === 'favorites') {
      return note.isFavorite;
    }
    return true;
  });

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{copy.title}</h1>
        <p className="page-subtitle">{copy.subtitle}</p>
      </header>

      {filtered.length ? (
        <div className="note-list">
          {filtered.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              tags={tags}
              collections={collections}
              actionLabel={mode === 'trash' ? t('notes.restore') : t('notes.moveToTrash')}
              onAction={(noteId) => void (mode === 'trash' ? restoreNote(noteId) : moveToTrash(noteId))}
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
  const collections = useKnowledgeStore((state) => state.collections);
  const notes = useKnowledgeStore((state) => state.notes);

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{t('notes.collectionsTitle')}</h1>
        <p className="page-subtitle">{t('notes.collectionsSubtitle')}</p>
      </header>

      <div className="collection-grid">
        {collections.map((collection) => {
          const count = notes.filter((note) => note.collectionId === collection.id && !note.isTrashed).length;
          return (
            <Link className="collection-card" to="/notes" key={collection.id}>
              <IconBadge icon={Folder} color={collection.color} />
              <div>
                <div className="stat-label">{collection.name}</div>
                <div className="stat-delta">
                  {count} {t('navigation.notes')}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
