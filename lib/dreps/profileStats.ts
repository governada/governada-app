import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase';

export interface ScoreSnapshot {
  date: string;
  score: number;
  effectiveParticipation: number;
  rationaleRate: number;
  reliabilityScore: number;
  profileCompleteness: number;
}

export interface SocialLinkCheck {
  uri: string;
  status: 'valid' | 'broken' | 'pending';
  httpStatus: number | null;
  lastCheckedAt: string | null;
}

/**
 * Shared DRep profile metrics and status reads extracted from lib/data.ts.
 * This module is the domain-owned seam for profile stats consumers.
 */
export async function getScoreHistory(drepId: string): Promise<ScoreSnapshot[]> {
  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('drep_score_history')
      .select(
        'snapshot_date, score, effective_participation, rationale_rate, reliability_score, profile_completeness',
      )
      .eq('drep_id', drepId)
      .order('snapshot_date', { ascending: true });

    if (error || !rows) return [];

    return rows.map((r) => ({
      date: r.snapshot_date,
      score: r.score ?? 0,
      effectiveParticipation: r.effective_participation ?? 0,
      rationaleRate: r.rationale_rate ?? 0,
      reliabilityScore: r.reliability_score ?? 0,
      profileCompleteness: r.profile_completeness ?? 0,
    }));
  } catch (err) {
    logger.error('[DRepProfileStats] getScoreHistory error', { error: err });
    return [];
  }
}

/**
 * Get the percentile rank of a DRep's score among all DReps.
 * Returns 0-100 (e.g. 72 means "higher than 72% of DReps").
 */
export async function getDRepPercentile(score: number): Promise<number> {
  try {
    const supabase = createClient();

    const [{ count: belowCount }, { count: totalCount }] = await Promise.all([
      supabase
        .from('dreps')
        .select('*', { count: 'exact', head: true })
        .gt('score', 0)
        .lt('score', score),
      supabase.from('dreps').select('*', { count: 'exact', head: true }).gt('score', 0),
    ]);

    if (!totalCount || totalCount === 0) return 0;
    return Math.round(((belowCount ?? 0) / totalCount) * 100);
  } catch (err) {
    logger.error('[DRepProfileStats] getDRepPercentile error', { error: err });
    return 0;
  }
}

/**
 * Returns the 1-based rank of a DRep by score (1 = highest score).
 */
export async function getDRepRank(drepId: string): Promise<number | null> {
  try {
    const supabase = createClient();
    const { data: drep } = await supabase.from('dreps').select('score').eq('id', drepId).single();
    if (!drep?.score) return null;

    const { count } = await supabase
      .from('dreps')
      .select('*', { count: 'exact', head: true })
      .gt('score', drep.score);
    return (count ?? 0) + 1;
  } catch (err) {
    logger.error('[DRepProfileStats] getDRepRank error', { error: err });
    return null;
  }
}

/**
 * Returns epoch-by-epoch delegation power snapshots for a DRep.
 * Reads from drep_power_snapshots (populated by secondary sync with fresh Koios data)
 * rather than delegation_snapshots (which used stale DB counts).
 */
export async function getDRepDelegationTrend(
  drepId: string,
): Promise<{ epoch: number; votingPowerAda: number; delegatorCount: number }[]> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('drep_power_snapshots')
      .select('epoch_no, amount_lovelace, delegator_count')
      .eq('drep_id', drepId)
      .order('epoch_no', { ascending: true })
      .limit(30);
    return (data ?? []).map((snapshot) => ({
      epoch: snapshot.epoch_no,
      votingPowerAda: Math.round(Number(snapshot.amount_lovelace) / 1_000_000),
      delegatorCount: snapshot.delegator_count ?? 0,
    }));
  } catch (err) {
    logger.error('[DRepProfileStats] getDRepDelegationTrend error', { error: err });
    return [];
  }
}

/**
 * Get social link check results for a DRep.
 */
export async function getSocialLinkChecks(drepId: string): Promise<SocialLinkCheck[]> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('social_link_checks')
      .select('uri, status, http_status, last_checked_at')
      .eq('drep_id', drepId);

    if (error || !data) return [];

    return data.map((row) => ({
      uri: row.uri,
      status: row.status as 'valid' | 'broken' | 'pending',
      httpStatus: row.http_status,
      lastCheckedAt: row.last_checked_at,
    }));
  } catch (err) {
    logger.error('[DRepProfileStats] getSocialLinkChecks error', { error: err });
    return [];
  }
}

/**
 * Check if a DRep has been claimed by any user.
 */
export async function isDRepClaimed(drepId: string): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('users')
      .select('wallet_address')
      .eq('claimed_drep_id', drepId)
      .limit(1);

    if (error) return false;
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
