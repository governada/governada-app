import { describe, expect, it } from 'vitest';
import { formatLocaleDate, formatLocaleNumber, formatLocaleTime } from '@/lib/i18n/format';

describe('i18n format helpers', () => {
  it('formats numbers with the requested locale', () => {
    expect(formatLocaleNumber(12345.6, 'en-US')).toBe('12,345.6');
    expect(formatLocaleNumber(12345.6, 'de-DE')).toBe('12.345,6');
  });

  it('formats dates with the requested locale', () => {
    const value = new Date('2026-04-07T00:00:00.000Z');
    const options = { month: 'short', day: 'numeric', timeZone: 'UTC' } as const;

    expect(formatLocaleDate(value, 'en-US', options)).toBe(
      new Intl.DateTimeFormat('en-US', options).format(value),
    );
    expect(formatLocaleDate(value, 'ja-JP', options)).toBe(
      new Intl.DateTimeFormat('ja-JP', options).format(value),
    );
  });

  it('formats times with the requested locale', () => {
    const value = new Date('2026-04-07T17:45:00.000Z');
    const options = { timeZone: 'UTC' } as const;

    expect(formatLocaleTime(value, 'en-US', options)).toBe(
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short', ...options }).format(value),
    );
    expect(formatLocaleTime(value, 'fr-FR', options)).toBe(
      new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', ...options }).format(value),
    );
  });
});
