/**
 * Editorial Headline Generator
 *
 * Creates a state-aware, contextual 1-2 sentence headline for proposal headers.
 * Template-based with no AI dependency — fast, cacheable, always available.
 *
 * The headline tells the STORY of the proposal's current state,
 * not just its metadata.
 */

import type { VoteProjection } from '@/lib/voteProjection';

interface EditorialHeadlineInput {
  title: string;
  proposalType: string;
  status: string;
  withdrawalAmount: number | null;
  aiSummary: string | null;
  abstract: string | null;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  epochsRemaining: number | null;
  projection: VoteProjection | null;
  citizenSupportPct: number | null;
  totalVoters: number;
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

function typeLabel(type: string): string {
  switch (type) {
    case 'TreasuryWithdrawals':
      return 'treasury request';
    case 'ParameterChange':
      return 'parameter change';
    case 'HardForkInitiation':
      return 'hard fork proposal';
    case 'InfoAction':
      return 'community statement';
    case 'NoConfidence':
      return 'no-confidence motion';
    case 'NewCommittee':
    case 'NewConstitutionalCommittee':
      return 'committee update';
    case 'NewConstitution':
    case 'UpdateConstitution':
      return 'constitutional update';
    default:
      return 'governance action';
  }
}

function deadlinePhrase(epochsRemaining: number | null): string {
  if (epochsRemaining == null || epochsRemaining <= 0) return '';
  if (epochsRemaining === 1) return 'in its final epoch';
  if (epochsRemaining <= 2) return `with ${epochsRemaining} epochs remaining`;
  return `with ${epochsRemaining} epochs to go`;
}

export function generateEditorialHeadline(input: EditorialHeadlineInput): string {
  const {
    proposalType,
    status,
    withdrawalAmount,
    aiSummary,
    abstract,
    yesCount,
    noCount,
    epochsRemaining,
    projection,
    citizenSupportPct,
    totalVoters,
  } = input;

  const type = typeLabel(proposalType);
  const deadline = deadlinePhrase(epochsRemaining);
  const adaStr = withdrawalAmount ? `${formatAda(withdrawalAmount)} ADA` : null;

  // ── Closed proposals ──────────────────────────────────────────────
  if (status === 'enacted') {
    if (adaStr) return `Enacted: ${adaStr} ${type} approved by DRep majority and now in effect.`;
    return `Enacted: This ${type} passed through all governance stages and is now in effect.`;
  }
  if (status === 'ratified') {
    if (adaStr) return `Ratified: ${adaStr} ${type} approved — awaiting enactment.`;
    return `Ratified: This ${type} has been approved and awaits enactment.`;
  }
  if (status === 'dropped') {
    return `Dropped: This ${type} was withdrawn or failed to gain sufficient support.`;
  }
  if (status === 'expired') {
    return `Expired: Voting window closed without this ${type} reaching the required threshold.`;
  }

  // ── Open proposals — state-aware storytelling ─────────────────────

  // No votes yet
  if (totalVoters === 0) {
    if (adaStr) return `New ${adaStr} ${type} awaiting DRep votes ${deadline}.`.trim();
    return `New ${type} open for voting ${deadline}.`.trim();
  }

  // Use projection verdict when available for richer storytelling
  if (projection) {
    const outcome = projection.projectedOutcome;
    const yesPct = projection.currentYesPct;

    // Passing strongly
    if (outcome === 'passing' || outcome === 'likely_pass') {
      const momentum = adaStr ? `${adaStr} ` : '';
      const citizenNote =
        citizenSupportPct != null && citizenSupportPct >= 60
          ? ` Citizen sentiment aligns at ${Math.round(citizenSupportPct)}% support.`
          : '';
      return `Strong DRep support for ${momentum}${type} at ${yesPct.toFixed(0)}% of active stake ${deadline}.${citizenNote}`.trim();
    }

    // Leaning pass
    if (outcome === 'leaning_pass') {
      return `This ${type} edges toward approval at ${yesPct.toFixed(0)}% — needs more DRep support ${deadline}.`.trim();
    }

    // Too close
    if (outcome === 'too_close') {
      const split =
        citizenSupportPct != null
          ? ` Citizens split: ${Math.round(citizenSupportPct)}% support.`
          : '';
      return `Contested: This ${type} sits at ${yesPct.toFixed(0)}% with ${totalVoters} DReps divided ${deadline}.${split}`.trim();
    }

    // Leaning fail
    if (outcome === 'leaning_fail') {
      return `This ${type} faces headwinds at ${yesPct.toFixed(0)}% — below the required threshold ${deadline}.`.trim();
    }

    // Unlikely pass
    if (outcome === 'unlikely_pass') {
      return `This ${type} trails at ${yesPct.toFixed(0)}% of active stake with significant opposition ${deadline}.`.trim();
    }
  }

  // Fallback: simple vote-count based headline
  if (yesCount > noCount * 2) {
    const base = adaStr ? `${adaStr} ${type}` : `This ${type}`;
    return `${base} sees strong early support with ${yesCount} DReps voting Yes ${deadline}.`.trim();
  }
  if (noCount > yesCount) {
    return `Opposition mounts: ${noCount} DReps vote No on this ${type} ${deadline}.`.trim();
  }

  // Generic fallback — use AI summary or abstract first sentence
  const description = aiSummary || abstract;
  if (description) {
    const firstSentence = description.split(/[.!?]/)[0]?.trim();
    if (firstSentence && firstSentence.length > 15 && firstSentence.length < 120) {
      return `${firstSentence}. ${totalVoters} DReps have voted ${deadline}.`.trim();
    }
  }

  return `${totalVoters} DReps have voted on this ${type} ${deadline}.`.trim();
}
