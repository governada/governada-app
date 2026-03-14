'use client';

interface VotingPatternBarProps {
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
}

/**
 * Yes/No/Abstain stacked bar with legend.
 * Shared between DRep TrustCard and SPO TrustCard.
 */
export function VotingPatternBar({ yesVotes, noVotes, abstainVotes }: VotingPatternBarProps) {
  const total = yesVotes + noVotes + abstainVotes;
  if (total === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">Voting Pattern</span>
      <div className="flex h-2 w-full rounded-full overflow-hidden bg-border">
        {yesVotes > 0 && (
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${(yesVotes / total) * 100}%` }}
          />
        )}
        {noVotes > 0 && (
          <div className="h-full bg-rose-500" style={{ width: `${(noVotes / total) * 100}%` }} />
        )}
        {abstainVotes > 0 && (
          <div
            className="h-full bg-muted-foreground/40"
            style={{ width: `${(abstainVotes / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {yesVotes} Yes
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {noVotes} No
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
          {abstainVotes} Abstain
        </span>
      </div>
    </div>
  );
}
