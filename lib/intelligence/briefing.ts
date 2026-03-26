/**
 * Proactive Seneca Briefing Module — Phase 7 of Inhabited Constellation.
 *
 * Assembles persona-specific governance context for the "DJ mode" —
 * proactive narration on the homepage. The caller (InhabitedConstellation)
 * caches results by epoch-day in session storage to avoid redundant queries.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BriefingContext {
  epoch: number;
  epochDay: number;
  epochDaysRemaining: number;
  governancePulse: number; // 0-100
  persona: 'citizen' | 'drep' | 'spo' | 'cc';
  stakeAddress: string;

  // Citizen-specific
  delegatedDrepName?: string;
  delegatedDrepId?: string;
  driftScore?: number;
  driftClassification?: 'low' | 'moderate' | 'high';

  // Urgent items
  urgentProposals: Array<{
    title: string;
    txHash: string;
    index: number;
    hoursRemaining: number;
    drepVote?: 'Yes' | 'No' | 'Abstain' | null;
    adaAmount?: number;
  }>;

  // DRep-specific
  pendingVoteCount?: number;
  delegatorChange?: number; // +/- from last epoch
  competitiveRank?: number;

  // SPO-specific
  governanceScore?: number;
  scoreTrend?: 'up' | 'down' | 'stable';

  // Personal governance rings
  participation: number;
  deliberation: number;
  impact: number;

  // Neighborhood
  newNeighborDreps?: Array<{ name: string; matchScore: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Cardano epoch length in seconds (5 days). */
const EPOCH_LENGTH_SECONDS = 5 * 24 * 60 * 60;

/** Known reference: epoch 500 started 2024-09-22T21:44:51Z (mainnet). */
const EPOCH_500_START = new Date('2024-09-22T21:44:51Z').getTime();
const EPOCH_500 = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeEpochFromWallclock(): {
  epoch: number;
  epochDay: number;
  epochDaysRemaining: number;
} {
  const now = Date.now();
  const elapsed = (now - EPOCH_500_START) / 1000;
  const epochsSince = Math.floor(elapsed / EPOCH_LENGTH_SECONDS);
  const epoch = EPOCH_500 + epochsSince;
  const secondsIntoEpoch = elapsed - epochsSince * EPOCH_LENGTH_SECONDS;
  const epochDay = Math.floor(secondsIntoEpoch / (24 * 60 * 60)) + 1; // 1-indexed
  const epochDaysRemaining = 5 - epochDay;
  return { epoch, epochDay, epochDaysRemaining: Math.max(0, epochDaysRemaining) };
}

function classifyDrift(score: number): 'low' | 'moderate' | 'high' {
  if (score < 0.2) return 'low';
  if (score < 0.5) return 'moderate';
  return 'high';
}

function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 1;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 1;
  return 1 - dot / denom;
}

// ---------------------------------------------------------------------------
// Epoch context
// ---------------------------------------------------------------------------

async function getEpochContext(
  supabase: ReturnType<typeof createClient>,
): Promise<{ epoch: number; epochDay: number; epochDaysRemaining: number }> {
  try {
    const { data } = await supabase
      .from('governance_stats')
      .select('current_epoch')
      .eq('id', 1)
      .single();

    if (data?.current_epoch) {
      // We have the epoch from the DB — compute day offset from wall clock
      const fallback = computeEpochFromWallclock();
      return {
        epoch: data.current_epoch,
        epochDay: fallback.epochDay,
        epochDaysRemaining: fallback.epochDaysRemaining,
      };
    }
  } catch {
    // Fall through to wall-clock computation
  }

  return computeEpochFromWallclock();
}

// ---------------------------------------------------------------------------
// Governance pulse
// ---------------------------------------------------------------------------

async function getGovernancePulse(supabase: ReturnType<typeof createClient>): Promise<number> {
  try {
    const { data } = await supabase
      .from('governance_health_snapshots')
      .select('composite_score')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.composite_score != null) {
      return Math.round(data.composite_score);
    }
  } catch {
    // Fallback — neutral pulse
  }
  return 50;
}

