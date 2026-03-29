'use client';

/**
 * ExecutiveSummary — AI-generated proposal summary for review brief.
 *
 * When the `personalized_briefing` flag is enabled and proposal content
 * is provided, renders a PersonalizedSummary instead of the static text.
 * Falls back to static aiSummary when flag is off or content not available.
 */

import { useFeatureFlag } from '@/components/FeatureGate';
import { PersonalizedSummary } from './PersonalizedSummary';

interface VoteTally {
  yes: number;
  no: number;
  abstain: number;
}

interface ExecutiveSummaryProps {
  summary: string | null;
  /** Proposal content for personalized briefing — optional for backward compat */
  proposalContent?: {
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
  };
  proposalType?: string;
  interBodyVotes?: { drep: VoteTally; spo: VoteTally; cc: VoteTally };
  withdrawalAmount?: number;
}

export function ExecutiveSummary({
  summary,
  proposalContent,
  proposalType,
  interBodyVotes,
  withdrawalAmount,
}: ExecutiveSummaryProps) {
  const personalizedFlag = useFeatureFlag('personalized_briefing');

  // Use personalized briefing when flag is on and we have proposal content
  if (personalizedFlag && proposalContent && proposalType) {
    return (
      <PersonalizedSummary
        proposalContent={proposalContent}
        proposalType={proposalType}
        interBodyVotes={interBodyVotes}
        withdrawalAmount={withdrawalAmount}
        fallbackSummary={summary}
      />
    );
  }

  // Static fallback
  if (!summary) {
    return (
      <p className="text-xs text-muted-foreground/60 py-1">
        AI summary not yet available for this proposal
      </p>
    );
  }

  return <p className="text-xs text-foreground/80 leading-relaxed">{summary}</p>;
}
