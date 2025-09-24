'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { SearchBar, SearchFilters, Card, useSettings } from '@notex/ui';
import { KnowledgeCardRepository, type SearchResult, type KnowledgeCard } from '@notex/database';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { Locale, SearchFilters as SearchFiltersType } from '@notex/types';
import { useSearchParams, useRouter } from 'next/navigation';

function SearchPageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFiltersType>({
    categories: [],
    difficulty: [],
    tags: [],
    status: 'published',
  });
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  const { settings, loading: settingsLoading } = useSettings();
  const searchParams = useSearchParams();
  const router = useRouter();

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
        // Fallback to identity function
        setLocalize(() => (key: string) => key);
      }
    }

    initializeLocalization();
  }, [settings?.SETUP?.language, settingsLoading]);

  // Initialize search from URL parameters
  useEffect(() => {
    if (!searchParams) return;

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
  }, [searchParams]);

  // Perform search when query or filters change
  const performSearch = useCallback(async (query: string, searchFilters: SearchFiltersType) => {
    if (!localize) return; // Wait for localization to be ready

    try {
      setLoading(true);
      setError(null);

      const results = await KnowledgeCardRepository.search(query, searchFilters);
      setSearchResults(results);
    } catch (err) {
      console.error('Error performing search:', err);
      setError(localize('SEARCH_ERROR', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setLoading(false);
    }
  }, [localize]);

  // Trigger search when query or filters change
  useEffect(() => {
    if (!localize) return; // Wait for localization to be ready

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery, filters);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters, localize, performSearch]);

  // Handle search submission
  const handleSearchSubmit = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Update URL parameters
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query);
    }
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
    
    // Update URL without triggering navigation
    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [filters, router]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: SearchFiltersType) => {
    setFilters(newFilters);
    
    // Update URL parameters
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
    
    // Update URL without triggering navigation
    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newUrl, { scroll: false });
  }, [searchQuery, router]);

  // Handle card click
  const handleCardClick = useCallback((card: KnowledgeCard) => {
    // TODO: Navigate to card detail page
    console.log('Clicked card:', card.slug);
  }, []);

  if (settingsLoading || !localize) {
    return (
      <main className="container">
        <div className="main">
          <div className="loading">{settingsLoading ? 'Loading...' : 'Initializing...'}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="main">
        <h1>{localize('SEARCH_PAGE_TITLE')}</h1>
        <p>{localize('SEARCH_PAGE_DESCRIPTION')}</p>

        {/* Search Bar */}
        <div className="search-section">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            placeholder={localize('SEARCH_PLACEHOLDER')}
            loading={loading}
            showShortcut={true}
          />
        </div>

        {/* Search Filters */}
        <div className="filters-section">
          <SearchFilters
            filters={filters}
            onChange={handleFiltersChange}
            loading={loading}
          />
        </div>

        {/* Search Results */}
        <div className="results-section">
          {loading ? (
            <div className="loading">{localize('SEARCH_LOADING')}</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : searchResults.length === 0 && searchQuery ? (
            <div className="no-results">
              <h3>{localize('SEARCH_NO_RESULTS_TITLE')}</h3>
              <p>{localize('SEARCH_NO_RESULTS_DESCRIPTION')}</p>
            </div>
          ) : (
            <>
              <div className="results-header">
                <h2>
                  {searchQuery
                    ? localize('SEARCH_RESULTS_COUNT', { count: searchResults.length })
                    : localize('SEARCH_RECENT_CARDS')
                  }
                </h2>
              </div>

              <div className="cards-grid">
                {searchResults.map((result) => (
                  <Card
                    key={result.card.id}
                    card={result.card}
                    onClick={() => handleCardClick(result.card)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SearchPage() {
  return <SearchPageContent />;
}