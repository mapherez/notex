import { Folder } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { IconBadge } from '../components/ui/IconBadge';
import { NoteRow } from '../components/ui/NoteRow';
import { filterNotes } from '../core/utils/noteFilters';
import { useI18n } from '../i18n/I18nProvider';
import { useAppStore } from '../store/useAppStore';
import { useKnowledgeStore } from '../store/useKnowledgeStore';

type ListMode = 'all' | 'favorites' | 'recent' | 'trash';

export function NotesListPage({ mode }: { mode: ListMode }) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const preferredLayout = useAppStore((state) => state.settings.preferredLayout);
  const query = searchParams.get('q');
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
    query,
    tagId,
    collectionId,
  });
  const hasFilters = Boolean(query || tagId || collectionId);

  return (
    <div className="page-content list-page-grid">
      <header>
        <h1 className="page-title">{copy.title}</h1>
        <p className="page-subtitle">{copy.subtitle}</p>
      </header>

      {hasFilters ? (
        <div className="filter-bar">
          <span>{t('notes.filteredBy')}</span>
          {query ? <strong>{query}</strong> : null}
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
            <Link className="collection-card" to={`/notes?collection=${collection.id}`} key={collection.id}>
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
