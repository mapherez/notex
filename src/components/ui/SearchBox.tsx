import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { appLimits } from '../../config/appSettings';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useI18n } from '../../i18n/I18nProvider';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { NoteThumbnail } from './NoteThumbnail';
import type { Collection, Note, Tag } from '../../core/models/models';

type SearchResult = {
  collectionName?: string;
  matchType: 'collection' | 'tag' | 'title';
  note: Note;
  tagNames: string[];
};

export function SearchBox({ className }: { className?: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const resultsId = useId();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const notes = useKnowledgeStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const normalizedQuery = normalizeSearchValue(query);
  const results = useMemo(
    () => buildSearchResults({ collections, normalizedQuery, notes, tags }),
    [collections, normalizedQuery, notes, tags],
  );
  const showResults = resultsOpen && Boolean(normalizedQuery);

  useClickOutside(searchRef, showResults, () => setResultsOpen(false));

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
        if (normalizedQuery) {
          setResultsOpen(true);
        }
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [normalizedQuery]);

  function closeSearch() {
    setQuery('');
    setResultsOpen(false);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setResultsOpen(Boolean(value.trim()));
  }

  return (
    <div className={className ? `search-box-shell ${className}` : 'search-box-shell'} ref={searchRef}>
      <label className="search-box">
        <Search />
        <input
          ref={inputRef}
          type="search"
          placeholder={t('topbar.searchPlaceholder')}
          value={query}
          aria-expanded={showResults}
          aria-controls={showResults ? resultsId : undefined}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setResultsOpen(Boolean(query.trim()))}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setResultsOpen(false);
              return;
            }

            if (event.key === 'Enter' && results[0]) {
              event.preventDefault();
              navigate(`/notes/${results[0].note.id}`);
              closeSearch();
            }
          }}
        />
        <span className="kbd">{t('topbar.keyboardHint')}</span>
      </label>
      {showResults ? (
        <div className="search-results-popover" id={resultsId} role="list" aria-label={t('topbar.searchResults')}>
          {results.length ? (
            results.map((result) => (
              <Link className="search-result-row" key={result.note.id} to={`/notes/${result.note.id}`} onClick={closeSearch}>
                <NoteThumbnail thumbnail={result.note.thumbnail} />
                <span className="search-result-copy">
                  <strong>{result.note.title}</strong>
                  <span className="search-result-meta">
                    <span className="search-result-match">{t(`topbar.searchMatch.${result.matchType}`)}</span>
                    {result.collectionName ? <span>{result.collectionName}</span> : null}
                    {result.tagNames.slice(0, 2).map((tagName) => (
                      <span key={tagName}># {tagName}</span>
                    ))}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <div className="search-result-empty">{t('topbar.noSearchResults')}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function buildSearchResults({
  collections,
  normalizedQuery,
  notes,
  tags,
}: {
  collections: Collection[];
  normalizedQuery: string;
  notes: Note[];
  tags: Tag[];
}): SearchResult[] {
  if (!normalizedQuery) {
    return [];
  }

  const tagById = new Map(tags.map((tag) => [tag.id, tag]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  return notes
    .flatMap((note) => {
      if (note.isTrashed) {
        return [];
      }

      const noteTags = sortTagsByName(note.tagIds.flatMap((tagId) => tagById.get(tagId) ?? []));
      const collection = note.collectionId ? collectionById.get(note.collectionId) : undefined;
      const titleMatches = normalizeSearchValue(note.title).includes(normalizedQuery);
      const matchedTags = sortTagsByName(noteTags.filter((tag) => normalizeSearchValue(tag.name).includes(normalizedQuery)));
      const collectionMatches = collection ? normalizeSearchValue(collection.name).includes(normalizedQuery) : false;

      if (!titleMatches && !matchedTags.length && !collectionMatches) {
        return [];
      }

      return [
        {
          collectionName: collection?.name,
          matchType: titleMatches ? 'title' : matchedTags.length ? 'tag' : 'collection',
          note,
          tagNames: matchedTags.length ? matchedTags.map((tag) => tag.name) : noteTags.map((tag) => tag.name),
        } satisfies SearchResult,
      ];
    })
    .sort((a, b) => searchResultScore(a) - searchResultScore(b) || b.note.updatedAt.localeCompare(a.note.updatedAt))
    .slice(0, appLimits.searchResults);
}

function searchResultScore(result: SearchResult) {
  if (result.matchType === 'title') {
    return 0;
  }
  if (result.matchType === 'tag') {
    return 1;
  }
  return 2;
}

function normalizeSearchValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

