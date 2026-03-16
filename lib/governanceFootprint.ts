/**
 * Governance Footprint — builds a comprehensive "citizen report card"
 * combining wallet balance, delegation record, poll participation, and impact metrics.
 */

import { createClient } from '@/lib/supabase';
import { fetchAccountInfo } from '@/utils/koios';
import { lovelaceToAda } from '@/lib/treasury';

export interface GovernanceFootprint {
  identity: {
    balanceAda: number;
    delegatedPool: string | null;
    delegatedDRep: string | null;
    delegationAgeDays: number | null;
    participationTier: 'observer' | 'participant' | 'active' | 'champion';
  };
  delegationRecord: {
    drepName: string | null;
    drepScore: number | null;
    drepRank: number | null;
    keyVotes: number;
    delegationChanges: number;
    /** DRep alignment scores (null if no delegation or alignment not computed) */
    drepAlignment: {
      treasuryConservative: number | null;
      treasuryGrowth: number | null;
      decentralization: number | null;
      security: number | null;
      innovation: number | null;
      transparency: number | null;
    } | null;
  };
  citizenActivity: {
    pollsTaken: number;
    pollStreak: number;
    consistency: number | null;
    epochsActive: number;
    lastActivityEpoch: number | null;
  };
  impact: {
    adaGoverned: number;
    proposalsInfluenced: number;
    delegationWeight: string;
  };
}

function computeParticipationTier(
  pollsTaken: number,
  epochsActive: number,
): GovernanceFootprint['identity']['participationTier'] {
  const score = pollsTaken * 2 + epochsActive;
  if (score >= 20) return 'champion';
  if (score >= 10) return 'active';
  if (score >= 3) return 'participant';
  return 'observer';
}

export async function buildGovernanceFootprint(
  userId: string,
  stakeAddress: string | null,
  overrides?: { delegatedDrepOverride?: string | null },
): Promise<GovernanceFootprint> {
  const supabase = createClient();

  const [accountInfo, pollsResult, eventsResult, userResult] = await Promise.all([
    stakeAddress ? fetchAccountInfo(stakeAddress) : Promise.resolve(null),
    supabase
      .from('poll_responses')
      .select('id, poll_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('governance_events')
      .select('event_type, event_data, epoch, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('users')
      .select('delegation_history, claimed_drep_id, last_visit_at, visit_streak')
      .eq('id', userId)
      .single(),
  ]);

  const balanceAda = accountInfo ? lovelaceToAda(accountInfo.total_balance) : 0;
  const delegatedPool = accountInfo?.delegated_pool || null;
  const delegatedDRep = overrides?.delegatedDrepOverride || accountInfo?.vote_delegation || null;

  const polls = pollsResult.data || [];
  const events = eventsResult.data || [];
  const user = userResult.data;

  const delegationHistory = Array.isArray(user?.delegation_history)
    ? (user.delegation_history as Array<{ drepId: string; timestamp: string }>)
    : [];

  const delegationAgeDays =
    delegationHistory.length > 0
      ? Math.floor(
          (Date.now() -
            new Date(delegationHistory[delegationHistory.length - 1].timestamp).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  let drepName: string | null = null;
  let drepScore: number | null = null;
  let drepRank: number | null = null;
  let drepAlignment: GovernanceFootprint['delegationRecord']['drepAlignment'] = null;
  let keyVotes = 0;

  if (delegatedDRep) {
    const { data: drep } = await supabase
      .from('dreps')
      .select(
        'name, score, rank, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
      )
      .eq('drep_id', delegatedDRep)
      .single();

    if (drep) {
      drepName = drep.name;
      drepScore = drep.score;
      drepRank = drep.rank;
      drepAlignment = {
        treasuryConservative: drep.alignment_treasury_conservative ?? null,
        treasuryGrowth: drep.alignment_treasury_growth ?? null,
        decentralization: drep.alignment_decentralization ?? null,
        security: drep.alignment_security ?? null,
        innovation: drep.alignment_innovation ?? null,
        transparency: drep.alignment_transparency ?? null,
      };
    }

    const { count } = await supabase
      .from('drep_votes')
      .select('vote_tx_hash', { count: 'exact', head: true })
      .eq('drep_id', delegatedDRep);

    keyVotes = count || 0;
  }

  const epochsFromEvents = new Set(events.map((e) => e.epoch).filter(Boolean));
  const epochsActive = epochsFromEvents.size;
  const lastActivityEpoch = events.length > 0 ? events[0].epoch : null;

  let pollStreak = 0;
  if (polls.length > 0) {
    const pollDates = polls.map((p) => new Date(p.created_at).toDateString());
    const uniqueDates = [...new Set(pollDates)];
    pollStreak = Math.min(uniqueDates.length, user?.visit_streak || 0);
  }

  const pollConsistency =
    epochsActive > 0 ? Math.round((polls.length / Math.max(epochsActive, 1)) * 100) : null;

  const proposalsInfluenced = events.filter(
    (e) =>
      e.event_type === 'epoch_summary' && (e.event_data as Record<string, unknown>)?.drepVoteCount,
  ).length;

  const participationTier = computeParticipationTier(polls.length, epochsActive);

  const delegationWeight =
    balanceAda >= 1_000_000
      ? 'whale'
      : balanceAda >= 100_000
        ? 'significant'
        : balanceAda >= 10_000
          ? 'moderate'
          : 'light';

  return {
    identity: {
      balanceAda,
      delegatedPool,
      delegatedDRep,
      delegationAgeDays,
      participationTier,
    },
    delegationRecord: {
      drepName,
      drepScore,
      drepRank,
      keyVotes,
      delegationChanges: delegationHistory.length,
      drepAlignment,
    },
    citizenActivity: {
      pollsTaken: polls.length,
      pollStreak,
      consistency: pollConsistency,
      epochsActive,
      lastActivityEpoch,
    },
    impact: {
      adaGoverned: balanceAda,
      proposalsInfluenced,
      delegationWeight,
    },
  };
}
