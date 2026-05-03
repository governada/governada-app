import { describe, expect, it } from 'vitest';

describe('preview seed safety checks', () => {
  it('refuses the known production Supabase project', async () => {
    const { assertPreviewSeedTarget } = await import('../../scripts/seed-preview');

    expect(() =>
      assertPreviewSeedTarget('https://pbfprhbaayvcrxokgicr.supabase.co', {
        GOVERNADA_DELEGATION_MODE: 'sandbox',
        SUPABASE_PREVIEW_BRANCH: '1',
      }),
    ).toThrow('Refusing to seed the known production Supabase project');
  });

  it('requires sandbox delegation mode', async () => {
    const { assertPreviewSeedTarget } = await import('../../scripts/seed-preview');

    expect(() =>
      assertPreviewSeedTarget('https://rjcpcmbumdhxfhcypoxs.supabase.co', {
        GOVERNADA_DELEGATION_MODE: 'mainnet',
        SUPABASE_PREVIEW_BRANCH: '1',
      }),
    ).toThrow('Preview seed requires GOVERNADA_DELEGATION_MODE=sandbox');
  });

  it('requires an explicit preview branch marker', async () => {
    const { assertPreviewSeedTarget } = await import('../../scripts/seed-preview');

    expect(() =>
      assertPreviewSeedTarget('https://rjcpcmbumdhxfhcypoxs.supabase.co', {
        GOVERNADA_DELEGATION_MODE: 'sandbox',
      }),
    ).toThrow('Preview seed requires SUPABASE_PREVIEW_BRANCH=1');
  });

  it('accepts a non-production Supabase project in sandbox mode', async () => {
    const { assertPreviewSeedTarget } = await import('../../scripts/seed-preview');

    expect(() =>
      assertPreviewSeedTarget('https://rjcpcmbumdhxfhcypoxs.supabase.co', {
        GOVERNADA_DELEGATION_MODE: 'sandbox',
        SUPABASE_PREVIEW_BRANCH: '1',
      }),
    ).not.toThrow();
  });

  it('strips quoted Supabase CLI env values', async () => {
    const { resolvePreviewSeedConfig } = await import('../../scripts/seed-preview');

    expect(
      resolvePreviewSeedConfig({
        GOVERNADA_DELEGATION_MODE: 'sandbox',
        NEXT_PUBLIC_SUPABASE_URL: '"https://rjcpcmbumdhxfhcypoxs.supabase.co"',
        SUPABASE_PREVIEW_BRANCH: '1',
        SUPABASE_SECRET_KEY: '"sb_secret_preview"',
      }),
    ).toEqual({
      supabaseSecretKey: 'sb_secret_preview',
      supabaseUrl: 'https://rjcpcmbumdhxfhcypoxs.supabase.co',
    });
  });

  it('builds deterministic fixture sizes', async () => {
    const { buildPreviewDReps, buildPreviewSentimentRows, buildPreviewVotes } =
      await import('../../scripts/seed-preview');

    expect(buildPreviewDReps()).toHaveLength(26);
    expect(buildPreviewSentimentRows()).toHaveLength(50);
    expect(buildPreviewVotes()).toHaveLength(10);
  });

  it('uses database-compatible integer DRep confidence scores', async () => {
    const { buildPreviewDReps } = await import('../../scripts/seed-preview');

    expect(buildPreviewDReps().every((drep) => Number.isInteger(drep.confidence))).toBe(true);
  });
});
