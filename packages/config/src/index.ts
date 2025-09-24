// Configuration and settings
export * from './i18n';

// Settings Management System
export * from './settings';

// Utilities
export { deepMerge, deepMergeMultiple, type DeepPartial } from './utils/object';

export const config = {
  defaultLocale: 'pt-PT' as const,
  supportedLocales: ['pt-PT', 'en-US'] as const,
};