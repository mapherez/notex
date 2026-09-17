import en from '../locales/en.json';
import pt from '../locales/pt.json';
import googleEn from '../locales/google.en.json';
import googlePt from '../locales/google.pt.json';
import cloudEn from '../locales/cloud.en.json';
import cloudPt from '../locales/cloud.pt.json';
import type { Locale } from '../core/models/models';

export const dictionaries = {
  en: { ...en, google: googleEn, cloud: cloudEn },
  pt: { ...pt, google: googlePt, cloud: cloudPt },
} as const;

export type Dictionary = typeof dictionaries.pt;

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
