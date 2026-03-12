/**
 * CC Narrative Interpretation Helpers
 *
 * Deterministic template functions that translate raw metrics into
 * one-line human-readable stories. Every metric displayed on the
 * committee pages should pass through one of these functions.
 *
 * Rules:
 *  - Always include specific numbers
 *  - Always include contextual framing (good/bad/neutral)
 *  - Never return just a number
 *  - Never call an AI model — these are pure template functions
 */

// ---------------------------------------------------------------------------
// Constitutional Fidelity Score
// ---------------------------------------------------------------------------

export function interpretFidelityScore(score: number | null, rank: number, total: number): string {
  if (score == null) return 'No fidelity data available yet.';
  const label =
    score >= 85
      ? 'Excellent'
      : score >= 70
        ? 'Strong'
        : score >= 55
          ? 'Moderate'
          : score >= 40
            ? 'Weak'
            : 'Poor';
  return `${label} constitutional fidelity (${score}/100) — ranked ${ordinal(rank)} of ${total} members`;
}

/** @deprecated Use interpretFidelityScore */
export const interpretTransparencyScore = interpretFidelityScore;

// ---------------------------------------------------------------------------
// Participation
// ---------------------------------------------------------------------------

export function interpretParticipation(votesCast: number, eligible: number): string {
  if (eligible === 0) return 'No proposals eligible for CC vote yet.';
  const rate = Math.round((votesCast / eligible) * 100);
  const missed = eligible - votesCast;
  if (rate === 100) return `Voted on all ${eligible} proposals — perfect participation`;
  if (rate >= 90)
    return `Voted on ${votesCast} of ${eligible} proposals (${rate}%) — only missed ${missed}`;
  if (rate >= 70)
    return `Voted on ${votesCast} of ${eligible} proposals (${rate}%) — missed ${missed}`;
  return `Voted on only ${votesCast} of ${eligible} proposals (${rate}%) — significant gaps in participation`;
}

// ---------------------------------------------------------------------------
// Unanimous Rate
// ---------------------------------------------------------------------------

export function interpretUnanimousRate(
  rate: number,
  unanimousCount: number,
  totalProposals: number,
): string {
  if (totalProposals === 0) return 'No proposals voted on yet.';
  const dissentCount = totalProposals - unanimousCount;
  if (rate >= 95)
    return `${rate}% unanimous — very high consensus, ${dissentCount === 0 ? 'no' : `only ${dissentCount}`} proposals with dissent`;
  if (rate >= 75)
    return `${rate}% unanimous — healthy consensus with ${dissentCount} proposals showing independent judgment`;
  if (rate >= 50)
    return `${rate}% unanimous — moderate disagreement on ${dissentCount} proposals, suggesting active deliberation`;
  return `${rate}% unanimous — significant disagreement on ${dissentCount} proposals`;
}

// ---------------------------------------------------------------------------
// Alignment Tension
// ---------------------------------------------------------------------------

export interface TensionSummary {
  proposalKey: string;
  title: string | null;
  drepMajority: string;
  ccVote: string;
}

export function interpretAlignmentTension(tensions: TensionSummary[]): string {
  if (tensions.length === 0)
    return 'No tension — the CC and DRep majority have aligned on all proposals';
  if (tensions.length === 1)
    return 'The CC diverged from the DRep majority on 1 proposal — a sign of independent constitutional review';
  return `The CC diverged from the DRep majority on ${tensions.length} proposals — exercising independent constitutional judgment`;
}

// ---------------------------------------------------------------------------
// Rationale Quality
// ---------------------------------------------------------------------------

export function interpretRationaleQuality(
  qualityScore: number | null,
  provisionRate: number | null,
): string {
  if (provisionRate == null || provisionRate === 0) return 'No rationales provided yet.';
  const pctStr = `${Math.round(provisionRate)}%`;
  if (qualityScore == null || qualityScore === 0)
    return `Provides rationales on ${pctStr} of votes`;
  if (qualityScore >= 80)
    return `Provides rationales on ${pctStr} of votes with strong constitutional article citations`;
  if (qualityScore >= 60)
    return `Provides rationales on ${pctStr} of votes with good article coverage`;
  return `Provides rationales on ${pctStr} of votes — article citation depth could improve`;
}

// ---------------------------------------------------------------------------
// Constitutional Grounding
// ---------------------------------------------------------------------------

export function interpretConstitutionalGrounding(score: number | null): string {
  if (score == null) return 'Constitutional grounding data not yet available.';
  if (score >= 80)
    return 'Strong constitutional grounding — consistently cites relevant articles and sections';
  if (score >= 60)
    return 'Good constitutional grounding — cites articles on most votes with reasonable coverage';
  if (score >= 40)
    return 'Moderate constitutional grounding — some article citations but coverage could improve';
  return 'Weak constitutional grounding — rarely cites constitutional articles in rationales';
}

