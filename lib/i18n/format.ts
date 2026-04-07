import { DEFAULT_LOCALE } from '@/lib/i18n/config';

type LocaleInput = string | undefined;
type DateInput = Date | number | string;

function normalizeLocale(locale?: LocaleInput): string {
  return locale && locale.length > 0 ? locale : DEFAULT_LOCALE;
}

function normalizeDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatLocaleNumber(
  value: number,
  locale?: LocaleInput,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(value);
}

export function formatLocaleDate(
  value: DateInput,
  locale?: LocaleInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(normalizeDate(value));
}

export function formatLocaleTime(
  value: DateInput,
  locale?: LocaleInput,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(normalizeLocale(locale), {
    timeStyle: 'short',
    ...options,
  }).format(normalizeDate(value));
}
