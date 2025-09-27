// Search history utilities for localStorage management

export const SEARCH_HISTORY_KEY = 'notex_search_history';
const MAX_HISTORY_ITEMS = 5;

/**
 * Get search history from localStorage
 */
export function getSearchHistory(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Failed to load search history from localStorage:', error);
    return [];
  }
}

/**
 * Save search query to history in localStorage
 */
export function saveSearchToHistory(query: string): void {
  if (typeof window === 'undefined' || !query.trim()) return;

  try {
    const history = getSearchHistory();

    // Remove the query if it already exists (to avoid duplicates)
    const filteredHistory = history.filter(item => item !== query.trim());

    // Add the new query at the beginning
    const newHistory = [query.trim(), ...filteredHistory];

    // Keep only the most recent MAX_HISTORY_ITEMS
    const trimmedHistory = newHistory.slice(0, MAX_HISTORY_ITEMS);

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.warn('Failed to save search to history:', error);
  }
}

/**
 * Clear all search history from localStorage
 */
export function clearSearchHistory(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.warn('Failed to clear search history:', error);
  }
}