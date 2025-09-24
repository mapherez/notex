// i18n Implementation
// Simple, scalable internationalization system with JSON locale files

import type { Locale, LocaleDict, EnvironmentSettings } from '@notex/types';
import defaultLocale from './i18n/default.json';
import env from './settings/env.json';

// Get environment settings
const envSettings = env as EnvironmentSettings;

// Dynamically import locale files based on environment and available locales
async function importLocaleFile(locale: Locale): Promise<LocaleDict> {
  try {
    const module = await import(`./i18n/${locale}.json`);
    return module.default;
  } catch (error) {
    console.warn(`Failed to import locale file for ${locale}, falling back to default:`, error);
    return defaultLocale;
  }
}

// Create dynamic locale modules mapping
const createLocaleModules = (): Record<string, () => Promise<LocaleDict>> => {
  const modules: Record<string, () => Promise<LocaleDict>> = {};
  
  // Always include the environment's default language
  modules[envSettings.language] = () => importLocaleFile(envSettings.language as Locale);
  
  // Add fallback to default if different from env language
  if (envSettings.language !== 'en-US') {
    modules['en-US'] = () => importLocaleFile('en-US');
  }
  
  return modules;
};

const localeModules = createLocaleModules();

const loadedLocales = new Map<Locale, LocaleDict>();

// Simple string interpolation
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => 
    params[key] !== undefined ? String(params[key]) : match
  );
}

// Load locale asynchronously
export async function loadLocale(locale: Locale): Promise<LocaleDict> {
  if (loadedLocales.has(locale)) {
    return loadedLocales.get(locale)!;
  }

  try {
    const localeData = await localeModules[locale]?.();
    if (localeData) {
      // Merge with default locale as fallback
      const mergedLocale = { ...defaultLocale, ...localeData };
      loadedLocales.set(locale, mergedLocale);
      return mergedLocale;
    }
  } catch (error) {
    console.warn(`Failed to load locale ${locale}:`, error);
  }
  
  // Fallback to default
  loadedLocales.set(locale, defaultLocale);
  return defaultLocale;
}

// Get locale synchronously (must be loaded first)
export function getLocale(locale: Locale): LocaleDict {
  return loadedLocales.get(locale) || defaultLocale;
}

// Create localize function for a specific locale
export function createLocalizeFunction(locale: Locale) {
  const localeDict = getLocale(locale);
  
  // Simple localize function
  const localize = (key: string, params?: Record<string, string | number>): string => {
    const template = (localeDict as Record<string, string>)[key] || 
                    (defaultLocale as Record<string, string>)[key] || 
                    key;
    return params ? interpolate(template, params) : template;
  };

  // Pluralization function
  const localizeCount = (key: string, count: number, params?: Record<string, string | number>): string => {
    const pluralRule = new Intl.PluralRules(locale).select(count);
    const pluralKey = `${key}_${pluralRule}`;
    
    // Try plural key first, then fallback to base key
    const template = (localeDict as Record<string, string>)[pluralKey] || 
                    (defaultLocale as Record<string, string>)[pluralKey] || 
                    (localeDict as Record<string, string>)[key] || 
                    (defaultLocale as Record<string, string>)[key] || 
                    key;
    
    const mergedParams = { count, ...(params || {}) };
    return interpolate(template, mergedParams);
  };

  return { localize, localizeCount };
}

// Export default locale for immediate use
export { defaultLocale };