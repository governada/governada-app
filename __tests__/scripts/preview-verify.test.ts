import { afterEach, describe, expect, it, vi } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

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

  it('parses retry options', async () => {
    const { parseArgs } = await import('../../scripts/preview-verify.mjs');

    expect(
      parseArgs([
        '--url=https://governada-app-app-pr-948.up.railway.app',
        '--wait-ms=420000',
        '--interval-ms=10000',
      ]),
    ).toMatchObject({
      intervalMs: 10_000,
      waitMs: 420_000,
    });
  });

  it('rejects invalid retry intervals', async () => {
    const { parseArgs } = await import('../../scripts/preview-verify.mjs');

    expect(() =>
      parseArgs(['--url=https://governada-app-app-pr-948.up.railway.app', '--interval-ms=0']),
    ).toThrow('--interval-ms must be at least 1');
  });

  it('matches short and full release SHAs', async () => {
    const { releaseMatchesExpected } = await import('../../scripts/preview-verify.mjs');

    expect(releaseMatchesExpected('abcdef1234567890', 'abcdef1')).toBe(true);
    expect(releaseMatchesExpected('abcdef1', 'abcdef1234567890')).toBe(true);
    expect(releaseMatchesExpected('abcdef1', 'fffffff')).toBe(false);
  });

  it('rejects non-sandbox preview delegation mode', async () => {
    const { checkSandboxMode } = await import('../../scripts/preview-verify.mjs');
    globalThis.fetch = vi.fn(async () => {
      return Response.json({ mode: 'mainnet', sandbox: false });
    }) as typeof fetch;

    await expect(checkSandboxMode('https://preview.example')).resolves.toContain(
      'expected sandbox',
    );
  });

  it('rejects empty constellation data', async () => {
    const { checkConstellationData } = await import('../../scripts/preview-verify.mjs');
    globalThis.fetch = vi.fn(async () => {
      return Response.json({ nodes: [], stats: { activeDReps: 0 } });
    }) as typeof fetch;

    await expect(checkConstellationData('https://preview.example')).resolves.toContain(
      'constellation data was empty',
    );
  });

  it('accepts seeded constellation data', async () => {
    const { checkConstellationData } = await import('../../scripts/preview-verify.mjs');
    globalThis.fetch = vi.fn(async () => {
      return Response.json({ nodes: [{ id: 'preview-drep-1' }], stats: { activeDReps: 1 } });
    }) as typeof fetch;

    await expect(checkConstellationData('https://preview.example')).resolves.toBeNull();
  });
});
