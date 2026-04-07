import { describe, expect, it } from 'vitest';
import { getSafeReturnTo } from '@/lib/navigation/returnTo';

describe('getSafeReturnTo', () => {
  it('accepts internal paths', () => {
    expect(getSafeReturnTo('/workspace/review?proposal=abc')).toBe(
      '/workspace/review?proposal=abc',
    );
  });

  it('rejects external-looking paths', () => {
    expect(getSafeReturnTo('https://example.com')).toBeNull();
    expect(getSafeReturnTo('//example.com')).toBeNull();
  });

  it('rejects missing values', () => {
    expect(getSafeReturnTo(null)).toBeNull();
    expect(getSafeReturnTo(undefined)).toBeNull();
    expect(getSafeReturnTo('')).toBeNull();
  });
});
