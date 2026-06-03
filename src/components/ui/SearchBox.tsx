import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { appLimits } from '../../config/appSettings';
import { stripInlineFormatting } from '../../core/utils/inlineFormatting';
import { isPrimaryShortcut } from '../../core/utils/keyboardShortcuts';
import { richTextToPlainText } from '../../core/utils/richText';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../../core/utils/useKeyboardListNavigation';
import { sortTagsByName } from '../../core/utils/tagSorting';
import { useI18n } from '../../i18n/I18nProvider';
import { useNotesStore } from '../../store/useNotesStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { InlineFormattedText } from '../editing/InlineFormattedText';
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
  const notes = useNotesStore((state) => state.notes);
  const tags = useKnowledgeStore((state) => state.tags);
  const collections = useKnowledgeStore((state) => state.collections);
  const normalizedQuery = normalizeSearchValue(query);
  const results = useMemo(
    () => buildSearchResults({ collections, normalizedQuery, notes, tags }),
    [collections, normalizedQuery, notes, tags],
  );
  const showResults = resultsOpen && Boolean(normalizedQuery);
  const resultNavigation = useKeyboardListNavigation({
    enabled: showResults,
    itemCount: results.length,
    onEscape: () => setResultsOpen(false),
    onSelect: (index) => {
      const result = results[index];
      if (!result) {
        return;
      }

      navigate(`/notes/${result.note.id}`);
      closeSearch();
    },
  });

  useClickOutside(searchRef, showResults, () => setResultsOpen(false));

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (isPrimaryShortcut(event, "f")) {
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

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch();
      inputRef.current?.blur();
      return;
    }

    resultNavigation.onKeyDown(event);
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
          aria-activedescendant={showResults && resultNavigation.activeIndex >= 0 ? `${resultsId}-option-${resultNavigation.activeIndex}` : undefined}
          onChange={(event) => updateQuery(event.target.value)}
          onFocus={() => setResultsOpen(Boolean(query.trim()))}
          onKeyDown={handleInputKeyDown}
        />
        <span className="kbd">{t('topbar.keyboardHint')}</span>
      </label>
      {showResults ? (
        <div className="search-results-popover" id={resultsId} role="list" aria-label={t('topbar.searchResults')}>
          {results.length ? (
            results.map((result, index) => (
              <Link
                className={index === resultNavigation.activeIndex ? 'search-result-row active' : 'search-result-row'}
                id={`${resultsId}-option-${index}`}
                key={result.note.id}
                to={`/notes/${result.note.id}`}
                onClick={closeSearch}
                onMouseEnter={() => resultNavigation.setActiveIndex(index)}
              >
                <NoteThumbnail thumbnail={result.note.thumbnail} />
                <span className="search-result-copy">
                  <strong>
                    {richTextToPlainText(result.note.title).trim() ? <InlineFormattedText value={result.note.title} /> : t('notes.untitled')}
                  </strong>
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
      const titleMatches = normalizeSearchValue(
        [
          richTextToPlainText(note.title),
          richTextToPlainText(note.subtitle),
          ...(note.blocks?.map((block) => `${richTextToPlainText(block.title)} ${block.contentText}`) ?? []),
        ].join(' '),
      ).includes(normalizedQuery);
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
  return richTextToPlainText(stripInlineFormatting(value))
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
