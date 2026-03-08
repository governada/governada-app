/**
 * Citizen Milestone Detection
 *
 * Detects and awards milestones for ADA holders (citizens) based on their
 * governance participation: delegation streaks, proposals influenced,
 * engagement actions, and governed ADA.
 *
 * Stores in `citizen_milestones` table (separate from DRep milestones).
 */

import { getSupabaseAdmin } from './supabase';
import { logger } from '@/lib/logger';

export interface CitizenMilestoneDefinition {
  key: string;
  label: string;
  description: string;
  icon: string;
  category: 'delegation' | 'influence' | 'engagement' | 'identity';
  shareText: string;
}

export const CITIZEN_MILESTONES: CitizenMilestoneDefinition[] = [
  // Delegation streaks
  {
    key: 'first-delegation',
    label: 'First Delegation',
    description: 'Delegated to your first DRep',
    icon: 'HandHeart',
    category: 'delegation',
    shareText: 'I just delegated to my first DRep on Cardano!',
  },
  {
    key: 'delegation-streak-10',
    label: '10-Epoch Streak',
    description: 'Delegated for 10 consecutive epochs',
    icon: 'Flame',
    category: 'delegation',
    shareText: "I've been delegated for 10 consecutive epochs on Cardano!",
  },
  {
    key: 'delegation-streak-25',
    label: '25-Epoch Streak',
    description: 'Delegated for 25 consecutive epochs',
    icon: 'Flame',
    category: 'delegation',
    shareText: "25-epoch delegation streak and counting! That's commitment to Cardano governance.",
  },
  {
    key: 'delegation-streak-50',
    label: '50-Epoch Streak',
    description: 'Delegated for 50 consecutive epochs',
    icon: 'Flame',
    category: 'delegation',
    shareText:
      '50-epoch delegation streak! Half a year of continuous governance participation on Cardano.',
  },
  {
    key: 'delegation-streak-100',
    label: '100-Epoch Streak',
    description: 'Delegated for 100 consecutive epochs',
    icon: 'Flame',
    category: 'delegation',
    shareText: "100-epoch delegation streak! I'm a Cardano governance veteran.",
  },

  // Proposals influenced
  {
    key: 'influenced-10',
    label: '10 Proposals Influenced',
    description: 'Your delegation influenced 10 governance votes',
    icon: 'Vote',
    category: 'influence',
    shareText: 'My delegation has influenced 10 governance proposals on Cardano!',
  },
  {
    key: 'influenced-50',
    label: '50 Proposals Influenced',
    description: 'Your delegation influenced 50 governance votes',
    icon: 'Vote',
    category: 'influence',
    shareText: '50 governance proposals influenced through my Cardano delegation!',
  },
  {
    key: 'influenced-100',
    label: '100 Proposals Influenced',
    description: 'Your delegation influenced 100 governance votes',
    icon: 'Vote',
    category: 'influence',
    shareText: "100 proposals influenced! I'm making a real impact on Cardano governance.",
  },

  // Engagement
  {
    key: 'first-engagement',
    label: 'First Civic Action',
    description: 'Cast your first sentiment vote, priority signal, or concern flag',
    icon: 'Megaphone',
    category: 'engagement',
    shareText: 'Just took my first civic action on Cardano governance!',
  },
  {
    key: 'engagement-10',
    label: '10 Civic Actions',
    description: 'Participated in 10 civic engagement actions',
    icon: 'Megaphone',
    category: 'engagement',
    shareText: "10 civic actions and counting! I'm actively shaping Cardano governance.",
  },

  // ADA governed
  {
    key: 'ada-governed-100k',
    label: '100K ADA Governed',
    description: 'Your governance footprint represents 100,000+ ADA',
    icon: 'Coins',
    category: 'identity',
    shareText: 'My governance footprint represents 100K+ ADA on Cardano!',
  },
  {
    key: 'ada-governed-1m',
    label: '1M ADA Governed',
    description: 'Your governance footprint represents 1,000,000+ ADA',
    icon: 'Coins',
    category: 'identity',
    shareText: '1M+ ADA governance footprint! Major voice in the Cardano ecosystem.',
  },
];

/**
 * Check and award citizen milestones for a user.
 * Returns array of newly awarded milestone keys.
 */
export async function checkAndAwardCitizenMilestones(
  userId: string,
  drepId: string | null,
): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  // Fetch existing milestones
  const { data: existing } = await supabase
    .from('citizen_milestones')
    .select('milestone_key')
    .eq('user_id', userId);

  const achieved = new Set((existing || []).map((m) => m.milestone_key));
  const newMilestones: { key: string; label: string }[] = [];

  function award(key: string) {
    if (achieved.has(key)) return;
    const def = CITIZEN_MILESTONES.find((m) => m.key === key);
    if (def) newMilestones.push({ key, label: def.label });
  }

  // First delegation
  if (drepId) {
    award('first-delegation');
  }

  // Delegation streak (from governance footprint API data)
  if (drepId) {
    const { data: footprint } = await supabase
      .from('user_wallets')
      .select('delegation_streak_epochs')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const streak = (footprint as { delegation_streak_epochs?: number } | null)
      ?.delegation_streak_epochs;
    if (streak != null) {
      if (streak >= 10) award('delegation-streak-10');
      if (streak >= 25) award('delegation-streak-25');
      if (streak >= 50) award('delegation-streak-50');
      if (streak >= 100) award('delegation-streak-100');
    }
  }

  // Proposals influenced: count votes cast by user's DRep
  if (drepId) {
    const { count } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('drep_id', drepId);

    const influenced = count ?? 0;
    if (influenced >= 10) award('influenced-10');
    if (influenced >= 50) award('influenced-50');
    if (influenced >= 100) award('influenced-100');
  }

  // Engagement actions: sentiment votes + priority signals + concern flags
  const [sentimentResult, priorityResult, concernResult] = await Promise.all([
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
  ]);

  const engagementCount =
    (sentimentResult.count ?? 0) + (priorityResult.count ?? 0) + (concernResult.count ?? 0);

  if (engagementCount >= 1) award('first-engagement');
  if (engagementCount >= 10) award('engagement-10');

  // ADA governed (from DRep's total delegated stake, representing governance footprint)
  if (drepId) {
    const { data: powerSnapshot } = await supabase
      .from('drep_power_snapshots')
      .select('live_stake_lovelace')
      .eq('drep_id', drepId)
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const governedAda = (powerSnapshot?.live_stake_lovelace ?? 0) / 1_000_000;
    if (governedAda >= 100_000) award('ada-governed-100k');
    if (governedAda >= 1_000_000) award('ada-governed-1m');
  }

  // Persist new milestones
  if (newMilestones.length > 0) {
    const { error } = await supabase.from('citizen_milestones').upsert(
      newMilestones.map((m) => ({
        user_id: userId,
        milestone_key: m.key,
        milestone_label: m.label,
      })),
      { onConflict: 'user_id,milestone_key' },
    );
    if (error) {
      logger.warn('[citizenMilestones] Failed to persist milestones', { error: error.message });
    }
  }

  return newMilestones.map((m) => m.key);
}
