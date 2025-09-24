// Shared UI Types
// Common types used across UI components

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'query' | 'card' | 'category';
  metadata?: Record<string, any>;
}

export interface SearchFilters {
  categories: string[];
  difficulty: string[];
  tags: string[];
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  status?: 'draft' | 'published' | 'archived';
}

export interface SearchResult<T = any> {
  card: T;
  score: number;
  highlights?: {
    title?: string;
    summary?: string;
    body?: string;
  };
}

// Common component props
export interface BaseComponentProps {
  className?: string;
  children?: any; // React.ReactNode equivalent without React dependency
}

// Loading states
export interface LoadingState {
  loading: boolean;
  error?: string;
}

// Pagination
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}