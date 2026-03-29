/**
 * Quick Match API — converts value-based answers (3 required + 1 optional) into an alignment
 * vector and matches against DRep (or SPO) alignment scores using Euclidean distance.
 * No wallet/auth required. Supports match_type: 'drep' | 'spo'.
 *
 * Required: treasury, protocol, transparency
 * Optional: decentralization (added in WS-5a for complete 6D coverage)
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  extractAlignments,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
  getDimensionLabel,
  alignmentsToArray,
  getDimensionOrder,
  DIMENSION_ORDER,
} from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { computeDimensionAgreement } from '@/lib/matching/dimensionAgreement';
import { calculateProgressiveConfidence } from '@/lib/matching/confidence';
import { ANSWER_VECTORS } from '@/lib/matching/answerVectors';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

/** Minimum thresholds for match quality — below these, results are noise */
const MIN_MATCH_SCORE = 40;
const MIN_ENTITY_SCORE = 60;

function euclideanDistance(a: AlignmentScores, b: AlignmentScores): number {
  let sum = 0;
  for (const dim of DIMENSION_ORDER) {
    const diff = (a[dim] ?? 50) - (b[dim] ?? 50);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function distanceToScore(distance: number): number {
  // Max possible distance = sqrt(6 * 100^2) ≈ 245
  const maxDist = 245;
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

/**
 * Compute a short signature insight that differentiates each match from the others.
 * Looks at what dimension this entity excels in relative to the group.
 */
function computeSignatureInsights<
  T extends { alignments: AlignmentScores; voteCount?: number; delegatorCount?: number },
>(matches: T[]): string[] {
  if (matches.length === 0) return [];
  if (matches.length === 1) {
    const dom = getDominantDimension(matches[0].alignments);
    return [`Strongest on ${getDimensionLabel(dom)}`];
  }

  const dims = getDimensionOrder();
  const insights: string[] = [];

  for (let idx = 0; idx < matches.length; idx++) {
    const match = matches[idx];
    const scores = alignmentsToArray(match.alignments);

    // Find the dimension where this match stands out most from the average of others
    const otherScores = matches
      .filter((_, i) => i !== idx)
      .map((m) => alignmentsToArray(m.alignments));
    const avgOther = dims.map((_, di) => {
      const sum = otherScores.reduce((s, os) => s + os[di], 0);
      return sum / otherScores.length;
    });

    let maxDiff = -Infinity;
    let standoutDim = 0;
    for (let di = 0; di < dims.length; di++) {
      const diff = scores[di] - avgOther[di];
      if (diff > maxDiff) {
        maxDiff = diff;
        standoutDim = di;
      }
    }

    // Check for behavioral differentiators
    if (
      match.voteCount &&
      matches.every((m, i) => i === idx || !m.voteCount || m.voteCount <= match.voteCount!)
    ) {
      if (match.voteCount > 20) {
        insights.push(`Most active voter · ${match.voteCount} votes`);
        continue;
      }
    }
    if (
      match.delegatorCount &&
      matches.every(
        (m, i) => i === idx || !m.delegatorCount || m.delegatorCount <= match.delegatorCount!,
      )
    ) {
      if (match.delegatorCount > 5) {
        insights.push(`Most trusted · ${match.delegatorCount.toLocaleString()} delegators`);
        continue;
      }
    }

    // Dimension-based insight
    const dimLabel = getDimensionLabel(dims[standoutDim]);
    if (maxDiff > 15) {
      insights.push(`Strongest on ${dimLabel}`);
    } else if (maxDiff > 5) {
      insights.push(`Leans ${dimLabel}`);
    } else {
      // Very balanced across all dimensions relative to others
      insights.push('Most balanced profile');
    }
  }

  return insights;
}

export const POST = withRouteHandler(async (request) => {
  let body: {
    treasury?: string;
    protocol?: string;
    transparency?: string;
    decentralization?: string;
    match_type?: 'drep' | 'spo';
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { treasury, protocol, transparency, decentralization, match_type = 'drep' } = body;

  if (!treasury || !ANSWER_VECTORS.treasury[treasury]) {
    return NextResponse.json({ error: 'Invalid treasury answer' }, { status: 400 });
  }
  if (!protocol || !ANSWER_VECTORS.protocol[protocol]) {
    return NextResponse.json({ error: 'Invalid protocol answer' }, { status: 400 });
  }
  if (!transparency || !ANSWER_VECTORS.transparency[transparency]) {
    return NextResponse.json({ error: 'Invalid transparency answer' }, { status: 400 });
  }
  // Decentralization is optional — validate only if provided
  if (decentralization && !ANSWER_VECTORS.decentralization[decentralization]) {
    return NextResponse.json({ error: 'Invalid decentralization answer' }, { status: 400 });
  }

  // Build user alignment vector from answers
  const userAlignments: AlignmentScores = {
    treasuryConservative: 50,
    treasuryGrowth: 50,
    decentralization: 50,
    security: 50,
    innovation: 50,
    transparency: 50,
  };

  const answerPairs: [string, Partial<AlignmentScores>][] = [
    ['treasury', ANSWER_VECTORS.treasury[treasury]],
    ['protocol', ANSWER_VECTORS.protocol[protocol]],
    ['transparency', ANSWER_VECTORS.transparency[transparency]],
  ];

  // Add decentralization answer if provided (backward compatible — old clients omit it)
  if (decentralization && ANSWER_VECTORS.decentralization[decentralization]) {
    answerPairs.push(['decentralization', ANSWER_VECTORS.decentralization[decentralization]]);
  }

  for (const [, dimScores] of answerPairs) {
    for (const dim of DIMENSION_ORDER) {
      if (dimScores[dim] !== undefined) {
        userAlignments[dim] = dimScores[dim]!;
      }
    }
  }

  const supabase = getSupabaseAdmin();
  const quizAnswerCount = decentralization ? 4 : 3;

  if (match_type === 'spo') {
    // SPO matching — query pools table with behavioral data
    // Filter mirrors /api/governance/constellation: only SPOs with votes appear on the globe
    const { data: pools } = await supabase
      .from('pools')
      .select(
        'pool_id, ticker, pool_name, governance_score, vote_count, participation_pct, delegator_count, current_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .not('alignment_treasury_conservative', 'is', null)
      .gt('vote_count', 0);

    if (!pools?.length) {
      return NextResponse.json({
        matches: [],
        nearMisses: [],
        userAlignments,
        personalityLabel: null,
        matchType: 'spo',
      });
    }

    const allRankedSPO = pools
      .map((p) => {
        const spoAlignments = extractAlignments(p);
        const distance = euclideanDistance(userAlignments, spoAlignments);
        const dimAgreement = computeDimensionAgreement(userAlignments, spoAlignments);
        return {
          entityId: p.pool_id as string,
          entityName: (p.ticker as string) || (p.pool_name as string) || null,
          entityScore: Number(p.governance_score) || 0,
          matchScore: distanceToScore(distance),
          alignments: spoAlignments,
          dominantDimension: getDominantDimension(spoAlignments),
          agreeDimensions: dimAgreement.agreeDimensions,
          differDimensions: dimAgreement.differDimensions,
          voteCount: Number(p.vote_count) || 0,
          delegatorCount: Number(p.delegator_count) || 0,
          tier: (p.current_tier as string) || null,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore || b.entityScore - a.entityScore);

    const ranked = allRankedSPO
      .filter((r) => r.matchScore >= MIN_MATCH_SCORE && r.entityScore >= MIN_ENTITY_SCORE)
      .slice(0, 5);

    // Near-misses: top results that didn't meet thresholds (for empty state guidance)
    const spoNearMisses =
      ranked.length === 0 ? allRankedSPO.filter((r) => !ranked.includes(r)).slice(0, 3) : [];

    const personalityLabel = getPersonalityLabel(userAlignments);
    const dominant = getDominantDimension(userAlignments);
    const identityColor = getIdentityColor(dominant);

    // Baseline confidence from quiz answers (3 required + optional decentralization)
    const spoConfidenceBreakdown = calculateProgressiveConfidence({
      quizAnswerCount,
      pollVoteCount: 0,
      proposalTypesVoted: 0,
      engagementActionCount: 0,
      hasDelegation: false,
    });

    captureServerEvent('quick_match_completed', {
      treasury,
      protocol,
      transparency,
      decentralization: decentralization ?? null,
      match_type: 'spo',
      personality_label: personalityLabel,
      top_match_score: ranked[0]?.matchScore ?? null,
      matches_count: ranked.length,
    });

    const rankedInsights = computeSignatureInsights(ranked);
    const nearMissInsights = computeSignatureInsights(spoNearMisses);

    const formatMatch = (r: (typeof allRankedSPO)[number], insight?: string) => ({
      drepId: r.entityId,
      drepName: r.entityName,
      drepScore: r.entityScore,
      matchScore: r.matchScore,
      alignments: r.alignments,
      identityColor: getIdentityColor(r.dominantDimension).hex,
      personalityLabel: getPersonalityLabel(r.alignments),
      agreeDimensions: r.agreeDimensions,
      differDimensions: r.differDimensions,
      voteCount: r.voteCount,
      delegatorCount: r.delegatorCount,
      tier: r.tier,
      signatureInsight: insight ?? null,
    });

    return NextResponse.json({
      matches: ranked.map((r, i) => formatMatch(r, rankedInsights[i])),
      nearMisses: spoNearMisses.map((r, i) => formatMatch(r, nearMissInsights[i])),
      userAlignments,
      personalityLabel,
      identityColor: identityColor.hex,
      matchType: 'spo',
      confidenceBreakdown: spoConfidenceBreakdown,
    });
  }

  // DRep matching (default) — include behavioral data for card differentiation
  // Filter mirrors /api/governance/constellation: only active DReps appear on the globe
  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, info, score, effective_participation_v3, rationale_rate, current_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
    )
    .not('alignment_treasury_conservative', 'is', null)
    .eq('info->>isActive', 'true');

  if (!dreps?.length) {
    return NextResponse.json({
      matches: [],
      nearMisses: [],
      userAlignments,
      personalityLabel: null,
      matchType: 'drep',
    });
  }

  const allRanked = dreps
    .map((d) => {
      const drepAlignments = extractAlignments(d);
      const distance = euclideanDistance(userAlignments, drepAlignments);
      const dimAgreement = computeDimensionAgreement(userAlignments, drepAlignments);
      const info = d.info as Record<string, unknown> | null;
      return {
        drepId: d.id,
        drepName: (info?.name as string) || null,
        drepScore: Number(d.score) || 0,
        matchScore: distanceToScore(distance),
        alignments: drepAlignments,
        dominantDimension: getDominantDimension(drepAlignments),
        agreeDimensions: dimAgreement.agreeDimensions,
        differDimensions: dimAgreement.differDimensions,
        voteCount: Number((info?.votes_cast as number) ?? 0),
        participationPct: Number(d.effective_participation_v3) || 0,
        rationaleRate: Number(d.rationale_rate) || 0,
        tier: (d.current_tier as string) || null,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || b.drepScore - a.drepScore);

  // Apply quality thresholds before selecting top results
  const qualified = allRanked.filter(
    (r) => r.matchScore >= MIN_MATCH_SCORE && r.drepScore >= MIN_ENTITY_SCORE,
  );
  // Prefer named DReps in results; fall back to unnamed if fewer than 3 named
  const namedRanked = qualified.filter((r) => r.drepName);
  const topRanked = (namedRanked.length >= 3 ? namedRanked : qualified).slice(0, 5);

  // Near-misses: top results that didn't meet thresholds (for empty state guidance)
  const topRankedIds = new Set(topRanked.map((r) => r.drepId));
  const nearMisses =
    topRanked.length === 0
      ? allRanked.filter((r) => !topRankedIds.has(r.drepId) && r.drepName).slice(0, 3)
      : [];

  const personalityLabel = getPersonalityLabel(userAlignments);
  const dominant = getDominantDimension(userAlignments);
  const identityColor = getIdentityColor(dominant);

  // Baseline confidence from quiz answers (3 required + optional decentralization)
  const confidenceBreakdown = calculateProgressiveConfidence({
    quizAnswerCount,
    pollVoteCount: 0,
    proposalTypesVoted: 0,
    engagementActionCount: 0,
    hasDelegation: false,
  });

  captureServerEvent('quick_match_completed', {
    treasury,
    protocol,
    transparency,
    decentralization: decentralization ?? null,
    match_type: 'drep',
    personality_label: personalityLabel,
    top_match_score: topRanked[0]?.matchScore ?? null,
    matches_count: topRanked.length,
  });

  const topInsights = computeSignatureInsights(topRanked);
  const nearMissInsights = computeSignatureInsights(nearMisses);

  const formatDrepMatch = (r: (typeof allRanked)[number], insight?: string) => ({
    drepId: r.drepId,
    drepName: r.drepName,
    drepScore: r.drepScore,
    matchScore: r.matchScore,
    alignments: r.alignments,
    identityColor: getIdentityColor(r.dominantDimension).hex,
    personalityLabel: getPersonalityLabel(r.alignments),
    agreeDimensions: r.agreeDimensions,
    differDimensions: r.differDimensions,
    voteCount: r.voteCount,
    participationPct: r.participationPct,
    rationaleRate: r.rationaleRate,
    tier: r.tier,
    signatureInsight: insight ?? null,
  });

  return NextResponse.json({
    matches: topRanked.map((r, i) => formatDrepMatch(r, topInsights[i])),
    nearMisses: nearMisses.map((r, i) => formatDrepMatch(r, nearMissInsights[i])),
    userAlignments,
    personalityLabel,
    identityColor: identityColor.hex,
    matchType: 'drep',
    confidenceBreakdown,
  });
});
