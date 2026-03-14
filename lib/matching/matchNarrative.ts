/**
 * Match confidence narrative generator.
 *
 * Produces a short, conversational 1-2 sentence narrative explaining WHY
 * a citizen matches (or doesn't match) a DRep, plus a confidence qualifier
 * so users understand how much data backs the match.
 */

import type { ConfidenceBreakdown } from './confidence';

/* ─── Dimension display names ─────────────────────────── */

const DIMENSION_DISPLAY_NAMES: Record<string, string> = {
  'Treasury Conservative': 'fiscal conservatism',
  'Treasury Growth': 'growth investment',
  Decentralization: 'decentralization',
  Security: 'security priorities',
  Innovation: 'innovation',
  Transparency: 'transparency',
};

/** Convert dimension labels (from dimensionAgreement) to conversational names. */
function toDisplayNames(dims: string[]): string[] {
  return dims.map((d) => DIMENSION_DISPLAY_NAMES[d] ?? d.toLowerCase());
}

/** Format a list of items as natural English: "a, b, and c". */
function naturalList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/* ─── Confidence sentence ─────────────────────────────── */

function getConfidenceSentence(confidence?: ConfidenceBreakdown): string {
  if (!confidence) return '';

  const { overall, sources } = confidence;

  if (overall <= 30) {
    return 'Based on limited data \u2014 vote on proposals to sharpen this match.';
  }

  const pollSource = sources.find((s) => s.key === 'pollVotes');
  const voteCount = pollSource?.current ?? 0;

  if (overall <= 60) {
    return voteCount > 0
      ? `Moderate confidence \u2014 your quiz answers and ${voteCount} vote${voteCount === 1 ? '' : 's'} inform this match.`
      : 'Moderate confidence \u2014 your quiz answers inform this match.';
  }

  // >60: high confidence
  const diversitySource = sources.find((s) => s.key === 'proposalDiversity');
  const proposalTypes = diversitySource?.current ?? 0;

  if (proposalTypes > 0) {
    return `High confidence match based on ${voteCount} vote${voteCount === 1 ? '' : 's'} across ${proposalTypes} proposal type${proposalTypes === 1 ? '' : 's'}.`;
  }
  return `High confidence match based on ${voteCount} vote${voteCount === 1 ? '' : 's'}.`;
}

/* ─── Main narrative generator ────────────────────────── */

export interface MatchNarrativeInput {
  /** Dimension labels where user and DRep agree (agreement >= 70). */
  agreeDimensions: string[];
  /** Dimension labels where user and DRep differ (agreement < 40). */
  differDimensions: string[];
  /** Optional confidence breakdown for the confidence sentence. */
  confidence?: ConfidenceBreakdown;
}

/**
 * Generate a short narrative explaining a match result.
 *
 * Returns 1-2 sentences: an alignment summary + a confidence qualifier.
 */
export function generateMatchNarrative({
  agreeDimensions,
  differDimensions,
  confidence,
}: MatchNarrativeInput): string {
  const agreeNames = toDisplayNames(agreeDimensions);
  const differNames = toDisplayNames(differDimensions);
  const confidenceSentence = getConfidenceSentence(confidence);

  let alignmentSentence: string;

  if (agreeDimensions.length >= 3 && differDimensions.length === 0) {
    // Strong alignment
    alignmentSentence = `Strong alignment \u2014 you share views on ${naturalList(agreeNames)}.`;
  } else if (agreeDimensions.length >= 2 && differDimensions.length >= 1) {
    // Mixed: agree on some, differ on others
    alignmentSentence = `You align on ${naturalList(agreeNames)} but see ${naturalList(differNames)} differently.`;
  } else if (agreeDimensions.length >= 1 && differDimensions.length === 0) {
    // Some agreement, no disagreement
    alignmentSentence = `You share common ground on ${naturalList(agreeNames)}.`;
  } else if (agreeDimensions.length >= 1 && differDimensions.length >= 1) {
    // 1 agree, 1+ differ
    alignmentSentence = `You align on ${naturalList(agreeNames)} but see ${naturalList(differNames)} differently.`;
  } else if (differDimensions.length >= 1) {
    // No agreement, some differences
    alignmentSentence = 'This DRep takes a different approach to governance than you.';
  } else {
    // Neutral across the board
    alignmentSentence = 'A moderate alignment across your governance values.';
  }

  return confidenceSentence ? `${alignmentSentence} ${confidenceSentence}` : alignmentSentence;
}
