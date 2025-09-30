'use client';

// SearchBar Component
// Provides search input with autocomplete, keyboard shortcuts, and suggestions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { getPlatformInfo } from '@notex/utils';
import styles from './SearchBar.module.scss';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'card' | 'category';
  metadata?: Record<string, unknown>;
}

export interface SearchBarProps {
  /** Current search query value */
  value: string;
  /** Callback when search query changes */
  onChange: (query: string) => void;
  /** Callback when search is submitted */
  onSubmit?: (query: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the search bar is in a loading state */
  loading?: boolean;
  /** Search suggestions to display */
  suggestions?: SearchSuggestion[];
  /** Callback when a suggestion is selected */
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  /** Whether to show search history */
  showHistory?: boolean;
  /** Search history items */
  history?: string[];
  /** Callback when history item is selected */
  onHistorySelect?: (query: string) => void;
  /** Callback when history item is deleted */
  onHistoryDelete?: (query: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Whether to show keyboard shortcut hint */
  showShortcut?: boolean;
  /** Accessibility label for search input */
  searchAriaLabel?: string;
  /** Accessibility label for clear button */
  clearAriaLabel?: string;
  /** Callback when clear button is clicked */
  onClear?: () => void;
  /** Accessibility label for loading state */
  loadingAriaLabel?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search knowledge cards...',
  loading = false,
  suggestions = [],
  onSuggestionSelect,
  showHistory = true,
  history = [],
  onHistorySelect,
  onHistoryDelete,
  onClear,
  className,
  showShortcut = true,
  searchAriaLabel = 'Search knowledge cards',
  clearAriaLabel = 'Clear search',
  loadingAriaLabel = 'Loading...',
}) => {
  const [isActive, setIsActive] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Combined list of suggestions and history
  const displayItems = React.useMemo(() => {
    const items: (SearchSuggestion | { type: 'history'; text: string })[] = [];
    
    // Add search history first (if no current suggestions and showing history)
    if (showHistory && !value && history.length > 0) {
      items.push(...history.slice(0, 5).map(query => ({ type: 'history' as const, text: query })));
    }
    
    // Add suggestions
    if (suggestions.length > 0) {
      items.push(...suggestions.slice(0, 8));
    }
    
    return items;
  }, [suggestions, history, value, showHistory]);

  // Get platform information for shortcut hint
  const { isDesktop, modifierKey } = getPlatformInfo();

  // Handle keyboard shortcuts (Cmd+K to focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsActive(true);
        setShowSuggestions(true);
      }
      
      if (e.key === 'Escape' && isActive) {
        inputRef.current?.blur();
        setIsActive(false);
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setIsActive(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);
  }, [onChange]);

  // Handle input focus
  const handleInputFocus = useCallback(() => {
    setIsActive(true);
    setShowSuggestions(true);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedIndex >= 0 && displayItems[selectedIndex]) {
      const item = displayItems[selectedIndex];
      if ('id' in item) {
        onSuggestionSelect?.(item);
      } else {
        onHistorySelect?.(item.text);
      }
    } else {
      onSubmit?.(value);
    }
    
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, [value, selectedIndex, displayItems, onSubmit, onSuggestionSelect, onHistorySelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || displayItems.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < displayItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : displayItems.length - 1
        );
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  }, [showSuggestions, displayItems.length]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((item: SearchSuggestion | { type: 'history'; text: string }) => {
    if ('id' in item) {
      onSuggestionSelect?.(item);
    } else {
      onHistorySelect?.(item.text);
    }
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  }, [onSuggestionSelect, onHistorySelect]);

  // Clear search
  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
      inputRef.current?.focus();
      setShowSuggestions(showHistory && history.length > 0);
    }
  }, [onClear, onChange, showHistory, history.length]);

  return (
    <div 
      ref={containerRef}
      className={clsx(styles.container, className, {
        [styles.active]: isActive,
        [styles.loading]: loading,
      })}
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          {/* Search Icon */}
          <i className={`${styles.searchIcon} icon icon-search`} aria-hidden="true"></i>

          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={styles.input}
            aria-label={searchAriaLabel}
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />

          {/* Clear Button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className={styles.clearButton}
              aria-label={clearAriaLabel}
            >
              <i className="icon icon-close icon-sm" aria-hidden="true"></i>
            </button>
          )}

          {/* Keyboard Shortcut Hint */}
          {showShortcut && !isActive && !value && isDesktop && (
            <div className={styles.shortcutHint}>
              <kbd>{modifierKey}</kbd>
              <kbd>K</kbd>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className={styles.spinner} aria-label={loadingAriaLabel}>
              <i className={`${styles.spinnerIcon} icon icon-spinner`} aria-hidden="true"></i>
            </div>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && displayItems.length > 0 && (
        <div className={styles.suggestions} role="listbox">
          {displayItems.map((item, index) => (
            <div
              key={'id' in item ? item.id : `history-${item.text}`}
              id={`suggestion-${index}`}
              className={clsx(styles.suggestion, {
                [styles.selected]: index === selectedIndex,
                [styles.history]: item.type === 'history',
              })}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSuggestionClick(item)}
            >
              <div className={styles.suggestionIcon}>
                <i className={`icon ${item.type === 'history' ? 'icon-clock' : item.type === 'category' ? 'icon-grid' : 'icon-check'}`} aria-hidden="true"></i>
              </div>
              <span className={styles.suggestionText}>{item.text}</span>
              {item.type === 'history' && (
                <div className={styles.historyActions}>
                  <button
                    type="button"
                    className={styles.deleteHistoryButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      onHistoryDelete?.(item.text);
                    }}
                    aria-label={`Remove ${item.text} from search history`}
                    title="Remove from history"
                  >
                    <i className="icon icon-close icon-sm" aria-hidden="true"></i>
                  </button>
                  <span className={styles.suggestionLabel}>Histórico</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};