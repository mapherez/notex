import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useI18n } from '../../i18n/I18nProvider';
import { useToastStore } from '../../store/useToastStore';

export function SearchBox({ className }: { className?: string }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const pushToast = useToastStore((state) => state.pushToast);
  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  function setQuery(value: string) {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setSearchParams(next);
  }

  return (
    <label className={className ? `search-box ${className}` : 'search-box'}>
      <Search size={19} />
      <input
        ref={inputRef}
        type="search"
        placeholder={t('topbar.searchPlaceholder')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            pushToast(t('topbar.searchApplied'), 'success');
          }
        }}
      />
      <span className="kbd">{t('topbar.keyboardHint')}</span>
    </label>
  );
}
