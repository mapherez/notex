'use client';

// SearchFilters Component
// Provides filtering options for search results including categories, difficulty, and dates

import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import type { SearchFilters, FilterOption, AppSettings } from '@notex/types';
import styles from './SearchFilters.module.scss';

interface SettingsFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SearchFiltersProps {
  /** Current filter values */
  filters: SearchFilters;
  /** Callback when filters change */
  onChange: (filters: SearchFilters) => void;
  /** Available category options */
  categoryOptions?: FilterOption[];
  /** Available difficulty options */
  difficultyOptions?: FilterOption[];
  /** Available tag options */
  tagOptions?: FilterOption[];
  /** Whether filters are loading */
  loading?: boolean;
  /** Whether to show filter counts */
  showCounts?: boolean;
  /** Whether the filters panel is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onToggleCollapse?: (collapsed: boolean) => void;
  /** Additional CSS class */
  className?: string;
  /** Localized strings for filters */
  labels?: {
    title?: string;
    searchFilters?: string;
    categories?: string;
    difficulty?: string;
    tags?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    clearFilters?: string;
    showMore?: string;
    activeCount?: (count: number) => string;
    expandFilters?: string;
    collapseFilters?: string;
    loadingFilters?: string;
    cardCount?: (count: number) => string;
  };
  /** Settings object for filter options */
  settings?: AppSettings;
  /** Localization function */
  localize?: (key: string, params?: Record<string, string | number>) => string;
}

