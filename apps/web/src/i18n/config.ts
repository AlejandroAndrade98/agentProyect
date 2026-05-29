import en from './locales/en.json';
import es from './locales/es.json';

export const supportedLocales = ['en', 'es'] as const;

export type Locale = (typeof supportedLocales)[number];

export const defaultLocale: Locale = 'en';

export const dictionaries: Record<Locale, Record<string, unknown>> = {
  en,
  es,
};

export function isSupportedLocale(value: string | null): value is Locale {
  return supportedLocales.includes(value as Locale);
}

export function getTranslation(
  locale: Locale,
  key: string,
): string | undefined {
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, dictionaries[locale]);

  return typeof value === 'string' ? value : undefined;
}
