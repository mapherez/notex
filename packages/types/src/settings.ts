// Settings Management Types
// Scalable settings system with default, market-specific, and environment configurations

import type { FilterOption } from './ui';

export interface ButtonConfig {
  labelKey: string
  variant: 'primary' | 'secondary' | 'ghost'
  href?: string
  onClick?: string
}

export interface AppSettings {
  SETUP: {
    language: string
    currency?: string
    timezone?: string
    theme?: 'light' | 'dark' | 'auto'
    gitHubPages?: string
    languages?: string[]
  }
  METADATA?: {
    title?: string
    description?: string
    keywords?: string[]
    author?: string
    themeColor?: {
      light?: string
      dark?: string
    }
  }
  UI: {
    cardLayout?: 'grid' | 'list'
    cardsPerPage?: number
    showDescriptions?: boolean
    compactMode?: boolean
  }
  SEARCH: {
    enableFullText?: boolean
    highlightMatches?: boolean
    maxSuggestions?: number
    debounceMs?: number
  }
  EDITOR: {
    autoSave?: boolean
    autoSaveDelay?: number
    confirmDelete?: boolean
    enableMarkdown?: boolean
  }
  HOMEPAGE?: {
    searchPlaceholder?: string
    categoryOptions?: FilterOption[]
    difficultyOptions?: FilterOption[]
    buttons?: {
      viewCards?: ButtonConfig
      learnMore?: ButtonConfig
      viewDemo?: ButtonConfig
      clearFilters?: ButtonConfig
      addCard?: ButtonConfig
      loadMore?: ButtonConfig
    }
    auth?: {
      buttons?: {
        signIn?: ButtonConfig
        signOut?: ButtonConfig
        googleSignIn?: ButtonConfig
      }
    }
  }
  FILTERS?: {
    categoryOptions?: FilterOption[]
    difficultyOptions?: FilterOption[]
  }
}

export type RawMarketSettings = Partial<AppSettings>

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface EnvironmentSettings {
  language: string
  market: string
  nodeEnv: 'development' | 'production' | 'test'
}