export const SearchFiltersComponent: React.FC<SearchFiltersProps> = ({
  filters,
  onChange,
  categoryOptions,
  difficultyOptions,
  tagOptions = [],
  loading = false,
  showCounts = true,
  collapsed = false,
  onToggleCollapse,
  className,
  labels = {},
  settings,
  localize,
}) => {
  // Create localized default options from settings
  const defaultDifficultyOptions: FilterOption[] = settings?.FILTERS?.difficultyOptions?.map((option: SettingsFilterOption) => ({
    ...option,
    label: localize ? localize(option.label) : option.label,
  })) || [];

  const defaultCategoryOptions: FilterOption[] = settings?.FILTERS?.categoryOptions?.map((option: SettingsFilterOption) => ({
    ...option,
    label: localize ? localize(option.label) : option.label,
  })) || [];

  // Use provided options or defaults
  const finalCategoryOptions = categoryOptions || defaultCategoryOptions;
  const finalDifficultyOptions = difficultyOptions || defaultDifficultyOptions;
  // Default labels (fallback to English)
  const defaultLabels = {
    title: localize ? localize('FILTERS_TITLE') : 'Filters',
    searchFilters: localize ? localize('A11Y_SEARCH_FILTERS') : 'Search filters',
    categories: localize ? localize('FILTERS_CATEGORIES') : 'Categories',
    difficulty: localize ? localize('FILTERS_DIFFICULTY') : 'Difficulty',
    tags: localize ? localize('FILTERS_TAGS') : 'Tags',
    dateRange: localize ? localize('FILTERS_DATE_RANGE') : 'Date Created',
    dateFrom: localize ? localize('FILTERS_DATE_FROM') : 'From:',
    dateTo: localize ? localize('FILTERS_DATE_TO') : 'To:',
    clearFilters: localize ? localize('FILTERS_CLEAR_ALL') : 'Clear filters',
    showMore: (count: number) => localize ? localize('FILTERS_SHOW_MORE', { count }) : `Show more (${count})`,
    activeCount: (count: number) => localize ? localize(`FILTERS_ACTIVE_COUNT_${count === 1 ? 'one' : 'other'}`, { count }) : count === 1 ? `${count} active filter` : `${count} active filters`,
    expandFilters: localize ? localize('FILTERS_EXPAND') : 'Expand filters',
    collapseFilters: localize ? localize('FILTERS_COLLAPSE') : 'Collapse filters',
    loadingFilters: localize ? localize('A11Y_LOADING_FILTERS') : 'Loading filters...',
    cardCount: (count: number) => localize ? localize(`A11Y_CARD_COUNT_${count === 1 ? 'one' : 'other'}`, { count }) : count === 1 ? `${count} card` : `${count} cards`,
    ...labels,
  };

  const [dateFromInput, setDateFromInput] = useState(
    filters.dateRange?.from?.toISOString().split('T')[0] || ''
  );
  const [dateToInput, setDateToInput] = useState(
    filters.dateRange?.to?.toISOString().split('T')[0] || ''
  );

  // Handle category filter changes
  const handleCategoryChange = useCallback((category: string, checked: boolean) => {
    const newCategories = checked
      ? [...filters.categories, category]
      : filters.categories.filter(c => c !== category);
    
    onChange({
      ...filters,
      categories: newCategories,
    });
  }, [filters, onChange]);

  // Handle difficulty filter changes
  const handleDifficultyChange = useCallback((difficulty: string, checked: boolean) => {
    const newDifficulty = checked
      ? [...filters.difficulty, difficulty]
      : filters.difficulty.filter(d => d !== difficulty);
    
    onChange({
      ...filters,
      difficulty: newDifficulty,
    });
  }, [filters, onChange]);

  // Handle tag filter changes
  const handleTagChange = useCallback((tag: string, checked: boolean) => {
    const newTags = checked
      ? [...filters.tags, tag]
      : filters.tags.filter(t => t !== tag);
    
    onChange({
      ...filters,
      tags: newTags,
    });
  }, [filters, onChange]);

  // Handle date range changes
  const handleDateFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateFromInput(value);
    
    const fromDate = value ? new Date(value) : undefined;
    onChange({
      ...filters,
      dateRange: {
        from: fromDate,
        to: filters.dateRange?.to,
      },
    });
  }, [filters, onChange]);

  const handleDateToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDateToInput(value);
    
    const toDate = value ? new Date(value) : undefined;
    onChange({
      ...filters,
      dateRange: {
        from: filters.dateRange?.from,
        to: toDate,
      },
    });
  }, [filters, onChange]);

  // Clear all filters
  const handleClearAll = useCallback(() => {
    setDateFromInput('');
    setDateToInput('');
    onChange({
      categories: [],
      difficulty: [],
      tags: [],
      dateRange: undefined,
    });
  }, [onChange]);

  // Count active filters
  const activeFiltersCount = filters.categories.length + 
    filters.difficulty.length + 
    filters.tags.length + 
    (filters.dateRange?.from || filters.dateRange?.to ? 1 : 0);

  return (
    <aside 
      className={clsx(styles.container, className, {
        [styles.collapsed]: collapsed,
        [styles.loading]: loading,
      })}
      aria-label={defaultLabels.searchFilters}
    >
      {/* Filter Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{defaultLabels.title}</h3>
        <div className={styles.headerActions}>
          {activeFiltersCount > 0 && (
            <span className={styles.activeCount} aria-label={defaultLabels.activeCount(activeFiltersCount)}>
              {activeFiltersCount}
            </span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={() => onToggleCollapse(!collapsed)}
              className={styles.collapseButton}
              aria-label={collapsed ? defaultLabels.expandFilters : defaultLabels.collapseFilters}
              aria-expanded={!collapsed}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={clsx(styles.collapseIcon, { [styles.collapsed]: collapsed })}
              >
                <polyline points="6,9 12,15 18,9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className={styles.content}>
          {/* Categories Filter */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>{defaultLabels.categories}</h4>
            <div className={styles.filterOptions} role="group" aria-labelledby="categories-title">
              {finalCategoryOptions.map(option => (
                <label key={option.value} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(option.value)}
                    onChange={(e) => handleCategoryChange(option.value, e.target.checked)}
                    className={styles.checkbox}
                    disabled={loading}
                  />
                  <span className={styles.checkboxCustom} aria-hidden="true" />
                  <span className={styles.optionText}>
                    {option.label}
                    {showCounts && option.count !== undefined && (
                      <span className={styles.optionCount} aria-label={defaultLabels.cardCount(option.count)}>
                        ({option.count})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Difficulty Filter */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>{defaultLabels.difficulty}</h4>
            <div className={styles.filterOptions} role="group" aria-labelledby="difficulty-title">
              {finalDifficultyOptions.map(option => (
                <label key={option.value} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={filters.difficulty.includes(option.value)}
                    onChange={(e) => handleDifficultyChange(option.value, e.target.checked)}
                    className={styles.checkbox}
                    disabled={loading}
                  />
                  <span className={styles.checkboxCustom} aria-hidden="true" />
                  <span className={styles.optionText}>
                    {option.label}
                    {showCounts && option.count !== undefined && (
                      <span className={styles.optionCount} aria-label={defaultLabels.cardCount(option.count)}>
                        ({option.count})
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tags Filter */}
          {tagOptions.length > 0 && (
            <div className={styles.filterGroup}>
              <h4 className={styles.filterTitle}>{defaultLabels.tags}</h4>
              <div className={styles.filterOptions} role="group" aria-labelledby="tags-title">
                {tagOptions.slice(0, 8).map(option => (
                  <label key={option.value} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filters.tags.includes(option.value)}
                      onChange={(e) => handleTagChange(option.value, e.target.checked)}
                      className={styles.checkbox}
                      disabled={loading}
                    />
                    <span className={styles.checkboxCustom} aria-hidden="true" />
                    <span className={styles.optionText}>
                      {option.label}
                      {showCounts && option.count !== undefined && (
                        <span className={styles.optionCount} aria-label={defaultLabels.cardCount(option.count)}>
                          ({option.count})
                        </span>
                      )}
                    </span>
                  </label>
                ))}
                {tagOptions.length > 8 && (
                  <button
                    type="button"
                    className={styles.showMoreButton}
                    onClick={() => {
                      // TODO: Implement show more tags functionality
                      console.log('Show more tags');
                    }}
                  >
                    {typeof defaultLabels.showMore === 'function' ? defaultLabels.showMore(tagOptions.length - 8) : defaultLabels.showMore}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Date Range Filter */}
          <div className={styles.filterGroup}>
            <h4 className={styles.filterTitle}>{defaultLabels.dateRange}</h4>
            <div className={styles.dateRange}>
              <div className={styles.dateInput}>
                <label htmlFor="date-from" className={styles.dateLabel}>{defaultLabels.dateFrom}</label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFromInput}
                  onChange={handleDateFromChange}
                  className={styles.dateField}
                  disabled={loading}
                  max={dateToInput || undefined}
                />
              </div>
              <div className={styles.dateInput}>
                <label htmlFor="date-to" className={styles.dateLabel}>{defaultLabels.dateTo}</label>
                <input
                  id="date-to"
                  type="date"
                  value={dateToInput}
                  onChange={handleDateToChange}
                  className={styles.dateField}
                  disabled={loading}
                  min={dateFromInput || undefined}
                />
              </div>
            </div>
          </div>

          {/* Clear All Button */}
          {activeFiltersCount > 0 && (
            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleClearAll}
                className={styles.clearButton}
                disabled={loading}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                {defaultLabels.clearFilters}
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className={styles.loadingOverlay} aria-label={defaultLabels.loadingFilters}>
              <div className={styles.spinner}>
                <svg className={styles.spinnerIcon} viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray="32"
                    strokeDashoffset="32"
                  >
                    <animate
                      attributeName="stroke-dasharray"
                      dur="2s"
                      values="0 32;16 16;0 32;0 32"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="stroke-dashoffset"
                      dur="2s"
                      values="0;-16;-32;-32"
                      repeatCount="indefinite"
                    />
                  </circle>
                </svg>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};