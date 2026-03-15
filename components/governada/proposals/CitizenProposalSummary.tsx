'use client';

import { useSegment } from '@/components/providers/SegmentProvider';

interface CitizenProposalSummaryProps {
  title: string;
  proposalType: string;
  abstract: string | null;
  aiSummary: string | null;
  withdrawalAmount: number | null;
  treasuryBalanceAda: number | null;
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

/**
 * Builds a 2-3 sentence citizen-friendly explanation of a proposal.
 * Uses proposal metadata to produce an accessible, jargon-free summary.
 */
function buildCitizenSummary(props: CitizenProposalSummaryProps): string | null {
  const { proposalType, withdrawalAmount, treasuryBalanceAda, aiSummary, abstract } = props;

  // For treasury withdrawals, give concrete financial context
  if (proposalType === 'TreasuryWithdrawals' && withdrawalAmount) {
    const amountAda = withdrawalAmount / 1_000_000;
    const formatted = formatAda(withdrawalAmount);
    const parts: string[] = [];

    // Base description from AI summary or abstract
    const description = aiSummary || abstract;
    if (description) {
      // Take the first sentence or first ~120 chars
      const firstSentence = description.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        parts.push(`${firstSentence}.`);
      }
    }

    // Treasury context
    if (treasuryBalanceAda && treasuryBalanceAda > 0) {
      const pct = ((amountAda / treasuryBalanceAda) * 100).toFixed(1);
      parts.push(
        `This proposal requests ₳${formatted} from the Cardano treasury (about ${pct}% of the current balance).`,
      );
    } else {
      parts.push(`This proposal requests ₳${formatted} from the Cardano treasury.`);
    }

    parts.push('If approved, DReps vote on behalf of the citizens who delegated to them.');
    return parts.join(' ');
  }

  // Parameter changes
  if (proposalType === 'ParameterChange') {
    const base = aiSummary || abstract;
    const parts: string[] = [];
    if (base) {
      const firstSentence = base.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        parts.push(`${firstSentence}.`);
      }
    }
    parts.push(
      'This proposal would change Cardano network parameters. It requires approval from DReps and the Constitutional Committee.',
    );
    return parts.join(' ');
  }

  // Hard fork initiation
  if (proposalType === 'HardForkInitiation') {
    return 'This proposal initiates a network upgrade (hard fork). It requires approval from DReps, SPOs, and the Constitutional Committee before the network transitions to a new protocol version.';
  }

  // No confidence motion
  if (proposalType === 'NoConfidence') {
    return 'This is a motion of no confidence in the current Constitutional Committee. If approved by DReps and SPOs, it would remove the current committee and trigger formation of a new one.';
  }

  // New constitution
  if (proposalType === 'NewConstitution') {
    return 'This proposal would update the Cardano Constitution — the foundational rules governing the network. It requires approval from DReps and the Constitutional Committee.';
  }

  // New committee
  if (proposalType === 'NewCommittee' || proposalType === 'NewConstitutionalCommittee') {
    return 'This proposal would update the Constitutional Committee — the group that ensures governance actions comply with the Constitution. It requires approval from DReps and SPOs.';
  }

  // Info action
  if (proposalType === 'InfoAction') {
    const base = aiSummary || abstract;
    const parts: string[] = [];
    if (base) {
      const firstSentence = base.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        parts.push(`${firstSentence}.`);
      }
    }
    parts.push(
      'This is an informational proposal — it does not change the protocol or spend treasury funds, but signals community intent.',
    );
    return parts.join(' ');
  }

  // Generic fallback — only show if we have something useful
  const base = aiSummary || abstract;
  if (base) {
    return null; // The 1-line summary is already shown; no need to duplicate
  }

  return null;
}

/**
 * Citizen-friendly proposal summary.
 * Shows a richer, more accessible explanation for citizens and anonymous users.
 * DReps, SPOs, and CC members see the existing compact summary instead.
 */
export function CitizenProposalSummary(props: CitizenProposalSummaryProps) {
  const { segment } = useSegment();

  // Only show for citizens and anonymous — DReps/SPOs/CC have domain expertise
  if (segment === 'drep' || segment === 'spo' || segment === 'cc') {
    return null;
  }

  const summary = buildCitizenSummary(props);
  if (!summary) return null;

  return (
    <div className="rounded-xl bg-muted/30 border border-border/50 px-4 py-3.5">
      <p className="text-sm text-foreground/80 leading-relaxed">{summary}</p>
    </div>
  );
}
