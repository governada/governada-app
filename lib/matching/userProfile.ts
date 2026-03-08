/**
 * Progressive user governance profile.
 * Recomputes the user's PCA position, alignment scores, personality,
 * and multi-source confidence after every vote.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { loadActivePCA } from '@/lib/alignment/pca';
import { projectUserVector } from '@/lib/representationMatch';
import { getPersonalityLabel } from '@/lib/drepIdentity';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { deriveUserAlignments } from './dimensionAgreement';
import {
  calculateProgressiveConfidence,
  type ConfidenceBreakdown,
  type ConfidenceInputs,
} from './confidence';

export interface UserGovernanceProfile {
  userId: string;
  pcaCoordinates: number[] | null;
  alignmentScores: AlignmentScores;
  personalityLabel: string;
  votesUsed: number;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
}

export async function updateUserProfile(userId: string): Promise<UserGovernanceProfile | null> {
  const supabase = getSupabaseAdmin();

  // Fetch poll votes + engagement data + delegation status in parallel
  const [pollResult, engagementResult, delegationResult, profileResult] = await Promise.all([
    supabase
      .from('poll_responses')
      .select('proposal_tx_hash, proposal_index, vote')
      .eq('user_id', userId),
    gatherEngagementCount(userId),
    checkDelegationStatus(userId),
    supabase
      .from('user_governance_profiles')
      .select('has_quick_match')
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  const pollVotes = pollResult.data;
  if (!pollVotes?.length) return null;

  // Load PCA for projection
  const pca = await loadActivePCA();
  let pcaCoordinates: number[] | null = null;

  if (pca) {
    const userVoteMap = new Map<string, number>();
    for (const pv of pollVotes) {
      const key = `${pv.proposal_tx_hash}-${pv.proposal_index}`;
      const v = pv.vote.toLowerCase();
      userVoteMap.set(key, v === 'yes' ? 1 : v === 'no' ? -1 : 0);
    }
    pcaCoordinates = projectUserVector(userVoteMap, pca.loadings, pca.proposalIds);
  }

  // Load proposal classifications for alignment derivation
  const proposalTxHashes = [...new Set(pollVotes.map((v) => v.proposal_tx_hash))];
  const { data: classifications } = await supabase
    .from('proposal_classifications')
    .select(
      'proposal_tx_hash, proposal_index, dim_treasury_conservative, dim_treasury_growth, dim_decentralization, dim_security, dim_innovation, dim_transparency',
    )
    .in('proposal_tx_hash', proposalTxHashes);

  const classMap = new Map<string, Record<AlignmentDimension, number>>();
  if (classifications) {
    for (const c of classifications) {
      const key = `${c.proposal_tx_hash}-${c.proposal_index}`;
      classMap.set(key, {
        treasuryConservative: Number(c.dim_treasury_conservative) || 0,
        treasuryGrowth: Number(c.dim_treasury_growth) || 0,
        decentralization: Number(c.dim_decentralization) || 0,
        security: Number(c.dim_security) || 0,
        innovation: Number(c.dim_innovation) || 0,
        transparency: Number(c.dim_transparency) || 0,
      });
    }
  }

  const alignmentScores =
    classMap.size > 0
      ? deriveUserAlignments(pollVotes, classMap)
      : ({
          treasuryConservative: null,
          treasuryGrowth: null,
          decentralization: null,
          security: null,
          innovation: null,
          transparency: null,
        } satisfies AlignmentScores);

  const personalityLabel = getPersonalityLabel(alignmentScores);

  // Count distinct proposal types for diversity scoring
  const proposalTypesVoted = await countProposalTypesVoted(proposalTxHashes);

  // Compute progressive confidence
  const hasQuickMatch = profileResult.data?.has_quick_match ?? false;
  const confidenceInputs: ConfidenceInputs = {
    quizAnswerCount: hasQuickMatch ? 3 : 0,
    pollVoteCount: pollVotes.length,
    proposalTypesVoted,
    engagementActionCount: engagementResult,
    hasDelegation: delegationResult,
  };
  const confidenceBreakdown = calculateProgressiveConfidence(confidenceInputs);
  const confidence = confidenceBreakdown.overall / 100; // Store as 0-1

  // Archive to profile history before overwriting
  await supabase
    .from('user_governance_profile_history')
    .insert({
      user_id: userId,
      pca_coordinates: pcaCoordinates,
      alignment_scores: alignmentScores,
      personality_label: personalityLabel,
      votes_used: pollVotes.length,
      confidence,
      confidence_sources: confidenceBreakdown.sources,
    })
    .then(undefined, () => {
      // Non-fatal: history table may not exist yet or insert may fail
    });

  await supabase.from('user_governance_profiles').upsert(
    {
      user_id: userId,
      pca_coordinates: pcaCoordinates,
      alignment_scores: alignmentScores,
      personality_label: personalityLabel,
      votes_used: pollVotes.length,
      confidence,
      confidence_sources: confidenceBreakdown.sources,
      has_quick_match: hasQuickMatch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return {
    userId,
    pcaCoordinates,
    alignmentScores,
    personalityLabel,
    votesUsed: pollVotes.length,
    confidence: confidenceBreakdown.overall,
    confidenceBreakdown,
  };
}

/**
 * Mark that a user has completed the Quick Match quiz.
 * Called from the quick-match API after successful matching.
 */
export async function markQuickMatchCompleted(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await supabase
    .from('user_governance_profiles')
    .upsert(
      { user_id: userId, has_quick_match: true, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
}

/* ─── Helper: gather engagement action count ──────────── */

async function gatherEngagementCount(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  // Count across all engagement tables in parallel
  // Note: citizen_endorsements table not yet created (deferred in Step 6)
  const [sentiment, concerns, impact, priority] = await Promise.all([
    supabase
      .from('citizen_sentiment')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('citizen_concern_flags')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('citizen_impact_tags')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('citizen_priority_signals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);

  return (
    (sentiment.count ?? 0) + (concerns.count ?? 0) + (impact.count ?? 0) + (priority.count ?? 0)
  );
}

/* ─── Helper: check delegation status ─────────────────── */

async function checkDelegationStatus(userId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  // Check if user has any linked wallet with a DRep delegation
  const { data: wallets } = await supabase
    .from('user_wallets')
    .select('drep_id')
    .eq('user_id', userId)
    .not('drep_id', 'is', null)
    .limit(1);

  return (wallets?.length ?? 0) > 0;
}

/* ─── Helper: count distinct proposal types voted on ──── */

async function countProposalTypesVoted(proposalTxHashes: string[]): Promise<number> {
  if (proposalTxHashes.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('proposals')
    .select('proposal_type')
    .in('tx_hash', proposalTxHashes);

  if (!data?.length) return 0;
  const uniqueTypes = new Set(data.map((p) => p.proposal_type));
  return uniqueTypes.size;
}