// ---------------------------------------------------------------------------
// Urgent proposals
// ---------------------------------------------------------------------------

async function getUrgentProposals(
  supabase: ReturnType<typeof createClient>,
  currentEpoch: number,
  delegatedDrepId?: string,
): Promise<BriefingContext['urgentProposals']> {
  try {
    const { data: proposals } = await supabase
      .from('proposals')
      .select('title, tx_hash, index, expiry_epoch, ada_amount')
      .eq('status', 'active')
      .lte('expiry_epoch', currentEpoch + 2)
      .order('expiry_epoch', { ascending: true })
      .limit(5);

    if (!proposals?.length) return [];

    // Check DRep votes if we have a delegated DRep
    let drepVotes: Record<string, string> = {};
    if (delegatedDrepId) {
      const txHashes = proposals.map((p) => p.tx_hash);
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash, vote')
        .eq('drep_id', delegatedDrepId)
        .in('proposal_tx_hash', txHashes);

      if (votes) {
        drepVotes = Object.fromEntries(votes.map((v) => [v.proposal_tx_hash, v.vote]));
      }
    }

    return proposals.map((p) => {
      const epochsRemaining = (p.expiry_epoch ?? currentEpoch) - currentEpoch;
      const hoursRemaining = Math.max(0, epochsRemaining * 5 * 24);
      return {
        title: p.title ?? 'Untitled Proposal',
        txHash: p.tx_hash,
        index: p.index ?? 0,
        hoursRemaining,
        drepVote: (drepVotes[p.tx_hash] as 'Yes' | 'No' | 'Abstain') ?? null,
        adaAmount: p.ada_amount ?? undefined,
      };
    });
  } catch (err) {
    logger.error('briefing: failed to fetch urgent proposals', { error: err });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Citizen context
// ---------------------------------------------------------------------------

async function getCitizenContext(
  supabase: ReturnType<typeof createClient>,
  stakeAddress: string,
): Promise<{
  delegatedDrepName?: string;
  delegatedDrepId?: string;
  driftScore?: number;
  driftClassification?: 'low' | 'moderate' | 'high';
}> {
  try {
    // Get delegation
    const { data: delegation } = await supabase
      .from('user_delegations')
      .select('drep_id')
      .eq('stake_address', stakeAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!delegation?.drep_id) return {};

    // Get DRep name
    const { data: drep } = await supabase
      .from('dreps')
      .select('name, alignment_scores')
      .eq('drep_id', delegation.drep_id)
      .single();

    const result: {
      delegatedDrepName?: string;
      delegatedDrepId?: string;
      driftScore?: number;
      driftClassification?: 'low' | 'moderate' | 'high';
    } = {
      delegatedDrepId: delegation.drep_id,
      delegatedDrepName: drep?.name ?? undefined,
    };

    // Compute drift if we have alignment data for both user and DRep
    if (drep?.alignment_scores) {
      const { data: userProfile } = await supabase
        .from('user_governance_profiles')
        .select('alignment_scores')
        .eq('stake_address', stakeAddress)
        .single();

      if (userProfile?.alignment_scores) {
        const userVec = Object.values(userProfile.alignment_scores as Record<string, number>);
        const drepVec = Object.values(drep.alignment_scores as Record<string, number>);
        if (userVec.length > 0 && userVec.length === drepVec.length) {
          const drift = cosineDistance(userVec, drepVec);
          result.driftScore = Math.round(drift * 100) / 100;
          result.driftClassification = classifyDrift(drift);
        }
      }
    }

    return result;
  } catch (err) {
    logger.error('briefing: failed to fetch citizen context', { error: err });
    return {};
  }
}

// ---------------------------------------------------------------------------
// DRep context
// ---------------------------------------------------------------------------

async function getDRepContext(
  supabase: ReturnType<typeof createClient>,
  drepId: string,
  currentEpoch: number,
): Promise<{
  pendingVoteCount?: number;
  delegatorChange?: number;
  competitiveRank?: number;
}> {
  try {
    // Pending votes — active proposals this DRep hasn't voted on
    const { data: activeProposals } = await supabase
      .from('proposals')
      .select('tx_hash')
      .eq('status', 'active');

    let pendingVoteCount: number | undefined;
    if (activeProposals?.length) {
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('proposal_tx_hash')
        .eq('drep_id', drepId)
        .in(
          'proposal_tx_hash',
          activeProposals.map((p) => p.tx_hash),
        );

      const votedSet = new Set(votes?.map((v) => v.proposal_tx_hash) ?? []);
      pendingVoteCount = activeProposals.filter((p) => !votedSet.has(p.tx_hash)).length;
    }

    // Delegator change — compare current vs previous epoch snapshot
    let delegatorChange: number | undefined;
    const { data: snapshots } = await supabase
      .from('drep_delegator_snapshots')
      .select('epoch, delegator_count')
      .eq('drep_id', drepId)
      .gte('epoch', currentEpoch - 1)
      .order('epoch', { ascending: true })
      .limit(2);

    if (snapshots && snapshots.length === 2) {
      delegatorChange = snapshots[1].delegator_count - snapshots[0].delegator_count;
    }

    // Competitive rank — position among all DReps by composite score
    let competitiveRank: number | undefined;
    const { data: ranked } = await supabase
      .from('dreps')
      .select('drep_id')
      .not('composite_score', 'is', null)
      .order('composite_score', { ascending: false });

    if (ranked) {
      const idx = ranked.findIndex((d) => d.drep_id === drepId);
      if (idx >= 0) competitiveRank = idx + 1;
    }

    return { pendingVoteCount, delegatorChange, competitiveRank };
  } catch (err) {
    logger.error('briefing: failed to fetch DRep context', { error: err });
    return {};
  }
}

// ---------------------------------------------------------------------------
// SPO context
// ---------------------------------------------------------------------------

async function getSPOContext(
  supabase: ReturnType<typeof createClient>,
  poolId: string,
): Promise<{
  governanceScore?: number;
  scoreTrend?: 'up' | 'down' | 'stable';
}> {
  try {
    const { data: scores } = await supabase
      .from('spo_governance_scores')
      .select('overall_score, epoch')
      .eq('pool_id', poolId)
      .order('epoch', { ascending: false })
      .limit(2);

    if (!scores?.length) return {};

    const currentScore = scores[0].overall_score;
    let scoreTrend: 'up' | 'down' | 'stable' = 'stable';

    if (scores.length === 2) {
      const diff = currentScore - scores[1].overall_score;
      if (diff > 2) scoreTrend = 'up';
      else if (diff < -2) scoreTrend = 'down';
    }

    return {
      governanceScore: Math.round(currentScore),
      scoreTrend,
    };
  } catch (err) {
    logger.error('briefing: failed to fetch SPO context', { error: err });
    return {};
  }
}

// ---------------------------------------------------------------------------
// Governance rings
// ---------------------------------------------------------------------------

async function getGovernanceRings(
  supabase: ReturnType<typeof createClient>,
  stakeAddress: string,
): Promise<{ participation: number; deliberation: number; impact: number }> {
  try {
    const { data } = await supabase
      .from('user_engagement_metrics')
      .select('participation_score, deliberation_score, impact_score')
      .eq('stake_address', stakeAddress)
      .single();

    if (data) {
      return {
        participation: data.participation_score ?? 0,
        deliberation: data.deliberation_score ?? 0,
        impact: data.impact_score ?? 0,
      };
    }
  } catch {
    // Default to zeros
  }
  return { participation: 0, deliberation: 0, impact: 0 };
}

// ---------------------------------------------------------------------------
// New neighbor DReps
// ---------------------------------------------------------------------------

async function getNewNeighborDreps(
  supabase: ReturnType<typeof createClient>,
  stakeAddress: string,
  currentEpoch: number,
): Promise<Array<{ name: string; matchScore: number }>> {
  try {
    // Get user alignment vector
    const { data: userProfile } = await supabase
      .from('user_governance_profiles')
      .select('alignment_scores')
      .eq('stake_address', stakeAddress)
      .single();

    if (!userProfile?.alignment_scores) return [];

    const userVec = Object.values(userProfile.alignment_scores as Record<string, number>);
    if (userVec.length === 0) return [];

    // Get DReps registered in the last epoch with alignment scores
    const { data: newDreps } = await supabase
      .from('dreps')
      .select('name, drep_id, alignment_scores')
      .gte('registered_epoch', currentEpoch - 1)
      .not('alignment_scores', 'is', null)
      .limit(20);

    if (!newDreps?.length) return [];

    const neighbors: Array<{ name: string; matchScore: number }> = [];

    for (const drep of newDreps) {
      if (!drep.alignment_scores) continue;
      const drepVec = Object.values(drep.alignment_scores as Record<string, number>);
      if (drepVec.length !== userVec.length) continue;

      const similarity = 1 - cosineDistance(userVec, drepVec);
      if (similarity > 0.6) {
        neighbors.push({
          name: drep.name ?? drep.drep_id,
          matchScore: Math.round(similarity * 100),
        });
      }
    }

    return neighbors.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  } catch (err) {
    logger.error('briefing: failed to fetch neighbor DReps', { error: err });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main assembler
// ---------------------------------------------------------------------------

export async function assembleBriefingContext(
  userId: string,
  stakeAddress: string,
  persona: 'citizen' | 'drep' | 'spo' | 'cc',
  drepId?: string,
  poolId?: string,
): Promise<BriefingContext | null> {
  try {
    const supabase = createClient();

    // Parallel fetches for shared context
    const [epochCtx, pulse, rings] = await Promise.all([
      getEpochContext(supabase),
      getGovernancePulse(supabase),
      getGovernanceRings(supabase, stakeAddress),
    ]);

    // Citizen delegation context (needed for urgent proposals DRep vote check)
    let citizenCtx: Awaited<ReturnType<typeof getCitizenContext>> = {};
    if (persona === 'citizen') {
      citizenCtx = await getCitizenContext(supabase, stakeAddress);
    }

    // Determine which DRep ID to use for vote checks on urgent proposals
    const effectiveDrepId = drepId ?? citizenCtx.delegatedDrepId;

    // Parallel persona-specific fetches
    const [urgentProposals, drepCtx, spoCtx, neighbors] = await Promise.all([
      getUrgentProposals(supabase, epochCtx.epoch, effectiveDrepId),
      persona === 'drep' && drepId
        ? getDRepContext(supabase, drepId, epochCtx.epoch)
        : Promise.resolve({}),
      persona === 'spo' && poolId ? getSPOContext(supabase, poolId) : Promise.resolve({}),
      getNewNeighborDreps(supabase, stakeAddress, epochCtx.epoch),
    ]);

    return {
      epoch: epochCtx.epoch,
      epochDay: epochCtx.epochDay,
      epochDaysRemaining: epochCtx.epochDaysRemaining,
      governancePulse: pulse,
      persona,
      stakeAddress,

      // Citizen
      delegatedDrepName: citizenCtx.delegatedDrepName,
      delegatedDrepId: citizenCtx.delegatedDrepId,
      driftScore: citizenCtx.driftScore,
      driftClassification: citizenCtx.driftClassification,

      // Urgent
      urgentProposals,

      // DRep
      pendingVoteCount: (drepCtx as { pendingVoteCount?: number }).pendingVoteCount,
      delegatorChange: (drepCtx as { delegatorChange?: number }).delegatorChange,
      competitiveRank: (drepCtx as { competitiveRank?: number }).competitiveRank,

      // SPO
      governanceScore: (spoCtx as { governanceScore?: number }).governanceScore,
      scoreTrend: (spoCtx as { scoreTrend?: 'up' | 'down' | 'stable' }).scoreTrend,

      // Rings
      participation: rings.participation,
      deliberation: rings.deliberation,
      impact: rings.impact,

      // Neighborhood
      newNeighborDreps: neighbors.length > 0 ? neighbors : undefined,
    };
  } catch (err) {
    logger.error('briefing: failed to assemble context', {
      error: err,
      context: 'briefing',
      userId,
      persona,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Briefing system prompt builder
// ---------------------------------------------------------------------------

export function buildBriefingSystemPrompt(context: BriefingContext): string {
  const urgentSection =
    context.urgentProposals.length > 0
      ? context.urgentProposals
          .map((p) => {
            const voteStatus = p.drepVote
              ? `Your DRep voted ${p.drepVote}.`
              : 'Your DRep has NOT voted yet.';
            const amount = p.adaAmount ? ` (₳${(p.adaAmount / 1_000_000).toLocaleString()})` : '';
            return `- "${p.title}"${amount} — ${p.hoursRemaining}h remaining. ${voteStatus} [[globe:pulse:proposal_${p.txHash}_${p.index}]]`;
          })
          .join('\n')
      : 'No urgent proposals this epoch.';

  const citizenSection =
    context.persona === 'citizen' && context.delegatedDrepId
      ? `
CITIZEN DELEGATION:
- Delegated to: ${context.delegatedDrepName ?? context.delegatedDrepId} [[globe:flyTo:drep_${context.delegatedDrepId}]]
- Alignment drift: ${context.driftClassification ?? 'unknown'}${context.driftScore != null ? ` (${context.driftScore})` : ''}
`
      : '';

  const drepSection =
    context.persona === 'drep'
      ? `
DREP STATUS:
- Pending votes: ${context.pendingVoteCount ?? 0}
- Delegator change: ${context.delegatorChange != null ? (context.delegatorChange >= 0 ? `+${context.delegatorChange}` : `${context.delegatorChange}`) : 'N/A'}
- Competitive rank: ${context.competitiveRank != null ? `#${context.competitiveRank}` : 'N/A'}
`
      : '';

  const spoSection =
    context.persona === 'spo'
      ? `
SPO STATUS:
- Governance score: ${context.governanceScore ?? 'N/A'}/100
- Trend: ${context.scoreTrend ?? 'unknown'}
`
      : '';

  const neighborSection = context.newNeighborDreps?.length
    ? `
NEW NEIGHBORS (recently registered DReps aligned with this user):
${context.newNeighborDreps.map((n) => `- ${n.name} (${n.matchScore}% match)`).join('\n')}
`
    : '';

  return `You are Seneca, a direct and unflinching governance companion on Governada.
Your task: deliver a proactive governance briefing for this user's homepage.

VOICE RULES:
- Speak like a trusted advisor — direct, concise, no pleasantries.
- Never say "I think" or "In my opinion". State observations as facts.
- Use second person ("you have 3 proposals to watch").
- No filler, no fluff. Every sentence must carry information.

STRUCTURE:
1. Open with: "Epoch {epoch}, day {day}. Governance pulse: {score}."
2. Deliver 2-3 beats based on the context below — prioritize urgent items, then persona-specific insights, then neighborhood changes.
3. Embed globe commands at natural points in the narrative (see format below).
4. Close with governance rings status and one specific suggested next action.
5. Keep total response under 150 words.

GLOBE COMMAND FORMAT — embed these inline where contextually relevant:
- [[globe:flyTo:drep_<id>]] when mentioning a specific DRep
- [[globe:highlight:treasury]] when discussing treasury proposals
- [[globe:pulse:proposal_<txHash>_<index>]] when mentioning a specific proposal
- [[globe:reset]] at the very end to return camera to user position

CURRENT CONTEXT:
Epoch: ${context.epoch}, Day: ${context.epochDay}, Days remaining: ${context.epochDaysRemaining}
Governance pulse: ${context.governancePulse}/100
Persona: ${context.persona}

URGENT PROPOSALS:
${urgentSection}
${citizenSection}${drepSection}${spoSection}${neighborSection}
GOVERNANCE RINGS:
- Participation: ${context.participation}/100
- Deliberation: ${context.deliberation}/100
- Impact: ${context.impact}/100

Remember: Be Seneca. No hedging. No filler. Deliver the briefing, embed globe commands, suggest one action. End with [[globe:reset]].`;
}
