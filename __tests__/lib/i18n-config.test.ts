import { describe, expect, it } from 'vitest';
import { parseAcceptLanguage, resolvePreferredLocale } from '@/lib/i18n/config';

describe('i18n config', () => {
  it('parses the best supported locale from Accept-Language', () => {
    expect(parseAcceptLanguage('pt-BR,pt;q=0.9,en-US;q=0.8')).toBe('pt');
    expect(parseAcceptLanguage('ar-EG,ar;q=0.9,en;q=0.8')).toBe('ar');
  });

  it('prefers a valid locale cookie over the Accept-Language header', () => {
    expect(
      resolvePreferredLocale({
        cookieLocale: 'ja',
        acceptLanguage: 'en-US,en;q=0.9',
      }),
    ).toBe('ja');
  });

  it('falls back to Accept-Language when the cookie is missing or invalid', () => {
    expect(
      resolvePreferredLocale({
        cookieLocale: null,
        acceptLanguage: 'he-IL,he;q=0.9,en;q=0.8',
      }),
    ).toBe('he');

    expect(
      resolvePreferredLocale({
        cookieLocale: 'xx',
        acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8',
      }),
    ).toBe('ko');
  });
});
