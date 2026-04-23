import en from '../locales/en.json';
import pt from '../locales/pt.json';
import type { Locale } from '../core/models/models';

export const dictionaries = {
  en,
  pt,
} as const;

export type Dictionary = typeof pt;

export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale] ?? dictionaries.pt;

export function getLocaleValue<T>(locale: Locale, key: string): T {
  const dictionary = getDictionary(locale);
  const value = key.split('.').reduce<unknown>((scope, segment) => {
    if (scope && typeof scope === 'object' && segment in scope) {
      return (scope as Record<string, unknown>)[segment];
    }

    return undefined;
  }, dictionary);

  return value as T;
}
