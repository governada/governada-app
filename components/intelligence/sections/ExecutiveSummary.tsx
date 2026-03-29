'use client';

/**
 * ExecutiveSummary — AI-generated proposal summary for review brief.
 *
 * Displays the aiSummary from ReviewQueueItem. Simple and focused.
 */

interface ExecutiveSummaryProps {
  summary: string | null;
}

export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
  if (!summary) {
    return (
      <p className="text-xs text-muted-foreground/60 py-1">
        AI summary not yet available for this proposal
      </p>
    );
  }

  return <p className="text-xs text-foreground/80 leading-relaxed">{summary}</p>;
}
