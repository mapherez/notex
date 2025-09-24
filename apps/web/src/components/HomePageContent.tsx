'use client';

import React, { useState, useEffect } from 'react';
import { Button, SearchBar, SearchFilters, useSettings } from '@notex/ui';
import { createLocalizeFunction, loadLocale } from '@notex/config';
import type { SearchFilters as SearchFiltersType, Locale, FilterOption } from '@notex/types';
import { KnowledgeCardRepository } from '@notex/database';

export function HomePageContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory] = useState([
    'React hooks',
    'PostgreSQL índices', 
    'TypeScript genéricos',
    'CSS Grid layout'
  ]);
  // TODO: Remove hardcoded values above when real search history is implemented
  
  const [filters, setFilters] = useState<SearchFiltersType>({
    categories: [],
    difficulty: [],
    tags: [],
  });
  
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [localize, setLocalize] = useState<((key: string, params?: Record<string, string | number>) => string) | null>(null);
  
  const { settings, loading } = useSettings();

  // Initialize localization
  useEffect(() => {
    async function initializeLocalization() {
      if (!settings?.SETUP?.language || loading) return;

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
  }, [settings?.SETUP?.language, loading]);

  const handleSearch = async (query: string) => {
    console.log('Searching for:', query);
    console.log('With filters:', filters);
    
    try {
      const results = await KnowledgeCardRepository.search(query, filters, 10);
      console.log('Search results:', results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleSuggestionSelect = (suggestion: any) => {
    console.log('Selected suggestion:', suggestion);
    // TODO: Navigate to suggestion
  };

  const handleFiltersChange = (newFilters: SearchFiltersType) => {
    setFilters(newFilters);
    console.log('Filters changed:', newFilters);
    // TODO: Trigger search with new filters
  };

  if (loading || !localize || !settings?.HOMEPAGE) {
    return (
      <main className="container">
        <div className="loading">Loading...</div>
      </main>
    );
  }

  // Transform settings data to include localized labels
  const categoryOptions: FilterOption[] = settings.HOMEPAGE.categoryOptions?.map(option => ({
    ...option,
    label: localize(option.label),
  })) || [];

  const difficultyOptions: FilterOption[] = settings.HOMEPAGE.difficultyOptions?.map(option => ({
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
    <main className="container">
      <header className="header">
        <h1>{localize('APP_TITLE')}</h1>
        <p>{localize('APP_SUBTITLE')}</p>
      </header>
      
      <section className="hero">
        <h2>{localize('HOMEPAGE_HERO_TITLE')}</h2>
        <p>{localize('HOMEPAGE_HERO_DESCRIPTION')}</p>

        {/* Search Interface Demo */}
        <div style={{ 
          marginTop: '2rem', 
          marginBottom: '2rem',
          display: 'flex',
          gap: '2rem',
          alignItems: 'flex-start',
          width: '100%',
          maxWidth: '1200px',
          margin: '2rem auto'
        }}>
          {/* Search Bar */}
          <div style={{ flex: 1 }}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearch}
              onSuggestionSelect={handleSuggestionSelect}
              onHistorySelect={setSearchQuery}
              history={searchHistory}
              placeholder={localize(settings.HOMEPAGE.searchPlaceholder || 'SEARCH_PLACEHOLDER')}
              showShortcut={true}
            />
          </div>
          
          {/* Search Filters */}
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
        
        <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {settings.HOMEPAGE?.buttons?.viewCards && (
            <Button 
              variant={settings.HOMEPAGE.buttons.viewCards.variant}
              onClick={() => {
                if (settings.HOMEPAGE?.buttons?.viewCards?.href) {
                  window.location.href = settings.HOMEPAGE.buttons.viewCards.href;
                }
              }}
            >
              {localize(settings.HOMEPAGE.buttons.viewCards.labelKey)}
            </Button>
          )}
          
          {settings.HOMEPAGE?.buttons?.learnMore && (
            <Button variant={settings.HOMEPAGE.buttons.learnMore.variant}>
              {localize(settings.HOMEPAGE.buttons.learnMore.labelKey)}
            </Button>
          )}
          
          {settings.HOMEPAGE?.buttons?.viewDemo && (
            <Button variant={settings.HOMEPAGE.buttons.viewDemo.variant}>
              {localize(settings.HOMEPAGE.buttons.viewDemo.labelKey)}
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}