/** @deprecated Use interpretConstitutionalGrounding */
export function interpretIndependence(
  score: number | null,
  _unanimousRate?: number | null,
): string {
  return interpretConstitutionalGrounding(score);
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export function interpretTrend(
  current: number | null,
  previous: number | null,
  epochSpan: number,
): string {
  if (current == null || previous == null) return 'Not enough data for trend analysis.';
  const delta = current - previous;
  const periodLabel = epochSpan === 1 ? 'the last epoch' : `the last ${epochSpan} epochs`;
  if (Math.abs(delta) <= 2) return `Stable — holding steady over ${periodLabel}`;
  if (delta > 0) return `Improving — up ${delta} points over ${periodLabel}`;
  return `Declining — down ${Math.abs(delta)} points over ${periodLabel}`;
}

// ---------------------------------------------------------------------------
// Pillar Strength/Weakness
// ---------------------------------------------------------------------------

interface PillarScores {
  participation: number | null;
  constitutionalGrounding: number | null;
  reasoningQuality: number | null;
}

const PILLAR_LABELS: Record<keyof PillarScores, string> = {
  participation: 'Participation',
  constitutionalGrounding: 'Constitutional Grounding',
  reasoningQuality: 'Reasoning Quality',
};

export function interpretPillarStrengthWeakness(pillars: PillarScores): string {
  const entries = (Object.entries(pillars) as [keyof PillarScores, number | null][]).filter(
    ([, v]) => v != null,
  ) as [keyof PillarScores, number][];

  if (entries.length === 0) return 'No pillar data available.';

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  if (strongest[1] === weakest[1]) {
    if (strongest[1] >= 70) return `Consistently strong across all pillars (${strongest[1]}/100)`;
    if (strongest[1] >= 40)
      return `Even across all pillars (${strongest[1]}/100) — room to improve`;
    return `Low across all pillars (${strongest[1]}/100) — significant improvement needed`;
  }

  return `Strongest: ${PILLAR_LABELS[strongest[0]]} (${strongest[1]}/100). Weakest: ${PILLAR_LABELS[weakest[0]]} (${weakest[1]}/100)`;
}

// ---------------------------------------------------------------------------
// CC Health Narrative (for the health verdict component)
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'attention' | 'critical';
export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface CCHealthData {
  activeMembers: number;
  totalMembers: number;
  avgFidelity: number | null;
  /** @deprecated Use avgFidelity */
  avgTransparency?: number | null;
  tensionCount: number;
  trend: TrendDirection;
}

export function interpretHealthStatus(data: CCHealthData): HealthStatus {
  const avg = data.avgFidelity ?? data.avgTransparency ?? null;
  const { activeMembers } = data;
  if (avg == null) return 'attention';
  if (activeMembers === 0) return 'critical';
  if (avg >= 65) return 'healthy';
  if (avg >= 45) return 'attention';
  return 'critical';
}

export function generateCCHealthNarrative(data: CCHealthData): string {
  const { activeMembers } = data;
  const avg = data.avgFidelity ?? data.avgTransparency ?? null;
  const { tensionCount } = data;
  const status = interpretHealthStatus(data);

  const memberStr = `${activeMembers} active committee member${activeMembers !== 1 ? 's' : ''}`;

  const scoreStr =
    avg != null
      ? `Average fidelity is ${avg >= 70 ? 'strong' : avg >= 55 ? 'moderate' : 'weak'} at ${avg}/100`
      : 'Fidelity scores are not yet available';

  if (status === 'critical')
    return `${memberStr}. ${scoreStr}. Accountability gaps need attention.`;

  const tensionStr =
    tensionCount > 0
      ? ` ${tensionCount} proposal${tensionCount > 1 ? 's' : ''} with CC-DRep tension this epoch.`
      : '';

  return `${memberStr}. ${scoreStr}.${tensionStr}`;
}

// ---------------------------------------------------------------------------
// Member Verdict (one-line summary for member cards)
// ---------------------------------------------------------------------------

export interface MemberVerdictInput {
  rank: number;
  total: number;
  fidelityScore: number | null;
  /** @deprecated Use fidelityScore */
  transparencyScore?: number | null;
  trend: TrendDirection;
  strongestPillar: string | null;
  weakestPillar: string | null;
  participationRate: number | null;
}

export function generateMemberVerdict(input: MemberVerdictInput): string {
  const { rank, total, trend, strongestPillar, weakestPillar } = input;
  const score = input.fidelityScore ?? input.transparencyScore ?? null;

  if (score == null) return 'Fidelity data not yet available.';

  const positionStr =
    rank <= Math.ceil(total / 3)
      ? 'Above average'
      : rank <= Math.ceil((total * 2) / 3)
        ? 'Average'
        : 'Below average';

  const parts: string[] = [positionStr];

  if (strongestPillar && weakestPillar && strongestPillar !== weakestPillar) {
    parts.push(`strong ${strongestPillar.toLowerCase()}`);
    if (trend === 'declining') {
      parts.push(`declining ${weakestPillar.toLowerCase()}`);
    } else {
      parts.push(`${weakestPillar.toLowerCase()} could improve`);
    }
  } else if (trend !== 'stable') {
    parts.push(trend === 'improving' ? 'trending upward' : 'trending downward');
  }

  return parts.join('. ').replace(/\.\./g, '.') + '.';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
