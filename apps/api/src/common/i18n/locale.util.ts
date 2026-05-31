export type SupportedOutputLocale = 'en' | 'es';

export type OutputLocalePreference = {
  locale: SupportedOutputLocale;
  languageName: 'English' | 'Spanish';
};

const DEFAULT_OUTPUT_LOCALE: OutputLocalePreference = {
  locale: 'en',
  languageName: 'English',
};

const SUPPORTED_OUTPUT_LOCALES: Record<
  SupportedOutputLocale,
  OutputLocalePreference
> = {
  en: DEFAULT_OUTPUT_LOCALE,
  es: {
    locale: 'es',
    languageName: 'Spanish',
  },
};

export function normalizeOutputLocale(value: unknown): OutputLocalePreference {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== 'string') {
    return DEFAULT_OUTPUT_LOCALE;
  }

  const locale = rawValue.trim().toLowerCase().split(',')[0]?.split('-')[0];

  return locale === 'en' || locale === 'es'
    ? SUPPORTED_OUTPUT_LOCALES[locale]
    : DEFAULT_OUTPUT_LOCALE;
}
