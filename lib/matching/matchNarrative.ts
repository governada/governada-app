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
  /** Whether this is a bridge match (emphasize contrast). */
  isBridge?: boolean;
}

/**
 * Generate a short narrative explaining a match result.
 *
 * Returns 1-2 sentences: an alignment summary + a confidence qualifier.
 */
/**
 * Narrative openers vary by pattern to avoid cookie-cutter feel.
 * Uses agree/differ dimensions to pick the best frame.
 */
export function generateMatchNarrative({
  agreeDimensions,
  differDimensions,
  confidence,
  isBridge,
}: MatchNarrativeInput): string {
  const agreeNames = toDisplayNames(agreeDimensions);
  const differNames = toDisplayNames(differDimensions);
  const confidenceSentence = getConfidenceSentence(confidence);

  let alignmentSentence: string;

  if (isBridge && differDimensions.length >= 1) {
    // Bridge match: emphasize the contrast
    const mainDiffer = differNames[0];
    if (agreeDimensions.length >= 1) {
      alignmentSentence = `Disagrees with you on ${mainDiffer} but strongly aligned on ${naturalList(agreeNames)} \u2014 worth considering for balance.`;
    } else {
      alignmentSentence = `Takes a different stance on ${mainDiffer} \u2014 a contrasting perspective to broaden your view.`;
    }
  } else if (agreeDimensions.length >= 4 && differDimensions.length === 0) {
    // Very strong alignment
    alignmentSentence = `Closely mirrors your governance values across ${naturalList(agreeNames)}.`;
  } else if (agreeDimensions.length >= 3 && differDimensions.length === 0) {
    // Strong alignment — vary openers
    alignmentSentence = `Shares your priorities on ${naturalList(agreeNames)}.`;
  } else if (agreeDimensions.length >= 2 && differDimensions.length >= 1) {
    // Mixed: emphasize the interesting contrast
    alignmentSentence = `Shares your ${naturalList(agreeNames)} values but brings a different perspective on ${naturalList(differNames)}.`;
  } else if (agreeDimensions.length >= 1 && differDimensions.length === 0) {
    // Some agreement, no disagreement
    alignmentSentence = `Common ground on ${naturalList(agreeNames)}.`;
  } else if (agreeDimensions.length >= 1 && differDimensions.length >= 1) {
    // 1 agree, 1+ differ
    alignmentSentence = `Aligned on ${naturalList(agreeNames)} with a different take on ${naturalList(differNames)}.`;
  } else if (differDimensions.length >= 1) {
    // No agreement, some differences
    alignmentSentence = 'Offers a contrasting governance philosophy to yours.';
  } else {
    // Neutral across the board
    alignmentSentence = 'A moderate alignment across your governance values.';
  }

  return confidenceSentence ? `${alignmentSentence} ${confidenceSentence}` : alignmentSentence;
}
