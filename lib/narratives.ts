/**
 * Narrative Template Engine — generates contextual prose from existing data.
 * Template-based (not AI) — smart string interpolation with personality.
 *
 * Voice: warm, knowledgeable, slightly opinionated. Like a governance-passionate
 * friend who speaks plainly. Never corporate, never academic.
 */

import { getDimensionLabel, type AlignmentScores, getDominantDimension } from './drepIdentity';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pct(n: number | null | undefined): string {
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

function rationaleWord(rate: number): string {
  if (rate >= 90) return 'always explains their reasoning';
  if (rate >= 70) return 'regularly provides reasoning';
  if (rate >= 40) return 'sometimes explains their votes';
  if (rate > 0) return 'occasionally provides reasoning';
  return 'has not yet published vote rationale';
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
    console.error('[Narrative] AI generation failed:', err);
  }
  return template;
}

export function generateDRepNarrative(data: DRepNarrativeData): string | null {
  if (!data.isActive && data.totalVotes === 0) {
    return `${data.name} is registered but hasn't participated in governance yet — their story is just beginning.`;
  }

  if (!data.isActive) {
    return `${data.name} is currently inactive in governance. They previously voted on ${data.totalVotes} proposal${data.totalVotes !== 1 ? 's' : ''} and have ${data.delegatorCount.toLocaleString()} delegator${data.delegatorCount !== 1 ? 's' : ''} representing ${formatAdaCompact(data.votingPower)} ADA.`;
  }

  const dominant = getDominantDimension(data.alignments);
  const dominantLabel = getDimensionLabel(dominant).toLowerCase();
  const parts: string[] = [];

  const focusIntro = pick([
    `A ${dominantLabel}-focused DRep who votes on ${participationWord(data.participationRate)}`,
    `With a focus on ${dominantLabel}, ${data.name} votes on ${participationWord(data.participationRate)}`,
    `${data.name} brings a ${dominantLabel} perspective and votes on ${participationWord(data.participationRate)}`,
  ]);

  parts.push(`${focusIntro} and ${rationaleWord(data.rationaleRate)}.`);

  const contextParts: string[] = [];
  if (data.rank && data.rank <= 20) {
    contextParts.push(`Ranked #${data.rank}`);
  }
  if (data.delegatorCount > 0) {
    contextParts.push(
      `${data.delegatorCount.toLocaleString()} delegator${data.delegatorCount !== 1 ? 's' : ''}`,
    );
  }
  if (data.votingPower > 0) {
    contextParts.push(`${formatAdaCompact(data.votingPower)} ADA delegated`);
  }

  if (contextParts.length > 0) {
    const sizeComment =
      data.sizeTier === 'Whale'
        ? ' — one of the largest voices in governance'
        : data.sizeTier === 'Large'
          ? ' — a significant voice in governance'
          : '';
    parts.push(`${contextParts.join(' · ')}${sizeComment}.`);
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
