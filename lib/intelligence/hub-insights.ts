/**
 * Hub Insights — AI-generated one-line insights for Hub cards.
 *
 * Each insight follows the Perplexity cited-intelligence pattern:
 * a single sentence with a source citation link. Insights are
 * computed server-side and cached for 5 minutes per user.
 *
 * Card ordering is driven by temporal mode (from Phase 6's
 * useGovernanceMode hook) — urgent cards first during voting
 * periods, insight cards during calm periods.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { cached } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HubInsight {
  /** The card this insight belongs to */
  cardId: string;
  /** One-line AI-generated insight text */
  text: string;
  /** Source citation for provenance */
  citation: InsightCitation;
  /** When this was computed */
  computedAt: string;
}

export interface InsightCitation {
  /** Human-readable source label */
  label: string;
  /** Link to source data */
  href: string;
  /** Type of source */
  type: 'vote_record' | 'score_data' | 'proposal' | 'delegation' | 'governance_stats' | 'epoch';
}

export interface HubInsightsResult {
  insights: HubInsight[];
  /** Ordered card IDs based on temporal mode priority */
  cardOrder: string[];
  computedAt: string;
}

// ---------------------------------------------------------------------------
// Card ordering by temporal mode
// ---------------------------------------------------------------------------

type TemporalMode = 'urgent' | 'active' | 'calm';

/**
 * Card priority weights per temporal mode.
 * Higher weight = appears earlier in the list.
 * Cards not listed keep their default order.
 */
const MODE_WEIGHTS: Record<TemporalMode, Record<string, number>> = {
  urgent: {
    alert: 100,
    'drep-action-queue': 95,
    'governance-health': 90,
    'treasury-pulse': 85,
    representation: 70,
    coverage: 65,
    briefing: 60,
    engagement: 50,
    'drep-delegators': 40,
    'drep-score': 35,
    'spo-governance-score': 40,
    'spo-delegators': 35,
    'discovery-match': 20,
    'discovery-explore': 15,
  },
  active: {
    alert: 100,
    'drep-action-queue': 90,
    representation: 80,
    'governance-health': 75,
    coverage: 70,
    'treasury-pulse': 65,
    briefing: 60,
    engagement: 55,
    'drep-delegators': 50,
    'drep-score': 45,
    'spo-governance-score': 50,
    'spo-delegators': 45,
    'discovery-match': 30,
    'discovery-explore': 25,
  },
  calm: {
    representation: 90,
    coverage: 85,
    briefing: 80,
    'drep-score': 75,
    'spo-governance-score': 75,
    'drep-delegators': 70,
    'spo-delegators': 70,
    engagement: 65,
    'governance-health': 60,
    'treasury-pulse': 55,
    alert: 50,
    'drep-action-queue': 45,
    'discovery-match': 40,
    'discovery-explore': 35,
  },
};

/**
 * Sort card IDs by temporal mode priority.
 * Cards maintain a predictable set — only order changes.
 */
export function orderCardsByMode(cardIds: string[], mode: TemporalMode): string[] {
  const weights = MODE_WEIGHTS[mode];
  return [...cardIds].sort((a, b) => {
    const wa = weights[a] ?? 0;
    const wb = weights[b] ?? 0;
    return wb - wa;
  });
}

// ---------------------------------------------------------------------------
// Insight generation
// ---------------------------------------------------------------------------

/**
 * Generate AI insights for hub cards, personalized to the user.
 *
 * Insights are data-driven (not LLM-generated) — they synthesize
 * existing computed signals into human-readable one-liners with
 * source citations.
 */
export async function generateHubInsights(stakeAddress?: string): Promise<HubInsightsResult> {
  const cacheKey = `hub-insights:${stakeAddress ?? 'anon'}`;

  try {
    return await cached(cacheKey, 300, () => generateInsightsUncached(stakeAddress));
  } catch (err) {
    logger.warn('[intelligence/hub-insights] Cache failed, computing directly', { error: err });
    return generateInsightsUncached(stakeAddress);
  }
}

