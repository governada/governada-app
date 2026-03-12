/**
 * Citizen Impact Score Calculation
 *
 * A composite 0-100 score across 4 governance participation pillars:
 *   1. Delegation Tenure (25 pts) — how long you've been delegating
 *   2. Rep Activity (25 pts) — your DRep's participation rate while delegated
 *   3. Engagement Depth (25 pts) — sentiment votes, priorities, assemblies
 *   4. Coverage (25 pts) — proposals covered by your delegation
 *
 * Stored in `citizen_impact_scores` table for fast reads.
 */

import { getSupabaseAdmin } from './supabase';
import { logger } from '@/lib/logger';

export interface ImpactScoreBreakdown {
  score: number;
  delegationTenureScore: number;
  repActivityScore: number;
  engagementDepthScore: number;
  coverageScore: number;
}

/**
 * Calculate the impact score for a citizen.
 * Does NOT persist — call `persistImpactScore()` separately.
 */
export async function calculateImpactScore(
  userId: string,
  drepId: string | null,
): Promise<ImpactScoreBreakdown> {
  const supabase = getSupabaseAdmin();

  // ── Pillar 1: Delegation Tenure (25 pts) ──────────────────────
  // min(streak / 50, 1) * 25
  let delegationTenureScore = 0;
  if (drepId) {
    const { data: walletRow } = await supabase
      .from('user_wallets')
      .select('delegation_streak_epochs')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const streak =
      (walletRow as { delegation_streak_epochs?: number } | null)?.delegation_streak_epochs ?? 0;
    delegationTenureScore = Math.min(streak / 50, 1) * 25;
  }

  // ── Pillar 2: Rep Activity (25 pts) ───────────────────────────
  // DRep's participation rate * 25
  let repActivityScore = 0;
  if (drepId) {
    const { data: drep } = await supabase
      .from('dreps')
      .select('participation_rate')
      .eq('id', drepId)
      .single();

    const participationRate = (drep?.participation_rate ?? 0) / 100; // stored as 0-100
    repActivityScore = Math.min(participationRate, 1) * 25;
  }

  // ── Pillar 3: Engagement Depth (25 pts) ───────────────────────
  // min(actions / 20, 1) * 25
  const [sentimentResult, priorityResult, concernResult, assemblyResult, endorsementResult] =
    await Promise.all([
      supabase
        .from('citizen_sentiment')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('citizen_priority_signals')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('citizen_concern_flags')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('citizen_assembly_votes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
      supabase
        .from('citizen_endorsements')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

  const engagementActions =
    (sentimentResult.count ?? 0) +
    (priorityResult.count ?? 0) +
    (concernResult.count ?? 0) +
    (assemblyResult.count ?? 0) +
    (endorsementResult.count ?? 0);

  const engagementDepthScore = Math.min(engagementActions / 20, 1) * 25;

  // ── Pillar 4: Coverage (25 pts) ───────────────────────────────
  // (proposals voted by DRep / total votable proposals) * 25
  let coverageScore = 0;
  if (drepId) {
    const [votedResult, totalResult] = await Promise.all([
      supabase
        .from('drep_votes')
        .select('vote_tx_hash', { count: 'exact', head: true })
        .eq('drep_id', drepId),
      supabase.from('proposals').select('id', { count: 'exact', head: true }),
    ]);

    const voted = votedResult.count ?? 0;
    const total = totalResult.count ?? 0;
    const coverageRate = total > 0 ? voted / total : 0;
    coverageScore = Math.min(coverageRate, 1) * 25;
  }

  // ── Total ─────────────────────────────────────────────────────
  const score =
    Math.round(
      (delegationTenureScore + repActivityScore + engagementDepthScore + coverageScore) * 100,
    ) / 100;

  return {
    score: Math.min(score, 100),
    delegationTenureScore: Math.round(delegationTenureScore * 100) / 100,
    repActivityScore: Math.round(repActivityScore * 100) / 100,
    engagementDepthScore: Math.round(engagementDepthScore * 100) / 100,
    coverageScore: Math.round(coverageScore * 100) / 100,
  };
}

/**
 * Persist a calculated impact score to the database.
 */
export async function persistImpactScore(
  userId: string,
  breakdown: ImpactScoreBreakdown,
): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('citizen_impact_scores').upsert(
    {
      user_id: userId,
      score: breakdown.score,
      delegation_tenure_score: breakdown.delegationTenureScore,
      rep_activity_score: breakdown.repActivityScore,
      engagement_depth_score: breakdown.engagementDepthScore,
      coverage_score: breakdown.coverageScore,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    logger.warn('[citizenImpactScore] Failed to persist score', { error: error.message, userId });
  }
}

/**
 * Fetch a citizen's impact score from the database.
 */
export async function getImpactScore(userId: string): Promise<ImpactScoreBreakdown | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('citizen_impact_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    score: Number(data.score),
    delegationTenureScore: Number(data.delegation_tenure_score),
    repActivityScore: Number(data.rep_activity_score),
    engagementDepthScore: Number(data.engagement_depth_score),
    coverageScore: Number(data.coverage_score),
  };
}
