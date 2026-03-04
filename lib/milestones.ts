import { getSupabaseAdmin } from '@/lib/supabase';

export interface MilestoneDefinition {
  key: string;
  label: string;
  description: string;
  icon: string;
  category:
    | 'delegators'
    | 'score'
    | 'rationale'
    | 'participation'
    | 'profile'
    | 'tier'
    | 'streak'
    | 'anniversary';
}

export const MILESTONES: MilestoneDefinition[] = [
  {
    key: 'claimed-profile',
    label: 'Profile Claimed',
    description: 'Claimed your DRepScore profile',
    icon: 'Shield',
    category: 'profile',
  },
  {
    key: 'first-10-delegators',
    label: 'First 10 Delegators',
    description: 'Reached 10 delegators',
    icon: 'Users',
    category: 'delegators',
  },
  {
    key: 'first-100-delegators',
    label: 'First 100 Delegators',
    description: 'Reached 100 delegators',
    icon: 'Users',
    category: 'delegators',
  },
  {
    key: 'first-1000-delegators',
    label: 'First 1000 Delegators',
    description: 'Reached 1,000 delegators',
    icon: 'Users',
    category: 'delegators',
  },
  {
    key: 'score-above-80-30d',
    label: 'Consistent Excellence',
    description: 'Score above 80 for 30+ days',
    icon: 'Star',
    category: 'score',
  },
  {
    key: 'all-pillars-strong',
    label: 'Well-Rounded',
    description: 'All pillars above 70',
    icon: 'Target',
    category: 'score',
  },
  {
    key: 'rationale-streak-5',
    label: 'Rationale Streak 5',
    description: '5 consecutive votes with rationale',
    icon: 'FileText',
    category: 'rationale',
  },
  {
    key: 'rationale-streak-10',
    label: 'Rationale Streak 10',
    description: '10 consecutive votes with rationale',
    icon: 'FileText',
    category: 'rationale',
  },
  {
    key: 'perfect-participation-epoch',
    label: 'Perfect Epoch',
    description: 'Voted on all proposals in an epoch',
    icon: 'CheckCircle2',
    category: 'participation',
  },

  // Phase A: Tier milestones
  {
    key: 'first-bronze',
    label: 'Bronze Tier',
    description: 'Reached Bronze governance tier',
    icon: 'Medal',
    category: 'tier',
  },
  {
    key: 'first-silver',
    label: 'Silver Tier',
    description: 'Reached Silver governance tier',
    icon: 'Medal',
    category: 'tier',
  },
  {
    key: 'first-gold',
    label: 'Gold Tier',
    description: 'Reached Gold governance tier',
    icon: 'Award',
    category: 'tier',
  },
  {
    key: 'first-diamond',
    label: 'Diamond Tier',
    description: 'Reached Diamond governance tier',
    icon: 'Gem',
    category: 'tier',
  },
  {
    key: 'first-legendary',
    label: 'Legendary Tier',
    description: 'Reached Legendary governance tier',
    icon: 'Crown',
    category: 'tier',
  },

  // Phase A: Voting streak milestones
  {
    key: 'voting-streak-10',
    label: '10-Epoch Streak',
    description: 'Voted in 10 consecutive epochs',
    icon: 'Flame',
    category: 'streak',
  },
  {
    key: 'voting-streak-25',
    label: '25-Epoch Streak',
    description: 'Voted in 25 consecutive epochs',
    icon: 'Flame',
    category: 'streak',
  },
  {
    key: 'voting-streak-50',
    label: '50-Epoch Streak',
    description: 'Voted in 50 consecutive epochs',
    icon: 'Flame',
    category: 'streak',
  },

  // Phase A: Delegation anniversaries
  {
    key: 'delegation-anniversary-1',
    label: 'First Anniversary',
    description: 'One year as a DRep',
    icon: 'Cake',
    category: 'anniversary',
  },

  // Phase A: Score personal bests
  {
    key: 'score-personal-best',
    label: 'Personal Best',
    description: 'Achieved your highest-ever governance score',
    icon: 'TrendingUp',
    category: 'score',
  },

  // Phase A: First rationale
  {
    key: 'first-rationale',
    label: 'First Rationale',
    description: 'Submitted your first vote rationale',
    icon: 'PenLine',
    category: 'rationale',
  },

  // Phase A: Delegator milestones (extended)
  {
    key: 'first-500-delegators',
    label: 'First 500 Delegators',
    description: 'Reached 500 delegators',
    icon: 'Users',
    category: 'delegators',
  },
];

export interface AchievedMilestone {
  milestoneKey: string;
  achievedAt: string;
}

export async function getAchievedMilestones(drepId: string): Promise<AchievedMilestone[]> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('drep_milestones')
    .select('milestone_key, achieved_at')
    .eq('drep_id', drepId);
  return (data || []).map((d: { milestone_key: string; achieved_at: string }) => ({
    milestoneKey: d.milestone_key,
    achievedAt: d.achieved_at,
  }));
}

