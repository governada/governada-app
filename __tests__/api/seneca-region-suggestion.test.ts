import { readFile } from 'node:fs/promises';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegionSuggestionSource } from '@/lib/seneca/regionSuggestion';

const cachedMock = vi.fn(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) =>
  fetcher(),
);
const buildContextMock = vi.fn();
const claudeCreateMock = vi.fn();
type TestAnthropicClient = {
  messages: { create: typeof claudeCreateMock };
} | null;
const getAnthropicClientMock = vi.fn(
  async (): Promise<TestAnthropicClient> => ({
    messages: { create: claudeCreateMock },
  }),
);
const logSenecaOutputMock = vi.fn(async () => ({ ok: true }));
const getRedisMock = vi.fn(() => ({}));
const rateLimitMock = vi.fn(async () => ({ success: true, remaining: 9 }));
const slidingWindowMock = vi.fn(() => ({ kind: 'sliding-window' }));
type TestSession = {
  userId: string;
  walletAddress: string;
  stakeAddress: string;
} | null;
const getSessionMock = vi.fn(
  async (): Promise<TestSession> => ({
    userId: 'user-1',
    walletAddress: 'addr_test',
    stakeAddress: 'stake_test',
  }),
);
const derivePersonaMock = vi.fn(async () => ({
  persona: 'citizen',
  delegatedDrepId: 'drep-1',
}));

vi.mock('@/lib/redis', () => ({
  cached: cachedMock,
  getRedis: getRedisMock,
}));

vi.mock('@/lib/navigation/session', () => ({
  getValidatedSessionFromCookies: getSessionMock,
}));

vi.mock('@/lib/governance/derivePersonaFromSession', () => ({
  derivePersonaFromSession: derivePersonaMock,
}));

vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow = slidingWindowMock;

    limit = rateLimitMock;
  },
}));

vi.mock('@/lib/ai', () => ({
  MODELS: { HAIKU: 'claude-haiku-test' },
  getAnthropicClient: getAnthropicClientMock,
}));

vi.mock('@/lib/seneca/outputLog', () => ({
  logSenecaOutput: logSenecaOutputMock,
}));

vi.mock('@/lib/seneca/regionSuggestion', async () => {
  const actual = await vi.importActual<typeof import('@/lib/seneca/regionSuggestion')>(
    '@/lib/seneca/regionSuggestion',
  );
  return {
    ...actual,
    buildRegionSuggestionContext: buildContextMock,
  };
});

