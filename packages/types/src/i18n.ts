// Internationalization Types
// Simple scalable i18n system with JSON locale files

export type Locale = 'pt-PT' | 'en-US';

// Simple key-value locale dictionary (loaded from JSON files)
export type LocaleDict = Record<string, string>;

export interface I18nContext {
  locale: Locale;
  // Simple localize function that takes any string key
  localize: (key: string, params?: Record<string, string | number>) => string;
  // Pluralization function
  localizeCount: (key: string, count: number, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
}