import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { appLimits } from '../../config/appSettings';
import { isPrimaryShortcut } from '../../core/utils/keyboardShortcuts';
import { normalizeSearchValue, searchNotes } from '../../core/utils/noteSearch';
import { richTextToPlainText } from '../../core/utils/richText';
import { useClickOutside } from '../../core/utils/useClickOutside';
import { useKeyboardListNavigation } from '../../core/utils/useKeyboardListNavigation';
import { useI18n } from '../../i18n/I18nProvider';
import { useNotesStore } from '../../store/useNotesStore';
import { useKnowledgeStore } from '../../store/useKnowledgeStore';
import { InlineFormattedText } from '../editing/InlineFormattedText';
import { NoteThumbnail } from './NoteThumbnail';

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
    () => searchNotes({ collections, limit: appLimits.searchResults, notes, query, tags }),
    [collections, notes, query, tags],
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
