/**
 * GET /api/intelligence/delegation-coaching
 *
 * Computes delegation coaching insights by finding citizens with similar
 * governance alignment and analyzing their delegation outcomes.
 *
 * Returns comparative framing: "Citizens with similar values who delegated
 * to DRep X saw better coverage."
 *
 * No AI cost — pure database computation using alignment vectors.
 * Feature-flagged behind `ambient_annotations`.
 */

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { getFeatureFlag } from '@/lib/featureFlags';
import type { Json } from '@/types/database';

export const dynamic = 'force-dynamic';

interface AlignmentScores {
  treasuryConservative: number;
  treasuryGrowth: number;
  decentralization: number;
  security: number;
  innovation: number;
  transparency: number;
}

interface CoachingInsight {
  id: string;
  type: 'better_match' | 'rebalance' | 'confirmation';
  text: string;
  variant: 'info' | 'warning' | 'success' | 'neutral';
  /** Suggested DRep if applicable */
  suggestedDrep?: {
    drepId: string;
    name: string;
    score: number;
    matchPercent: number;
  };
  provenance: Array<{ label: string; detail: string }>;
}

interface CoachingResponse {
  insights: CoachingInsight[];
  cohortSize: number;
}

const ALIGNMENT_DIMS: (keyof AlignmentScores)[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

function euclideanDistance(a: AlignmentScores, b: AlignmentScores): number {
  let sum = 0;
  for (const dim of ALIGNMENT_DIMS) {
    const diff = (a[dim] ?? 0) - (b[dim] ?? 0);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function parseAlignment(raw: Json | null): AlignmentScores | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.treasuryConservative !== 'number') return null;
  return obj as unknown as AlignmentScores;
}

export const GET = withRouteHandler(
  async (_request, { userId }: RouteContext) => {
    if (!userId) {
      return NextResponse.json({ insights: [], cohortSize: 0 } satisfies CoachingResponse);
    }

    const flagEnabled = await getFeatureFlag('ambient_annotations');
    if (!flagEnabled) {
      return NextResponse.json({ insights: [], cohortSize: 0 } satisfies CoachingResponse);
    }

    const supabase = getSupabaseAdmin();
    const insights: CoachingInsight[] = [];

    // 1. Get the current user's alignment and delegation
    const [profileResult, walletResult] = await Promise.all([
      supabase
        .from('user_governance_profiles')
        .select('alignment_scores, personality_label, confidence')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_wallets')
        .select('stake_address, drep_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
    ]);

    const userAlignment = parseAlignment(profileResult.data?.alignment_scores ?? null);
    if (!userAlignment || (profileResult.data?.confidence ?? 0) < 0.3) {
      // Not enough data to coach — need at least 30% confidence
      return NextResponse.json({ insights: [], cohortSize: 0 } satisfies CoachingResponse);
    }

    const delegatedDrepId = walletResult.data?.drep_id ?? null;

    // 2. Find similar citizens (by alignment vector distance)
    // Get users with alignment scores and active delegations
    const { data: peers } = await supabase
      .from('user_governance_profiles')
      .select('user_id, alignment_scores, wallet_address')
      .not('alignment_scores', 'is', null)
      .gte('confidence', 0.3)
      .neq('user_id', userId)
      .limit(200);

    if (!peers || peers.length === 0) {
      return NextResponse.json({ insights: [], cohortSize: 0 } satisfies CoachingResponse);
    }

    // Compute distance to each peer and find the closest ones
    const MAX_DISTANCE = 80; // alignment distance threshold for "similar"
    const similarPeers: Array<{
      userId: string;
      walletAddress: string | null;
      distance: number;
      alignment: AlignmentScores;
    }> = [];

    for (const peer of peers) {
      const peerAlignment = parseAlignment(peer.alignment_scores);
      if (!peerAlignment) continue;
      const dist = euclideanDistance(userAlignment, peerAlignment);
      if (dist <= MAX_DISTANCE) {
        similarPeers.push({
          userId: peer.user_id,
          walletAddress: peer.wallet_address,
          distance: dist,
          alignment: peerAlignment,
        });
      }
    }

    if (similarPeers.length < 3) {
      // Too few similar citizens for meaningful coaching
      return NextResponse.json({
        insights: [],
        cohortSize: similarPeers.length,
      } satisfies CoachingResponse);
    }

    // 3. Get delegation info for similar citizens
    const peerWallets = similarPeers.map((p) => p.walletAddress).filter((w): w is string => !!w);

    if (peerWallets.length === 0) {
      return NextResponse.json({
        insights: [],
        cohortSize: similarPeers.length,
      } satisfies CoachingResponse);
    }

    const { data: peerDelegations } = await supabase
      .from('user_wallets')
      .select('drep_id')
      .in('stake_address', peerWallets)
      .not('drep_id', 'is', null);

    if (!peerDelegations || peerDelegations.length === 0) {
      return NextResponse.json({
        insights: [],
        cohortSize: similarPeers.length,
      } satisfies CoachingResponse);
    }

    // 4. Count delegation choices — which DReps do similar citizens prefer?
    const drepCounts = new Map<string, number>();
    for (const del of peerDelegations) {
      if (!del.drep_id) continue;
      drepCounts.set(del.drep_id, (drepCounts.get(del.drep_id) ?? 0) + 1);
    }

    // Sort by popularity among cohort
    const sortedDreps = [...drepCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    if (sortedDreps.length === 0) {
      return NextResponse.json({
        insights: [],
        cohortSize: similarPeers.length,
      } satisfies CoachingResponse);
    }

    // 5. Get DRep details for the top choices
    const topDrepIds = sortedDreps.map(([id]) => id);
    const { data: drepDetails } = await supabase
      .from('dreps')
      .select('drep_id, name, ticker, composite_score, alignment')
      .in('drep_id', topDrepIds);

    if (!drepDetails) {
      return NextResponse.json({
        insights: [],
        cohortSize: similarPeers.length,
      } satisfies CoachingResponse);
    }

    const drepMap = new Map(drepDetails.map((d) => [d.drep_id, d]));

    // 6. Generate coaching insights
    const cohortSize = similarPeers.length;
    const [topDrepId, topCount] = sortedDreps[0];
    const topDrep = drepMap.get(topDrepId);
    const topDrepPct = Math.round((topCount / peerDelegations.length) * 100);

    if (topDrep) {
      const topName = topDrep.name || topDrep.ticker || 'a DRep';
      const topAlignment = parseAlignment(topDrep.alignment as Json);
      const matchPercent = topAlignment
        ? Math.max(0, Math.round((1 - euclideanDistance(userAlignment, topAlignment) / 245) * 100))
        : 0;

      if (delegatedDrepId === topDrepId) {
        // User already delegated to the most popular choice — confirm
        insights.push({
          id: `coaching-confirm-${topDrepId}`,
          type: 'confirmation',
          text: `${topDrepPct}% of citizens with similar values also chose ${topName}. You're well-represented.`,
          variant: 'success',
          provenance: [
            {
              label: 'Cohort',
              detail: `${cohortSize} citizens with similar governance alignment`,
            },
            {
              label: 'Popular choice',
              detail: `${topCount} of ${peerDelegations.length} delegated to ${topName}`,
            },
          ],
        });
      } else if (delegatedDrepId) {
        // User delegated to someone else — suggest the popular alternative
        const currentDrep = drepMap.get(delegatedDrepId);
        const currentScore = currentDrep?.composite_score ?? 0;
        const topScore = topDrep.composite_score ?? 0;

        if (topScore > currentScore + 5) {
          insights.push({
            id: `coaching-better-${topDrepId}`,
            type: 'better_match',
            text: `${topDrepPct}% of citizens with similar values delegated to ${topName} (score: ${Math.round(topScore)}). Worth comparing.`,
            variant: 'info',
            suggestedDrep: {
              drepId: topDrepId,
              name: topName,
              score: Math.round(topScore),
              matchPercent,
            },
            provenance: [
              {
                label: 'Cohort',
                detail: `${cohortSize} citizens with similar governance alignment`,
              },
              {
                label: 'Popular choice',
                detail: `${topCount}/${peerDelegations.length} chose ${topName}`,
              },
              {
                label: 'Score comparison',
                detail: `${topName}: ${Math.round(topScore)} vs your DRep: ${Math.round(currentScore)}`,
              },
            ],
          });
        }
      } else {
        // Not delegated — suggest the popular choice
        insights.push({
          id: `coaching-suggest-${topDrepId}`,
          type: 'rebalance',
          text: `${topDrepPct}% of citizens with similar values delegated to ${topName}. They could be your match.`,
          variant: 'info',
          suggestedDrep: {
            drepId: topDrepId,
            name: topName,
            score: Math.round(topDrep.composite_score ?? 0),
            matchPercent,
          },
          provenance: [
            {
              label: 'Cohort',
              detail: `${cohortSize} citizens with similar governance alignment`,
            },
            {
              label: 'Popular choice',
              detail: `${topCount}/${peerDelegations.length} chose ${topName}`,
            },
          ],
        });
      }
    }

    return NextResponse.json({
      insights: insights.slice(0, 2),
      cohortSize,
    } satisfies CoachingResponse);
  },
  { auth: 'required', rateLimit: { max: 10, window: 60 } },
);
