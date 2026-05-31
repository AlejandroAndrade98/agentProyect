import { defaultLocale, isSupportedLocale, type Locale } from './config';

export const LOCALE_STORAGE_KEY = 'sales-ai-platform-locale';

export function getStoredAppLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  const documentLocale = window.document.documentElement.lang;
  const browserLocale = window.navigator.language.split('-')[0];

  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  if (isSupportedLocale(documentLocale)) {
    return documentLocale;
  }

  return isSupportedLocale(browserLocale) ? browserLocale : defaultLocale;
}
