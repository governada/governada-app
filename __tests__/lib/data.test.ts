import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function makeDRepRow(updatedAt: string) {
  return {
    id: 'drep1',
    info: {
      drepHash: 'drep1hash',
      name: 'Alice',
      isActive: true,
      votingPower: 123,
      votingPowerLovelace: '123',
    },
    score: 82,
    participation_rate: 0.8,
    rationale_rate: 0.7,
    reliability_score: 0.9,
    reliability_streak: 3,
    reliability_recency: 1,
    reliability_longest_gap: 0,
    reliability_tenure: 12,
    deliberation_modifier: 1,
    effective_participation: 0.8,
    size_tier: 'Small',
    anchor_hash: null,
    metadata: null,
    profile_completeness: 0.6,
    alignment_treasury_conservative: null,
    alignment_treasury_growth: null,
    alignment_decentralization: null,
    alignment_security: null,
    alignment_innovation: null,
    alignment_transparency: null,
    last_vote_time: null,
    metadata_hash_verified: null,
    updated_at: updatedAt,
    engagement_quality: null,
    engagement_quality_raw: null,
    effective_participation_v3: null,
    effective_participation_v3_raw: null,
    reliability_v3: null,
    reliability_v3_raw: null,
    governance_identity: null,
    governance_identity_raw: null,
    score_momentum: null,
  };
}

async function loadDataModule(rows: unknown[]) {
  const getEnrichedDReps = vi.fn();
  const abortSignal = vi.fn().mockResolvedValue({ data: rows, error: null });
  const range = vi.fn(() => ({ abortSignal }));
  const order = vi.fn(() => ({ range }));
  const select = vi.fn(() => ({ order }));
  const from = vi.fn(() => ({ select }));
  const send = vi.fn().mockResolvedValue(undefined);

  vi.doMock('@/lib/supabase', () => ({
    createClient: () => ({ from }),
  }));
  vi.doMock('@/lib/inngest', () => ({
    inngest: { send },
  }));
  vi.doMock('@/lib/koios', () => ({
    getEnrichedDReps,
  }));
  vi.doMock('@/utils/documentation', () => ({
    isWellDocumented: vi.fn(() => true),
  }));
  vi.doMock('@/lib/logger', () => ({
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));
  vi.doMock('@/lib/constants', () => ({
    getCurrentEpoch: vi.fn(() => 999),
  }));

  const mod = await import('@/lib/data');
  return { getAllDReps: mod.getAllDReps, send, getEnrichedDReps };
}

describe('getAllDReps freshness policy', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T16:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not retrigger syncs during the expected DRep sync window', async () => {
    const { getAllDReps, send } = await loadDataModule([
      makeDRepRow('2026-04-03T09:30:00.000Z'),
    ]);

    const result = await getAllDReps();
    await vi.dynamicImportSettled();

    expect(result.error).toBe(false);
    expect(result.allDReps).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('retriggers syncs only after the overdue threshold is exceeded', async () => {
    const { getAllDReps, send } = await loadDataModule([
      makeDRepRow('2026-04-03T07:59:00.000Z'),
    ]);

    const result = await getAllDReps();
    await vi.dynamicImportSettled();

    expect(result.error).toBe(false);
    expect(result.allDReps).toHaveLength(1);
    expect(send).toHaveBeenCalledWith({ name: 'drepscore/sync.dreps' });
  });

  it('fails the shared read instead of falling back to Koios when the cache is empty', async () => {
    const { getAllDReps, getEnrichedDReps } = await loadDataModule([]);

    await expect(getAllDReps()).rejects.toThrow('DRep cache is empty');
    expect(getEnrichedDReps).not.toHaveBeenCalled();
  });
});
