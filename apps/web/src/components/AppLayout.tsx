'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { SearchBar, SearchFilters, Button, useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { SearchFilters as SearchFiltersType, Locale, FilterOption } from '@notex/types';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HomePageContent } from './HomePageContent';
import { CardDetailContent } from './CardDetailContent';

interface SearchContextType {
  searchQuery: string;
  filters: SearchFiltersType;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: SearchFiltersType) => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export const useSearchContext = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within AppLayout');
  }
  return context;
};

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory] = useState([
    'React hooks',
    'PostgreSQL índices',
    'TypeScript genéricos',
    'CSS Grid layout'
  ]);

  const [filters, setFilters] = useState<SearchFiltersType>({
    categories: [],
    difficulty: [],
    tags: [],
    status: 'published',
  });

  const [filtersCollapsed, setFiltersCollapsed] = useState(true);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);

  const { settings, loading: settingsLoading } = useSettings();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize localization
  useEffect(() => {
    async function initializeLocalization() {
      if (!settings?.SETUP?.language || settingsLoading) return;

      try {
        await loadLocale(settings.SETUP.language as Locale);
        const { localize: localizeFunc } = createLocalizeFunction(settings.SETUP.language as Locale);
        setLocalize(() => localizeFunc);
      } catch (error) {
        console.error('Failed to load locale:', error);
        setLocalize(() => (key: string) => key);
      }
    }

    initializeLocalization();
  }, [settings?.SETUP?.language, settingsLoading]);

  // Initialize search from URL parameters when on search page
  useEffect(() => {
    if (pathname !== '/search' || !searchParams) return;

    const query = searchParams.get('q') || '';
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const difficulty = searchParams.get('difficulty')?.split(',').filter(Boolean) || [];
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | undefined;

    setSearchQuery(query);
    setFilters({
      categories,
      difficulty,
      tags,
      status: status || 'published',
    });
  }, [pathname, searchParams]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    // Build search URL with query parameters
    const params = new URLSearchParams();
    params.set('q', query);

    // Add filter parameters
    if (filters.categories.length > 0) {
      params.set('categories', filters.categories.join(','));
    }
    if (filters.difficulty.length > 0) {
      params.set('difficulty', filters.difficulty.join(','));
    }
    if (filters.tags.length > 0) {
      params.set('tags', filters.tags.join(','));
    }
    if (filters.status) {
      params.set('status', filters.status);
    }

    // Navigate to search page with parameters
    router.push(`/search?${params.toString()}`);
  };

  // Auto-search with debouncing when on homepage
  useEffect(() => {
    if (pathname !== '/' || !searchQuery.trim()) return;

    const timeoutId = setTimeout(() => {
      // On homepage, we want to show filtered results instead of navigating to search
      // This will be implemented when we add the cards display logic
      console.log('Auto-search triggered:', searchQuery, filters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters, pathname]);

  const handleFiltersChange = (newFilters: SearchFiltersType) => {
    setFilters(newFilters);

    // If we're on search page, update URL
    if (pathname === '/search') {
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('q', searchQuery);
      }
      if (newFilters.categories.length > 0) {
        params.set('categories', newFilters.categories.join(','));
      }
      if (newFilters.difficulty.length > 0) {
        params.set('difficulty', newFilters.difficulty.join(','));
      }
      if (newFilters.tags.length > 0) {
        params.set('tags', newFilters.tags.join(','));
      }
      if (newFilters.status) {
        params.set('status', newFilters.status);
      }

      const newUrl = `/search${params.toString() ? `?${params.toString()}` : ''}`;
      router.replace(newUrl, { scroll: false });
    }
  };

  if (settingsLoading || !localize) {
    return (
      <div className="app-layout">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Transform settings data to include localized labels
  const categoryOptions: FilterOption[] = settings?.HOMEPAGE?.categoryOptions?.map(option => ({
    ...option,
    label: localize(option.label),
  })) || [];

  const difficultyOptions: FilterOption[] = settings?.HOMEPAGE?.difficultyOptions?.map(option => ({
    ...option,
    label: localize(option.label),
  })) || [];

  // TODO: Replace with dynamic tags from backend, when available
  const tagOptions: FilterOption[] = [
    { value: 'javascript', label: 'JavaScript', count: 8 },
    { value: 'react', label: 'React', count: 6 },
    { value: 'typescript', label: 'TypeScript', count: 4 },
    { value: 'css', label: 'CSS', count: 5 },
    { value: 'html', label: 'HTML', count: 3 },
    { value: 'nodejs', label: 'Node.js', count: 4 },
    { value: 'database', label: 'Database', count: 3 },
    { value: 'api', label: 'API', count: 2 },
    { value: 'testing', label: 'Testing', count: 3 },
    { value: 'performance', label: 'Performance', count: 2 },
  ];

  return (
    <SearchContext.Provider value={{ searchQuery, filters, setSearchQuery, setFilters }}>
      <div className="app-layout">
        {/* Persistent Header */}
        <header className="site-header">
          <nav className="main-nav">
            <div className="nav-brand">
              <Link href="/">NoteX</Link>
            </div>
          </nav>
        </header>

        {/* Persistent Search Interface */}
        <div className="search-interface">
          <div className="search-container">
            <div className="search-row">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={handleSearch}
                onHistorySelect={setSearchQuery}
                history={searchHistory}
                placeholder={localize('SEARCH_PLACEHOLDER')}
                showShortcut={true}
              />
              <div className="search-actions">
                <Button 
                  variant={settings?.HOMEPAGE?.buttons?.clearFilters?.variant || 'secondary'}
                  size="large"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      categories: [],
                      difficulty: [],
                      tags: [],
                      status: 'published',
                    });
                    setFiltersCollapsed(true);
                    router.replace('/');
                  }}
                >
                  {localize(settings?.HOMEPAGE?.buttons?.clearFilters?.labelKey || 'CLEAR_FILTERS')}
                </Button>
                <Button 
                  variant={settings?.HOMEPAGE?.buttons?.addCard?.variant || 'primary'}
                  size="large"
                  onClick={() => {
                    router.push('/cards/new');
                  }}
                >
                  {localize(settings?.HOMEPAGE?.buttons?.addCard?.labelKey || 'ADD_CARD')}
                </Button>
              </div>
            </div>
          </div>

          <div className="filters-container">
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              collapsed={filtersCollapsed}
              onToggleCollapse={setFiltersCollapsed}
              categoryOptions={categoryOptions}
              difficultyOptions={difficultyOptions}
              tagOptions={tagOptions}
              showCounts={true}
            />
          </div>
        </div>

        {/* Dynamic Content Area */}
        <main className="content-stage">
          {pathname === '/' || pathname === '/search' ? (
            <HomePageContent />
          ) : pathname.startsWith('/cards/') && !pathname.includes('/new') && !pathname.includes('/edit') ? (
            <CardDetailContent />
          ) : (
            children
          )}
        </main>
      </div>
    </SearchContext.Provider>
  );
}