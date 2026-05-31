'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  defaultLocale,
  getTranslation,
  isSupportedLocale,
  type Locale,
  supportedLocales,
} from './config';
import { LOCALE_STORAGE_KEY } from './stored-locale';

type I18nContextValue = {
  locale: Locale;
  locales: readonly Locale[];
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    const browserLocale = window.navigator.language.split('-')[0];
    const initialLocale = isSupportedLocale(storedLocale)
      ? storedLocale
      : isSupportedLocale(browserLocale)
        ? browserLocale
        : defaultLocale;

    window.localStorage.setItem(LOCALE_STORAGE_KEY, initialLocale);
    setLocaleState(initialLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const t = useCallback(
    (key: string) =>
      getTranslation(locale, key) ??
      getTranslation(defaultLocale, key) ??
      key,
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      locales: supportedLocales,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
