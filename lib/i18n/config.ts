/**
 * Internationalization configuration.
 *
 * Defines supported locales, cookie name, and Accept-Language parsing.
 * Path B approach: browser auto-translate + targeted UI chrome translations.
 */

export const SUPPORTED_LOCALES = ['en', 'ja', 'es', 'pt', 'id', 'ko'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_COOKIE = 'governada_locale';
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/** Native language names for the language picker */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  ja: '日本語',
  es: 'Español',
  pt: 'Português',
  id: 'Bahasa Indonesia',
  ko: '한국어',
};

export function isValidLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Parse the Accept-Language header and return the best matching supported locale.
 * Falls back to DEFAULT_LOCALE if no match.
 */
export function parseAcceptLanguage(header: string): SupportedLocale {
  if (!header) return DEFAULT_LOCALE;

  // Parse "en-US,en;q=0.9,ja;q=0.8" into sorted list of language codes
  const entries = header
    .split(',')
    .map((part) => {
      const [lang, qStr] = part.trim().split(';q=');
      return { lang: lang.trim().toLowerCase(), q: qStr ? parseFloat(qStr) : 1.0 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of entries) {
    // Exact match (e.g., "ja" matches "ja")
    if (isValidLocale(lang)) return lang;
    // Base language match (e.g., "pt-BR" matches "pt")
    const base = lang.split('-')[0];
    if (isValidLocale(base)) return base;
  }

  return DEFAULT_LOCALE;
}
