/**
 * Narrative Template Engine — generates contextual prose from existing data.
 * Template-based (not AI) — smart string interpolation with personality.
 *
 * Voice: warm, knowledgeable, slightly opinionated. Like a governance-passionate
 * friend who speaks plainly. Never corporate, never academic.
 */

import { getDimensionLabel, type AlignmentScores, getDominantDimension } from './drepIdentity';
import { computeTier, type TierName } from '@/lib/scoring/tiers';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function _pct(n: number | null | undefined): string {
  return `${Math.round(n ?? 0)}%`;
}

function formatAdaCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return Math.round(amount).toLocaleString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function participationWord(rate: number): string {
  if (rate >= 90) return 'nearly everything';
  if (rate >= 75) return 'most proposals';
  if (rate >= 50) return 'the majority of proposals';
  if (rate >= 25) return 'some proposals';
  return 'relatively few proposals';
}

function trendWord(delta: number): string {
  if (delta > 10) return 'surging';
  if (delta > 3) return 'climbing';
  if (delta > 0) return 'up';
  if (delta < -10) return 'dropping sharply';
  if (delta < -3) return 'declining';
  if (delta < 0) return 'down';
  return 'holding steady';
}

// ---------------------------------------------------------------------------
// DRep Profile Narrative
// ---------------------------------------------------------------------------

export interface DRepNarrativeData {
  name: string;
  participationRate: number;
  rationaleRate: number;
  drepScore: number;
  rank: number | null;
  delegatorCount: number;
  votingPower: number;
  alignments: AlignmentScores;
  isActive: boolean;
  totalVotes: number;
  sizeTier: string;
  /** Optional: total active DReps for rank context */
  totalActiveDReps?: number;
  /** Optional: score momentum for trajectory */
  scoreMomentum?: number | null;
  /** Optional: endorsement count for social proof */
  endorsementCount?: number;
}

/**
 * AI-enhanced DRep narrative. Falls back to template if AI is unavailable.
 * Call from cron jobs or server-side; results should be cached.
 */
export async function generateAIDRepNarrative(data: DRepNarrativeData): Promise<string | null> {
  const template = generateDRepNarrative(data);
  if (!template || !data.isActive || data.totalVotes < 3) return template;

  try {
    const { generateText } = await import('./ai');
    const dominant = getDominantDimension(data.alignments);
    const dominantLabel = getDimensionLabel(dominant).toLowerCase();

    const prompt = `Write a 2-sentence governance personality profile for a Cardano DRep. Tone: editorial, warm, like a journalist profiling a public figure. Use the data below — keep all numbers accurate. Do NOT use the DRep's name in the first word.

Name: ${data.name}
Score: ${data.drepScore}/100 (rank #${data.rank ?? '?'})
Focus: ${dominantLabel}
Participation: votes on ${Math.round(data.participationRate)}% of proposals
Rationale: provides reasoning ${Math.round(data.rationaleRate)}% of the time
Delegators: ${data.delegatorCount.toLocaleString()}
Voting power: ${formatAdaCompact(data.votingPower)} ADA
Size tier: ${data.sizeTier}
Total votes cast: ${data.totalVotes}

Output only the 2-sentence profile. No quotation marks, no preamble.`;

    const aiNarrative = await generateText(prompt, { maxTokens: 200 });
    if (aiNarrative && aiNarrative.length > 20) return aiNarrative.trim();
  } catch (err) {
    logger.error('[Narrative] AI generation failed', { error: err });
  }
  return template;
}

