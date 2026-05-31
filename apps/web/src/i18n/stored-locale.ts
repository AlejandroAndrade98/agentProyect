import { defaultLocale, isSupportedLocale, type Locale } from './config';

export const LOCALE_STORAGE_KEY = 'sales-ai-platform-locale';

export function getStoredAppLocale(): Locale {
  if (typeof window === 'undefined') {
    return defaultLocale;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  return isSupportedLocale(storedLocale) ? storedLocale : defaultLocale;
}