export async function checkAndAwardMilestones(drepId: string): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  const [achieved, drepResult, votesResult, scoreHistoryResult] = await Promise.all([
    getAchievedMilestones(drepId),
    supabase
      .from('dreps')
      .select(
        'score, info, effective_participation, rationale_rate, reliability_score, profile_completeness',
      )
      .eq('id', drepId)
      .single(),
    supabase
      .from('drep_votes')
      .select('epoch_no, meta_url')
      .eq('drep_id', drepId)
      .order('block_time', { ascending: false }),
    supabase
      .from('drep_score_history')
      .select('score, snapshot_date')
      .eq('drep_id', drepId)
      .order('snapshot_date', { ascending: false })
      .limit(60),
  ]);

  const drep = drepResult.data;
  const votes = votesResult.data || [];
  const scoreHistory = scoreHistoryResult.data || [];
  if (!drep) return [];

  const existing = new Set(achieved.map((a) => a.milestoneKey));
  const newMilestones: string[] = [];

  function award(key: string) {
    if (existing.has(key)) return;
    newMilestones.push(key);
  }

  // Claimed profile — awarded elsewhere but check
  const { data: claimedUser } = await supabase
    .from('users')
    .select('wallet_address')
    .eq('claimed_drep_id', drepId)
    .limit(1);
  if (claimedUser && claimedUser.length > 0) award('claimed-profile');

  // Delegator milestones
  const delegators = (drep.info as { delegatorCount?: number })?.delegatorCount || 0;
  if (delegators >= 10) award('first-10-delegators');
  if (delegators >= 100) award('first-100-delegators');
  if (delegators >= 500) award('first-500-delegators');
  if (delegators >= 1000) award('first-1000-delegators');

  // Score milestones
  if (
    drep.effective_participation >= 70 &&
    drep.rationale_rate >= 70 &&
    drep.reliability_score >= 70 &&
    drep.profile_completeness >= 70
  ) {
    award('all-pillars-strong');
  }

  // Score above 80 for 30 days
  if (scoreHistory.length >= 30) {
    const last30 = scoreHistory.slice(0, 30);
    if (last30.every((s: { score: number }) => s.score >= 80)) award('score-above-80-30d');
  }

  // Rationale streaks — check consecutive votes with rationale
  let streak = 0;
  let maxStreak = 0;
  for (const v of votes) {
    if (v.meta_url) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else streak = 0;
  }
  if (maxStreak >= 5) award('rationale-streak-5');
  if (maxStreak >= 10) award('rationale-streak-10');

  // Perfect participation epoch — check if any epoch has votes on all proposals
  // Simplified: check if voted on 5+ proposals in any single epoch
  const epochCounts = new Map<number, number>();
  for (const v of votes) {
    if (!v.epoch_no) continue;
    epochCounts.set(v.epoch_no, (epochCounts.get(v.epoch_no) || 0) + 1);
  }
  // Get total proposals per epoch from proposals table
  const { data: proposals } = await supabase
    .from('proposals')
    .select('proposed_epoch')
    .not('proposed_epoch', 'is', null);
  const proposalsPerEpoch = new Map<number, number>();
  for (const p of proposals || []) {
    if (!(p as { proposed_epoch?: number }).proposed_epoch) continue;
    const epoch = (p as { proposed_epoch: number }).proposed_epoch;
    proposalsPerEpoch.set(epoch, (proposalsPerEpoch.get(epoch) || 0) + 1);
  }
  for (const [epoch, count] of epochCounts.entries()) {
    const total = proposalsPerEpoch.get(epoch) || 0;
    if (total > 0 && count >= total) {
      award('perfect-participation-epoch');
      break;
    }
  }

  // Tier milestones
  const { data: tierData } = await supabase
    .from('dreps')
    .select('current_tier')
    .eq('id', drepId)
    .single();
  const currentTier = tierData?.current_tier;
  const tierMap: Record<string, string> = {
    Bronze: 'first-bronze',
    Silver: 'first-silver',
    Gold: 'first-gold',
    Diamond: 'first-diamond',
    Legendary: 'first-legendary',
  };
  if (currentTier && tierMap[currentTier]) {
    const tierKeys = Object.keys(tierMap);
    const tierIdx = tierKeys.indexOf(currentTier);
    for (let i = 0; i <= tierIdx; i++) {
      award(tierMap[tierKeys[i]]);
    }
  }

  // Voting streak milestones (consecutive epochs with votes)
  const epochSet = new Set(
    votes.map((v: { epoch_no?: number | null }) => v.epoch_no).filter(Boolean),
  );
  const sortedEpochs = [...epochSet].sort((a, b) => (a as number) - (b as number));
  let maxVotingStreak = 0;
  let currentStreak = 1;
  for (let i = 1; i < sortedEpochs.length; i++) {
    if ((sortedEpochs[i] as number) === (sortedEpochs[i - 1] as number) + 1) {
      currentStreak++;
      maxVotingStreak = Math.max(maxVotingStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  maxVotingStreak = Math.max(maxVotingStreak, currentStreak);
  if (maxVotingStreak >= 10) award('voting-streak-10');
  if (maxVotingStreak >= 25) award('voting-streak-25');
  if (maxVotingStreak >= 50) award('voting-streak-50');

  // First rationale
  if (votes.some((v: { meta_url?: string | null }) => v.meta_url)) {
    award('first-rationale');
  }

  // Score personal best
  if (scoreHistory.length > 1) {
    const currentScore = drep.score ?? 0;
    const previousBest = Math.max(...scoreHistory.slice(1).map((s: { score: number }) => s.score));
    if (currentScore > previousBest) award('score-personal-best');
  }

  // Persist new milestones
  if (newMilestones.length > 0) {
    await supabase.from('drep_milestones').upsert(
      newMilestones.map((key) => ({ drep_id: drepId, milestone_key: key })),
      { onConflict: 'drep_id,milestone_key' },
    );
  }

  return newMilestones;
}
