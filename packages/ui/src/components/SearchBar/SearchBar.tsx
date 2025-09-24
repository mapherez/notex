'use client';

// SearchBar Component
// Provides search input with autocomplete, keyboard shortcuts, and suggestions

import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import styles from './SearchBar.module.scss';

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'card' | 'category';
  metadata?: Record<string, any>;
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
  /** Additional CSS class */
  className?: string;
  /** Whether to show keyboard shortcut hint */
  showShortcut?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Procurar cartões de conhecimento...',
  loading = false,
  suggestions = [],
  onSuggestionSelect,
  showHistory = true,
  history = [],
  onHistorySelect,
  className,
  showShortcut = true,
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
  const handleSuggestionClick = useCallback((item: SearchSuggestion | { type: 'history'; text: string }, index: number) => {
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
    onChange('');
    inputRef.current?.focus();
    setShowSuggestions(showHistory && history.length > 0);
  }, [onChange, showHistory, history.length]);

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
          <svg
            className={styles.searchIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <Path d="m21 21-4.35-4.35" />
          </svg>

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
            aria-label="Procurar cartões de conhecimento"
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
              aria-label="Limpar pesquisa"
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
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Keyboard Shortcut Hint */}
          {showShortcut && !isActive && !value && (
            <div className={styles.shortcutHint}>
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </div>
          )}

          {/* Loading Spinner */}
          {loading && (
            <div className={styles.spinner} aria-label="A carregar...">
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
              onClick={() => handleSuggestionClick(item, index)}
            >
              <div className={styles.suggestionIcon}>
                {item.type === 'history' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                ) : item.type === 'category' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                    <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
                    <path d="M12 21c0-1-1-3-3-3s-3 2-3 3 1 3 3 3 3-2 3-3" />
                    <path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3" />
                  </svg>
                )}
              </div>
              <span className={styles.suggestionText}>{item.text}</span>
              {item.type === 'history' && (
                <span className={styles.suggestionLabel}>Histórico</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Fix for SVG Path component
const Path: React.FC<{ d: string }> = ({ d }) => <path d={d} />;