/**
 * Internationalization configuration.
 *
 * Defines supported locales, cookie name, and Accept-Language parsing.
 * Path B approach: browser auto-translate + targeted UI chrome translations.
 *
 * Languages ordered by estimated Cardano governance community size:
 * en (~40-45%), ja (~12-15%), es (~10-12%), ko (~6-8%), pt (~5-7%),
 * fr (~4-5%), de (~3-4%), vi (~3-4%), id (~2-3%), ru (~1-2%),
 * it (~1-2%), ar (~1-2%), he (<1%)
 */

export const SUPPORTED_LOCALES = [
  'en',
  'ja',
  'es',
  'ko',
  'pt',
  'fr',
  'de',
  'vi',
  'id',
  'ru',
  'it',
  'ar',
  'he',
] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const LOCALE_COOKIE = 'governada_locale';
export const LOCALE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/** Native language names for the language picker */
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  ja: '日本語',
  es: 'Español',
  ko: '한국어',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  vi: 'Tiếng Việt',
  id: 'Bahasa Indonesia',
  ru: 'Русский',
  it: 'Italiano',
  ar: 'العربية',
  he: 'עברית',
};

/** RTL locales — used to set dir="rtl" on the html element */
export const RTL_LOCALES: ReadonlySet<SupportedLocale> = new Set(['ar', 'he']);

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

export function resolvePreferredLocale(params: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): SupportedLocale {
  const { cookieLocale, acceptLanguage } = params;

  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  return parseAcceptLanguage(acceptLanguage ?? '');
}
