/**
 * Governance DNA Matches API
 * Returns match scores for all DReps based on a user's poll vote history.
 * Primary: PCA cosine similarity ranking. Fallback: vote-overlap matching.
 * Always computes overlap stats for display + confidence scoring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { projectUserVector, cosineSimilarity } from '@/lib/representationMatch';
import { loadActivePCA } from '@/lib/alignment/pca';
import {
  calculateMatchConfidence,
  calculateProgressiveConfidence,
  type ConfidenceBreakdown,
  type ConfidenceInputs,
} from '@/lib/matching/confidence';
import { computeDimensionAgreement, deriveUserAlignments } from '@/lib/matching/dimensionAgreement';
import { extractAlignments } from '@/lib/drepIdentity';
import type { AlignmentDimension, AlignmentScores } from '@/lib/drepIdentity';
import { createClient, getSupabaseAdmin } from '@/lib/supabase';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

function normalizeVote(vote: string): string {
  return vote.charAt(0).toUpperCase() + vote.slice(1).toLowerCase();
}

export const GET = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const excludeDrepId = request.nextUrl.searchParams.get('currentDrepId') || undefined;
    const supabase = createClient();

    const { data: pollVotes } = await supabase
      .from('poll_responses')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('user_id', userId!);

    if (!pollVotes?.length) {
      return NextResponse.json({
        matches: [],
        currentDRepMatch: null,
        overallConfidence: 0,
        matchMethod: 'none',
      });
    }

    // Build lookup maps
    const userProposalTxHashes = [...new Set(pollVotes.map((v) => v.proposal_tx_hash))];
    const pollVoteMap = new Map<string, string>();
    for (const pv of pollVotes) {
      pollVoteMap.set(`${pv.proposal_tx_hash}-${pv.proposal_index}`, normalizeVote(pv.vote));
    }

    // Fetch all DRep votes on proposals the user voted on
    const { data: candidateVotes } = await supabase
      .from('drep_votes')
      .select('drep_id, proposal_tx_hash, proposal_index, vote')
      .in('proposal_tx_hash', userProposalTxHashes);

    // Per-DRep overlap stats (always needed for display + confidence)
    const overlapMap = new Map<string, { agreed: number; total: number }>();
    if (candidateVotes) {
      for (const cv of candidateVotes) {
        const key = `${cv.proposal_tx_hash}-${cv.proposal_index}`;
        const userVote = pollVoteMap.get(key);
        if (!userVote) continue;

        const entry = overlapMap.get(cv.drep_id) || { agreed: 0, total: 0 };
        entry.total++;
        if (userVote === cv.vote) entry.agreed++;
        overlapMap.set(cv.drep_id, entry);
      }
    }

    // Try PCA matching for ranking
    let matchMethod: 'pca' | 'vote_overlap' = 'vote_overlap';
    let rankedDrepIds: string[];
    const pcaScoreMap = new Map<string, number>();

    const pca = await loadActivePCA();
    if (pca) {
      const userVoteMap = new Map<string, number>();
      for (const pv of pollVotes) {
        const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
        const v = pv.vote.toLowerCase();
        userVoteMap.set(key, v === 'yes' ? 1 : v === 'no' ? -1 : 0);
      }

      const userCoords = projectUserVector(userVoteMap, pca.loadings, pca.proposalIds);
      if (userCoords) {
        const { data: coordRows } = await supabase
          .from('drep_pca_coordinates')
          .select('drep_id, coordinates')
          .eq('run_id', pca.runId);

        if (coordRows?.length) {
          matchMethod = 'pca';
          const similarities = coordRows.map((row) => ({
            drepId: row.drep_id as string,
            similarity: Math.round(cosineSimilarity(userCoords, row.coordinates as number[]) * 100),
          }));
          similarities.sort((a, b) => b.similarity - a.similarity);

          rankedDrepIds = similarities.slice(0, 200).map((s) => s.drepId);
          for (const s of similarities) {
            pcaScoreMap.set(s.drepId, s.similarity);
          }
        } else {
          rankedDrepIds = rankByOverlap(overlapMap);
        }
      } else {
        rankedDrepIds = rankByOverlap(overlapMap);
      }
    } else {
      rankedDrepIds = rankByOverlap(overlapMap);
    }

    // Current DRep match
    let currentDRepMatch = null;
    if (excludeDrepId) {
      const stats = overlapMap.get(excludeDrepId);
      if (stats && stats.total > 0) {
        currentDRepMatch = {
          matchScore:
            matchMethod === 'pca' && pcaScoreMap.has(excludeDrepId)
              ? pcaScoreMap.get(excludeDrepId)!
              : Math.round((stats.agreed / stats.total) * 100),
          agreed: stats.agreed,
          total: stats.total,
        };
      }
    }

    const filteredIds = rankedDrepIds.filter((id) => id !== excludeDrepId).slice(0, 200);

    // Fetch DRep metadata + alignment scores, and proposal classifications in parallel
    const [drepResult, classResult] = await Promise.all([
      supabase
        .from('dreps')
        .select(
          'id, info, score, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .in('id', filteredIds.length > 0 ? filteredIds : ['__none__']),
      supabase
        .from('proposal_classifications')
        .select(
          'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
        )
        .in('proposal_tx_hash', userProposalTxHashes),
    ]);

    const drepInfoMap = new Map<
      string,
      { name: string | null; score: number; alignments: AlignmentScores }
    >();
    if (drepResult.data) {
      for (const d of drepResult.data) {
        drepInfoMap.set(d.id, {
          name: ((d.info as Record<string, unknown>)?.name as string) || null,
          score: Number(d.score) || 0,
          alignments: extractAlignments(d),
        });
      }
    }

    // Build classification map for user alignment derivation
    const classificationMap = new Map<string, Record<AlignmentDimension, number>>();
    if (classResult.data) {
      for (const c of classResult.data) {
        const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
        classificationMap.set(key, {
          treasuryConservative: Number(c.dim_treasury_conservative) || 0,
          treasuryGrowth: Number(c.dim_treasury_growth) || 0,
          decentralization: Number(c.dim_decentralization) || 0,
          security: Number(c.dim_security) || 0,
          innovation: Number(c.dim_innovation) || 0,
          transparency: Number(c.dim_transparency) || 0,
        });
      }
    }

    // Derive user alignment scores from their votes + classifications
    const userAlignments =
      classificationMap.size > 0 ? deriveUserAlignments(pollVotes, classificationMap) : null;

    const overallConfidence = calculateMatchConfidence(pollVotes.length);

    // Compute progressive confidence breakdown
    const confidenceBreakdown = await computeProgressiveConfidenceForUser(
      userId!,
      pollVotes.length,
      userProposalTxHashes,
    );

    const matches = filteredIds.map((drepId) => {
      const info = drepInfoMap.get(drepId);
      const overlap = overlapMap.get(drepId) || { agreed: 0, total: 0 };
      const matchScore =
        matchMethod === 'pca'
          ? (pcaScoreMap.get(drepId) ??
            (overlap.total > 0 ? Math.round((overlap.agreed / overlap.total) * 100) : 0))
          : overlap.total > 0
            ? Math.round((overlap.agreed / overlap.total) * 100)
            : 0;
      const confidence = calculateMatchConfidence(overlap.total);

      let dimensionAgreement = undefined;
      let agreeDimensions = undefined;
      let differDimensions = undefined;
      if (userAlignments && info?.alignments) {
        const dimResult = computeDimensionAgreement(userAlignments, info.alignments);
        dimensionAgreement = dimResult.dimensionAgreement;
        agreeDimensions = dimResult.agreeDimensions;
        differDimensions = dimResult.differDimensions;
      }

      return {
        drepId,
        drepName: info?.name || null,
        drepScore: info?.score || 0,
        matchScore,
        agreed: overlap.agreed,
        overlapping: overlap.total,
        confidence,
        dimensionAgreement,
        agreeDimensions,
        differDimensions,
        alignments: info?.alignments || null,
      };
    });

    captureServerEvent(
      'governance_matches_calculated',
      {
        matches_count: matches.length,
        top_match_score: matches[0]?.matchScore ?? null,
        has_current_drep_match: !!currentDRepMatch,
        match_method: matchMethod,
        user_vote_count: pollVotes.length,
        overall_confidence: overallConfidence,
      },
      wallet!,
    );

    return NextResponse.json({
      matches,
      currentDRepMatch,
      overallConfidence: confidenceBreakdown?.overall ?? overallConfidence,
      matchMethod,
      userAlignments,
      confidenceBreakdown: confidenceBreakdown ?? null,
    });
  },
  { auth: 'required' },
);

function rankByOverlap(overlapMap: Map<string, { agreed: number; total: number }>): string[] {
  return [...overlapMap.entries()]
    .filter(([, m]) => m.total >= 1)
    .sort((a, b) => b[1].agreed / b[1].total - a[1].agreed / a[1].total)
    .map(([id]) => id);
}

async function computeProgressiveConfidenceForUser(
  userId: string,
  pollVoteCount: number,
  proposalTxHashes: string[],
): Promise<ConfidenceBreakdown | null> {
  try {
    const admin = getSupabaseAdmin();

    // Gather inputs in parallel
    const [profileResult, engagementResult, delegationResult, diversityResult] = await Promise.all([
      admin
        .from('user_governance_profiles')
        .select('has_quick_match')
        .eq('user_id', userId)
        .maybeSingle(),
      // Count engagement actions across tables
      Promise.all([
        admin
          .from('citizen_sentiment')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        admin
          .from('citizen_concern_flags')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        admin
          .from('citizen_impact_tags')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        admin
          .from('citizen_priority_signals')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]),
      admin
        .from('user_wallets')
        .select('drep_id')
        .eq('user_id', userId)
        .not('drep_id', 'is', null)
        .limit(1),
      proposalTxHashes.length > 0
        ? admin.from('proposals').select('proposal_type').in('tx_hash', proposalTxHashes)
        : Promise.resolve({ data: [] as { proposal_type: string }[] }),
    ]);

    const engagementCount =
      (engagementResult[0].count ?? 0) +
      (engagementResult[1].count ?? 0) +
      (engagementResult[2].count ?? 0) +
      (engagementResult[3].count ?? 0);

    const uniqueTypes = new Set(
      (diversityResult.data ?? []).map((p: { proposal_type: string }) => p.proposal_type),
    );

    const inputs: ConfidenceInputs = {
      quizAnswerCount: profileResult.data?.has_quick_match ? 3 : 0,
      pollVoteCount,
      proposalTypesVoted: uniqueTypes.size,
      engagementActionCount: engagementCount,
      hasDelegation: (delegationResult.data?.length ?? 0) > 0,
    };

    return calculateProgressiveConfidence(inputs);
  } catch {
    return null;
  }
}
