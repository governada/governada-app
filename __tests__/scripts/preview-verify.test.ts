import { describe, expect, it } from 'vitest';

describe('preview verifier helpers', () => {
  it('normalizes preview URLs', async () => {
    const { normalizeBaseUrl } = await import('../../scripts/preview-verify.mjs');

    expect(normalizeBaseUrl('stg.governada.io/')).toBe('https://stg.governada.io');
    expect(normalizeBaseUrl('https://stg.governada.io/foo/')).toBe('https://stg.governada.io/foo');
  });

  it('resolves PR URLs from a template', async () => {
    const { resolvePreviewUrl } = await import('../../scripts/preview-verify.mjs');

    expect(
      resolvePreviewUrl({
        pr: '947',
        template: 'https://governada-app-pr-{pr}.up.railway.app',
        url: null,
      }),
    ).toBe('https://governada-app-pr-947.up.railway.app');
  });

  it('matches short and full release SHAs', async () => {
    const { releaseMatchesExpected } = await import('../../scripts/preview-verify.mjs');

    expect(releaseMatchesExpected('abcdef1234567890', 'abcdef1')).toBe(true);
    expect(releaseMatchesExpected('abcdef1', 'abcdef1234567890')).toBe(true);
    expect(releaseMatchesExpected('abcdef1', 'fffffff')).toBe(false);
  });
});
