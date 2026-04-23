import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { getDictionary, getLocaleValue } from './dictionaries';
import type { Locale } from '../core/models/models';

type TranslateVars = Record<string, string | number>;

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: TranslateVars) => string;
  raw: <T>(key: string) => T;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readValue(dictionary: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((scope, segment) => {
    if (scope && typeof scope === 'object' && segment in scope) {
      return (scope as Record<string, unknown>)[segment];
    }

    return undefined;
  }, dictionary);
}

function interpolate(value: string, vars?: TranslateVars): string {
  if (!vars) {
    return value;
  }

  return Object.entries(vars).reduce(
    (text, [key, replacement]) => text.split(`{{${key}}}`).join(String(replacement)),
    value,
  );
}

export function I18nProvider({ children, locale }: PropsWithChildren<{ locale: Locale }>) {
  const value = useMemo<I18nContextValue>(() => {
    const dictionary = getDictionary(locale);

    return {
      locale,
      t: (key, vars) => {
        const translated = readValue(dictionary, key);
        if (typeof translated === 'string') {
          return interpolate(translated, vars);
        }

        const fallback = readValue(getDictionary('pt'), key);
        return typeof fallback === 'string' ? interpolate(fallback, vars) : key;
      },
      raw: (key) => getLocaleValue(locale, key),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