async function generateInsightsUncached(stakeAddress?: string): Promise<HubInsightsResult> {
  const supabase = createClient();
  const insights: HubInsight[] = [];
  const now = new Date().toISOString();

  // Parallel queries for insight generation
  const queries = await Promise.allSettled([
    // Active proposals for governance health insight
    supabase
      .from('proposals')
      .select('tx_hash, proposal_index, title, proposal_type, expiration_epoch', {
        count: 'exact',
      })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null)
      .order('block_time', { ascending: false })
      .limit(5),
    // Governance stats
    supabase.from('governance_stats').select('*').eq('id', 1).single(),
    // User-specific: delegation + DRep info
    stakeAddress
      ? supabase
          .from('dreps')
          .select('id, score, score_momentum, effective_participation, rationale_rate, info')
          .eq('id', stakeAddress)
          .maybeSingle()
      : Promise.resolve(null),
  ]);

  const proposalsResult = queries[0].status === 'fulfilled' ? queries[0].value : null;
  const govStatsResult = queries[1].status === 'fulfilled' ? queries[1].value : null;
  const drepResult =
    queries[2].status === 'fulfilled'
      ? (queries[2].value as { data: Record<string, unknown> | null } | null)
      : null;

  // Epoch calculation
  const SHELLEY_GENESIS = 1596491091;
  const EPOCH_LEN = 432000;
  const SHELLEY_BASE = 209;
  const currentEpoch = Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;

  // -- Governance Health insight --
  if (proposalsResult && 'count' in proposalsResult) {
    const activeCount = proposalsResult.count ?? 0;
    const proposals = proposalsResult.data ?? [];
    const expiringSoon = proposals.filter(
      (p) => p.expiration_epoch != null && p.expiration_epoch <= currentEpoch + 1,
    );

    if (expiringSoon.length > 0) {
      insights.push({
        cardId: 'governance-health',
        text: `${expiringSoon.length} proposal${expiringSoon.length > 1 ? 's' : ''} expiring this epoch — DRep votes needed before deadline`,
        citation: {
          label: 'Active proposals',
          href: '/governance/proposals',
          type: 'proposal',
        },
        computedAt: now,
      });
    } else if (activeCount > 0) {
      insights.push({
        cardId: 'governance-health',
        text: `${activeCount} active proposal${activeCount > 1 ? 's' : ''} under review across the network`,
        citation: {
          label: 'Governance overview',
          href: '/governance/health',
          type: 'governance_stats',
        },
        computedAt: now,
      });
    }
  }

  // -- Treasury insight --
  if (govStatsResult && 'data' in govStatsResult && govStatsResult.data) {
    const stats = govStatsResult.data as Record<string, unknown>;
    const treasuryBalance = stats.treasury_balance as number | undefined;
    if (treasuryBalance && treasuryBalance > 0) {
      const adaBalance = Math.round(treasuryBalance / 1_000_000);
      insights.push({
        cardId: 'treasury-pulse',
        text: `Treasury holds ${(adaBalance / 1_000_000).toFixed(1)}M ADA — community funding pool for proposals`,
        citation: {
          label: 'Treasury data',
          href: '/governance/treasury',
          type: 'governance_stats',
        },
        computedAt: now,
      });
    }
  }

  // -- DRep-specific insights --
  if (drepResult && 'data' in drepResult && drepResult.data) {
    const drep = drepResult.data;
    const momentum = Number(drep.score_momentum ?? 0);
    const participation = Number(drep.effective_participation ?? 0);
    const rationaleRate = Number(drep.rationale_rate ?? 0);

    // Score momentum insight
    if (drep.score_momentum != null) {
      if (momentum > 1) {
        insights.push({
          cardId: 'drep-score',
          text: `Your score is trending up — improved by ${Math.round(momentum)} points recently`,
          citation: {
            label: 'Score history',
            href: '/workspace/performance',
            type: 'score_data',
          },
          computedAt: now,
        });
      } else if (momentum < -1) {
        insights.push({
          cardId: 'drep-score',
          text: `Score dropped ${Math.abs(Math.round(momentum))} points — consider adding rationales to recent votes`,
          citation: {
            label: 'Score breakdown',
            href: '/workspace/performance',
            type: 'score_data',
          },
          computedAt: now,
        });
      }
    }

    // Participation insight
    if (drep.effective_participation != null && participation < 50) {
      insights.push({
        cardId: 'drep-action-queue',
        text: `Participation at ${Math.round(participation)}% — voting on active proposals will improve your score`,
        citation: {
          label: 'Vote record',
          href: '/workspace/votes',
          type: 'vote_record',
        },
        computedAt: now,
      });
    }

    // Rationale rate insight
    if (drep.rationale_rate != null && rationaleRate < 30) {
      insights.push({
        cardId: 'drep-score',
        text: `Only ${Math.round(rationaleRate)}% of your votes have rationales — adding reasoning builds trust with delegators`,
        citation: {
          label: 'Rationale history',
          href: '/workspace/rationales',
          type: 'vote_record',
        },
        computedAt: now,
      });
    }
  }

  // -- Delegation insight for citizens --
  if (stakeAddress && !(drepResult && 'data' in drepResult && drepResult.data)) {
    try {
      // Check delegation status
      const { fetchDelegatedDRep } = await import('@/utils/koios');
      const delegatedDrepId = await fetchDelegatedDRep(stakeAddress);

      if (
        delegatedDrepId &&
        delegatedDrepId !== 'drep_always_abstain' &&
        delegatedDrepId !== 'drep_always_no_confidence'
      ) {
        // Get DRep info for the citizen's representative
        const { data: repDrep } = await supabase
          .from('dreps')
          .select('score, effective_participation, score_momentum, info')
          .eq('id', delegatedDrepId)
          .maybeSingle();

        if (repDrep) {
          const name =
            ((repDrep.info as Record<string, unknown> | null)?.name as string) || 'Your DRep';
          if (repDrep.score_momentum != null && repDrep.score_momentum < -2) {
            insights.push({
              cardId: 'representation',
              text: `${name}'s score has been declining — their governance activity may need attention`,
              citation: {
                label: 'DRep profile',
                href: `/drep/${encodeURIComponent(delegatedDrepId)}`,
                type: 'score_data',
              },
              computedAt: now,
            });
          } else if (
            repDrep.effective_participation != null &&
            repDrep.effective_participation > 80
          ) {
            insights.push({
              cardId: 'representation',
              text: `${name} has ${Math.round(repDrep.effective_participation)}% participation — actively representing your interests`,
              citation: {
                label: 'DRep profile',
                href: `/drep/${encodeURIComponent(delegatedDrepId)}`,
                type: 'vote_record',
              },
              computedAt: now,
            });
          }
        }
      } else if (!delegatedDrepId) {
        insights.push({
          cardId: 'representation',
          text: 'Your ADA is not delegated — find a representative to make your voice count',
          citation: {
            label: 'Match tool',
            href: '/match',
            type: 'delegation',
          },
          computedAt: now,
        });
      }
    } catch {
      // Koios unavailable — skip citizen delegation insight
    }
  }

  return {
    insights,
    cardOrder: [], // Computed client-side with temporal mode
    computedAt: now,
  };
}