export function generateDRepNarrative(data: DRepNarrativeData): string | null {
  if (!data.isActive && data.totalVotes === 0) {
    return `Registered as a DRep but hasn't cast a vote yet. Their governance record is a blank slate — check back once they start participating.`;
  }

  if (!data.isActive) {
    return `Currently inactive. Previously voted on ${data.totalVotes} proposal${data.totalVotes !== 1 ? 's' : ''} with ${data.delegatorCount.toLocaleString()} delegator${data.delegatorCount !== 1 ? 's' : ''} representing ${formatAdaCompact(data.votingPower)} ADA. Inactive DReps can't vote on your behalf.`;
  }

  const dominant = getDominantDimension(data.alignments);
  const dominantLabel = getDimensionLabel(dominant).toLowerCase();
  const tier = computeTier(data.drepScore);
  const parts: string[] = [];

  // Sentence 1: Thesis — what kind of participant are they?
  const pRate = Math.round(data.participationRate);
  const rRate = Math.round(data.rationaleRate);

  if (pRate >= 80 && rRate >= 70) {
    parts.push(
      `Votes on ${_pct(data.participationRate)} of proposals and explains their reasoning ${_pct(data.rationaleRate)} of the time — a ${dominantLabel} advocate who shows up and does the work.`,
    );
  } else if (pRate >= 60) {
    parts.push(
      `Votes on ${_pct(data.participationRate)} of proposals${rRate >= 40 ? ` with rationale ${_pct(data.rationaleRate)} of the time` : ' but rarely explains their reasoning'}. Leans toward ${dominantLabel}.`,
    );
  } else {
    parts.push(
      `Has voted on ${_pct(data.participationRate)} of proposals${data.totalVotes > 0 ? ` (${data.totalVotes} total)` : ''}. ${rRate > 0 ? `Provides reasoning ${_pct(data.rationaleRate)} of the time.` : 'Has not published vote rationale yet.'}`,
    );
  }

  // Sentence 2: Context — rank, trajectory, social proof
  const contextBits: string[] = [];

  // Rank context (specific, not vague)
  if (data.rank && data.totalActiveDReps && data.totalActiveDReps > 0) {
    const topPct = Math.max(1, Math.round((data.rank / data.totalActiveDReps) * 100));
    if (topPct <= 10) {
      contextBits.push(`top ${topPct}% of active DReps`);
    } else if (topPct <= 25) {
      contextBits.push(`ranked #${data.rank} of ${data.totalActiveDReps}`);
    }
  } else if (data.rank && data.rank <= 20) {
    contextBits.push(`ranked #${data.rank}`);
  }

  // Trajectory
  if (data.scoreMomentum && Math.abs(data.scoreMomentum) > 0.5) {
    contextBits.push(data.scoreMomentum > 0 ? 'score trending up' : 'score trending down');
  }

  // Social proof
  if (data.endorsementCount && data.endorsementCount >= 3) {
    contextBits.push(`trusted by ${data.endorsementCount} citizens`);
  }

  // Delegation size
  if (data.delegatorCount > 0) {
    contextBits.push(
      `${data.delegatorCount.toLocaleString()} delegator${data.delegatorCount !== 1 ? 's' : ''} · ${formatAdaCompact(data.votingPower)} ADA`,
    );
  }

  if (contextBits.length > 0) {
    const tierPrefix =
      tier === 'Gold' || tier === 'Diamond' || tier === 'Legendary' ? `${tier}-tier` : '';
    if (tierPrefix) {
      parts.push(`${tierPrefix}: ${contextBits.join(', ')}.`);
    } else {
      parts.push(`${contextBits.join(', ').replace(/^./, (c) => c.toUpperCase())}.`);
    }
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Proposals Page Narrative
// ---------------------------------------------------------------------------

export interface ProposalsNarrativeData {
  openCount: number;
  expiringCount: number;
  totalAdaAtStake: number;
  totalVotesCast: number;
  currentEpoch: number;
}

export function generateProposalsNarrative(data: ProposalsNarrativeData): string | null {
  if (data.openCount === 0) {
    return pick([
      'No proposals are open right now. The governance pipeline has quiet moments — a good time to review past decisions.',
      'All proposals have been resolved. Check back soon or review how past proposals were decided.',
    ]);
  }

  const parts: string[] = [];

  if (data.expiringCount > 0) {
    parts.push(
      `${data.openCount} proposal${data.openCount !== 1 ? 's are' : ' is'} live. ${data.expiringCount} expire${data.expiringCount === 1 ? 's' : ''} this epoch`,
    );
    if (data.totalAdaAtStake > 0) {
      parts[0] += `, requesting ${formatAdaCompact(data.totalAdaAtStake)} ADA from the treasury`;
    }
    parts[0] += '.';
  } else {
    parts.push(
      `${data.openCount} proposal${data.openCount !== 1 ? 's are' : ' is'} open for voting.`,
    );
    if (data.totalAdaAtStake > 0) {
      parts.push(
        `${formatAdaCompact(data.totalAdaAtStake)} ADA in treasury requests are on the table.`,
      );
    }
  }

  if (data.totalVotesCast > 100) {
    parts.push(`${data.totalVotesCast.toLocaleString()} votes cast so far.`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Dashboard Narrative
// ---------------------------------------------------------------------------

export interface DashboardNarrativeData {
  pendingCount: number;
  drepScore: number;
  scoreChange: number | null;
  percentile: number;
  delegatorCount: number;
  drepName: string;
}

export function generateDashboardNarrative(data: DashboardNarrativeData): string | null {
  const parts: string[] = [];

  if (data.pendingCount > 0) {
    parts.push(
      `${data.pendingCount} proposal${data.pendingCount !== 1 ? 's are' : ' is'} waiting for your vote.`,
    );
  } else {
    parts.push("You're all caught up — no proposals need your attention right now.");
  }

  if (data.scoreChange !== null && data.scoreChange !== 0) {
    const topPct = Math.max(1, Math.round(100 - data.percentile));
    parts.push(
      `Your score is ${trendWord(data.scoreChange)} ${Math.abs(data.scoreChange)} point${Math.abs(data.scoreChange) !== 1 ? 's' : ''} — you're in the top ${topPct}% of active DReps.`,
    );
  } else {
    const topPct = Math.max(1, Math.round(100 - data.percentile));
    parts.push(`Score holding at ${data.drepScore} — top ${topPct}% of active DReps.`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Pulse Page Narrative
// ---------------------------------------------------------------------------

export interface PulseNarrativeData {
  votesThisWeek: number;
  votesLastWeek?: number;
  activeProposals: number;
  activeDReps: number;
  avgParticipationRate?: number;
  totalAdaGoverned: string;
}

export function generatePulseNarrative(data: PulseNarrativeData): string | null {
  const parts: string[] = [];

  if (data.votesLastWeek && data.votesLastWeek > 0) {
    const delta = data.votesThisWeek - data.votesLastWeek;
    const pctChange = Math.round((Math.abs(delta) / data.votesLastWeek) * 100);
    if (delta > 0) {
      parts.push(
        `Governance is heating up: ${data.votesThisWeek.toLocaleString()} votes this week, up ${pctChange}% from last week.`,
      );
    } else if (delta < 0) {
      parts.push(
        `${data.votesThisWeek.toLocaleString()} votes this week, cooling off ${pctChange}% from last week.`,
      );
    } else {
      parts.push(`${data.votesThisWeek.toLocaleString()} votes this week, holding steady.`);
    }
  } else if (data.votesThisWeek > 0) {
    parts.push(
      `${data.votesThisWeek.toLocaleString()} votes cast this week across ${data.activeProposals} active proposal${data.activeProposals !== 1 ? 's' : ''}.`,
    );
  }

  if (data.activeDReps > 0) {
    parts.push(`${data.activeDReps} DReps are actively governing ${data.totalAdaGoverned} ADA.`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// ---------------------------------------------------------------------------
// SPO Profile Narrative
// ---------------------------------------------------------------------------

export interface SpoNarrativeData {
  poolName: string | null;
  ticker: string | null;
  governanceScore: number;
  participationRate: number;
  voteCount: number;
  delegatorCount: number;
  liveStakeAda: number;
  alignments: AlignmentScores | null;
  isClaimed: boolean;
  governanceStatement: string | null;
  scoreMomentum: number | null;
}

export async function generateAISpoNarrative(data: SpoNarrativeData): Promise<string | null> {
  const template = generateSpoNarrative(data);
  if (!template || data.voteCount < 3) return template;

  try {
    const { generateText } = await import('./ai');
    const name = data.poolName || data.ticker || 'This pool';
    const tier = computeTier(data.governanceScore);
    const dominant = data.alignments ? getDominantDimension(data.alignments) : null;
    const dominantLabel = dominant ? getDimensionLabel(dominant).toLowerCase() : 'governance';

    const prompt = `Write a 2-sentence governance profile for a Cardano stake pool operator. Tone: editorial, warm, like a journalist profiling a public institution. Use the data below — keep all numbers accurate. Do NOT start with the pool name as the first word.

Pool: ${name} (${data.ticker || 'no ticker'})
Governance score: ${data.governanceScore}/100 (${tier} tier)
Focus: ${dominantLabel}
Participation: votes on ${Math.round(data.participationRate)}% of proposals
Total votes: ${data.voteCount}
Delegators: ${data.delegatorCount.toLocaleString()}
Live stake: ${formatAdaCompact(data.liveStakeAda)} ADA
Claimed profile: ${data.isClaimed ? 'yes' : 'no'}

Output only the 2-sentence profile. No quotation marks, no preamble.`;

    const aiNarrative = await generateText(prompt, { maxTokens: 200 });
    if (aiNarrative && aiNarrative.length > 20) return aiNarrative.trim();
  } catch (err) {
    logger.error('[Narrative] SPO AI generation failed', { error: err });
  }
  return template;
}

export function generateSpoNarrative(data: SpoNarrativeData): string | null {
  const name = data.poolName || data.ticker || 'This pool';

  if (data.voteCount === 0) {
    return `${name} hasn't participated in on-chain governance yet. As governance becomes more central to Cardano, their participation — or lack of it — affects every staker.`;
  }

  const tier = computeTier(data.governanceScore);
  const parts: string[] = [];

  const participationDesc = participationWord(data.participationRate);
  const tierColor = tierDescriptor(tier);

  if (data.isClaimed) {
    parts.push(
      pick([
        `${name} is an active governance participant, voting on ${participationDesc} and earning a ${tierColor} governance rating.`,
        `A ${tierColor}-rated pool, ${name} votes on ${participationDesc} put before the SPO body.`,
        `With a ${tierColor} governance tier, ${name} has shown commitment by voting on ${participationDesc}.`,
      ]),
    );
  } else {
    parts.push(
      pick([
        `${name} votes on ${participationDesc}, earning a ${tierColor} governance rating — though they haven't claimed their governance profile yet.`,
        `Currently unclaimed, ${name} still participates in governance by voting on ${participationDesc}. Claiming would tell stakers what they stand for.`,
      ]),
    );
  }

  const contextParts: string[] = [];
  if (data.delegatorCount > 0) {
    contextParts.push(
      `${data.delegatorCount.toLocaleString()} delegator${data.delegatorCount !== 1 ? 's' : ''}`,
    );
  }
  if (data.liveStakeAda > 0) {
    contextParts.push(`${formatAdaCompact(data.liveStakeAda)} ADA staked`);
  }

  if (contextParts.length > 0) {
    parts.push(`${contextParts.join(' · ')}.`);
  }

  if (data.scoreMomentum !== null && data.scoreMomentum !== 0) {
    parts.push(
      `Score is ${trendWord(data.scoreMomentum)} — ${data.scoreMomentum > 0 ? 'improving' : 'declining'} over recent epochs.`,
    );
  }

  return parts.join(' ');
}

function tierDescriptor(tier: TierName): string {
  switch (tier) {
    case 'Legendary':
      return 'Legendary';
    case 'Diamond':
      return 'Diamond-tier';
    case 'Gold':
      return 'Gold-tier';
    case 'Silver':
      return 'Silver-tier';
    case 'Bronze':
      return 'Bronze-tier';
    default:
      return 'Emerging';
  }
}