describe('seneca region suggestion API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      userId: 'user-1',
      walletAddress: 'addr_test',
      stakeAddress: 'stake_test',
    });
    derivePersonaMock.mockResolvedValue({ persona: 'citizen', delegatedDrepId: 'drep-1' });
    rateLimitMock.mockResolvedValue({ success: true, remaining: 9 });
    getAnthropicClientMock.mockResolvedValue({
      messages: { create: claudeCreateMock },
    });
    buildContextMock.mockResolvedValue({
      cluster: {
        id: 'cluster-1',
        nodeCount: 8,
        dominantAlignmentDimension: 'treasury_conservative',
        recentRationaleCount: 4,
        recentVoteCount: 2,
        averageScore: 72,
        scoreMomentumLastEpoch: 0.4,
        treasuryBehavior: {
          windowDays: 90,
          yesRate: 0.75,
          cumulativeApprovedAda: 47_000_000,
          proposalsConsidered: 4,
        },
      },
      user: {
        persona: 'citizen',
        delegatedDrepId: 'drep-1',
        delegatedDrepInCluster: true,
        matchScores: {
          maxScoreInCluster: 84,
          averageScoreInCluster: 73,
          aboveSeventyCount: 3,
        },
      },
    });
    claudeCreateMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Your strongest match in this cluster scores 84%.' }],
    });
  });

  it('uses a cluster plus user cache key, 60s TTL, and Claude context payload', async () => {
    const { POST } = await import('@/app/api/seneca/region-suggestion/route');
    const response = await POST(
      new NextRequest('http://localhost/api/seneca/region-suggestion', {
        method: 'POST',
        body: JSON.stringify({ clusterId: 'cluster-1', userContextRef: 'stake_test' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      suggestion: 'Your strongest match in this cluster scores 84%.',
      windowDays: 90,
    });
    expect(cachedMock).toHaveBeenCalledWith(
      'seneca:region-suggestion:cluster-1:user-1',
      60,
      expect.any(Function),
    );
    expect(buildContextMock).toHaveBeenCalledWith({
      clusterId: 'cluster-1',
      persona: { persona: 'citizen', delegatedDrepId: 'drep-1' },
      userId: 'user-1',
    });
    expect(claudeCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-test',
        max_tokens: 90,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: expect.stringContaining('"cluster"'),
          },
        ],
      }),
    );
    expect(slidingWindowMock).toHaveBeenCalledWith(10, '60 s');
    expect(logSenecaOutputMock).toHaveBeenCalledWith({
      intent: 'observational',
      outputText: 'Your strongest match in this cluster scores 84%.',
      source: 'region_suggestion',
      userContextIdentifier: 'addr_test',
    });
  });

  it('normalizes anonymous cache keys so userContextRef cannot bust cache', async () => {
    getSessionMock.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/seneca/region-suggestion/route');
    const response = await POST(
      new NextRequest('http://localhost/api/seneca/region-suggestion', {
        method: 'POST',
        body: JSON.stringify({ clusterId: 'cluster-1', userContextRef: 'nonce-a' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      suggestion: 'Your strongest match in this cluster scores 84%.',
      windowDays: 90,
    });
    expect(cachedMock).toHaveBeenCalledWith(
      'seneca:region-suggestion:cluster-1:anonymous',
      60,
      expect.any(Function),
    );
    expect(buildContextMock).toHaveBeenCalledWith({
      clusterId: 'cluster-1',
      persona: { persona: 'anonymous' },
      userId: null,
    });
    expect(derivePersonaMock).not.toHaveBeenCalled();
  });

  it('keeps fallback copy in the same wording constraints as the prompt', async () => {
    getAnthropicClientMock.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/seneca/region-suggestion/route');
    const response = await POST(
      new NextRequest('http://localhost/api/seneca/region-suggestion', {
        method: 'POST',
        body: JSON.stringify({ clusterId: 'cluster-1' }),
      }),
    );

    await expect(response.json()).resolves.toEqual({
      suggestion: '8 DReps here approved 47M ADA in treasury withdrawals over the past quarter.',
      windowDays: 90,
    });
  });

  it('selects cascading treasury behavior windows', async () => {
    const { selectTreasuryBehaviorWindow } = await vi.importActual<
      typeof import('@/lib/seneca/regionSuggestion')
    >('@/lib/seneca/regionSuggestion');

    expect(
      selectTreasuryBehaviorWindow({
        proposals_30d: 3,
        yes_30d: 2,
        approved_30d: 12_000_000,
        proposals_90d: 8,
        yes_90d: 5,
        approved_90d: 47_000_000,
        proposals_180d: 10,
        yes_180d: 6,
        approved_180d: 55_000_000,
        proposals_all_time: 12,
        yes_all_time: 7,
        approved_all_time: 70_000_000,
      })?.windowDays,
    ).toBe(30);

    expect(
      selectTreasuryBehaviorWindow({
        proposals_30d: 2,
        yes_30d: 1,
        approved_30d: 4_000_000,
        proposals_90d: 3,
        yes_90d: 2,
        approved_90d: 16_000_000,
        proposals_180d: 5,
        yes_180d: 3,
        approved_180d: 20_000_000,
        proposals_all_time: 9,
        yes_all_time: 6,
        approved_all_time: 30_000_000,
      })?.windowDays,
    ).toBe(90);

    expect(
      selectTreasuryBehaviorWindow({
        proposals_30d: 2,
        yes_30d: 1,
        approved_30d: 4_000_000,
        proposals_90d: 2,
        yes_90d: 1,
        approved_90d: 10_000_000,
        proposals_180d: 4,
        yes_180d: 3,
        approved_180d: 20_000_000,
        proposals_all_time: 9,
        yes_all_time: 6,
        approved_all_time: 30_000_000,
      })?.windowDays,
    ).toBe(180);

    expect(
      selectTreasuryBehaviorWindow({
        proposals_30d: 2,
        yes_30d: 1,
        approved_30d: 4_000_000,
        proposals_90d: 2,
        yes_90d: 1,
        approved_90d: 10_000_000,
        proposals_180d: 2,
        yes_180d: 1,
        approved_180d: 20_000_000,
        proposals_all_time: 4,
        yes_all_time: 3,
        approved_all_time: 30_000_000,
      })?.windowDays,
    ).toBe('all_time');

    expect(
      selectTreasuryBehaviorWindow({
        proposals_30d: 0,
        yes_30d: 0,
        approved_30d: 0,
        proposals_90d: 0,
        yes_90d: 0,
        approved_90d: 0,
        proposals_180d: 1,
        yes_180d: 1,
        approved_180d: 1_000_000,
        proposals_all_time: 2,
        yes_all_time: 1,
        approved_all_time: 1_000_000,
      }),
    ).toBeUndefined();
  });

  it('builds citizen match scores and nulls them for non-citizens', async () => {
    const { buildRegionSuggestionContext } = await vi.importActual<
      typeof import('@/lib/seneca/regionSuggestion')
    >('@/lib/seneca/regionSuggestion');
    const source: RegionSuggestionSource = {
      readDrepClusterRows: async () =>
        Array.from({ length: 5 }, (_, index) => ({
          id: `drep-${index}`,
          score: 75 - index,
          score_momentum: 0.5 - index * 0.05,
          info: { name: `DRep ${index}` },
          alignment_treasury_conservative: 90,
          alignment_treasury_growth: 30,
          alignment_decentralization: 60,
          alignment_security: 70,
          alignment_innovation: 40,
          alignment_transparency: 80,
        })),
      readRecentClusterStats: async () => ({ recentRationaleCount: 2, recentVoteCount: 3 }),
      readTreasuryBehavior: async () => ({
        windowDays: 30,
        yesRate: 0.66,
        cumulativeApprovedAda: 12_000_000,
        proposalsConsidered: 3,
      }),
      readUserGovernanceProfile: async () => ({
        alignment_scores: {
          treasuryConservative: 90,
          treasuryGrowth: 30,
          decentralization: 60,
          security: 70,
          innovation: 40,
          transparency: 80,
        },
        confidence: 0.8,
        has_quick_match: true,
        votes_used: 0,
      }),
    };

    const citizenContext = await buildRegionSuggestionContext({
      clusterId: 'cluster-0',
      persona: { persona: 'citizen', delegatedDrepId: 'drep-0' },
      userId: 'user-1',
      source,
    });

    expect(citizenContext.user.matchScores?.maxScoreInCluster).toBeGreaterThanOrEqual(90);
    expect(citizenContext.user.matchScores?.aboveSeventyCount).toBeGreaterThanOrEqual(1);
    expect(citizenContext.user.delegatedDrepInCluster).toBe(true);

    const drepContext = await buildRegionSuggestionContext({
      clusterId: 'cluster-0',
      persona: { persona: 'drep' },
      userId: 'user-1',
      source,
    });
    expect(drepContext.user.matchScores).toBeNull();
  });

  it('keeps treasury behavior in one SQL using filtered counts', async () => {
    const migration = await readFile(
      'supabase/migrations/20260507120000_region_suggestion_treasury_behavior.sql',
      'utf8',
    );

    expect(migration).toContain('COUNT(*) FILTER');
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain("interval '90 days'");
    expect(migration).toContain("interval '180 days'");
    expect(migration).toContain('proposals_all_time');
  });
});
