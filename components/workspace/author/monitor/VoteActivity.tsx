'use client';

/**
 * VoteActivity — shows recent votes on a submitted governance action.
 *
 * Displays the last 10 votes with voter ID, vote direction, epoch,
 * and whether a rationale was published.
 */

import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentVote } from '@/lib/workspace/monitor-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoteActivityProps {
  votes: RecentVote[];
  currentEpoch: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateId(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function epochLabel(voteEpoch: number, currentEpoch: number): string {
  const diff = currentEpoch - voteEpoch;
  if (diff === 0) return 'This epoch';
  if (diff === 1) return '1 epoch ago';
  return `${diff} epochs ago`;
}

const VOTE_COLORS: Record<string, string> = {
  Yes: 'text-[var(--compass-teal)]',
  No: 'text-destructive',
  Abstain: 'text-muted-foreground',
};

const VOTER_TYPE_LABELS: Record<string, string> = {
  drep: 'DRep',
  spo: 'SPO',
  cc: 'CC',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoteActivity({ votes, currentEpoch }: VoteActivityProps) {
  if (votes.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Votes
        </h3>
        <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Recent Votes
      </h3>

      <div className="space-y-1">
        {votes.map((v, i) => (
          <div
            key={`${v.voterId}-${v.epochNo}-${i}`}
            className="flex items-center gap-3 py-1.5 text-sm"
          >
            {/* Voter type + ID */}
            <span className="text-muted-foreground shrink-0 w-10">
              {VOTER_TYPE_LABELS[v.voterType] ?? v.voterType}
            </span>
            <span className="font-mono text-xs truncate min-w-0 flex-1">
              {truncateId(v.voterId)}
            </span>

            {/* Vote direction */}
            <span className={cn('font-medium w-14 text-right shrink-0', VOTE_COLORS[v.vote])}>
              {v.vote}
            </span>

            {/* Epoch */}
            <span className="text-xs text-muted-foreground w-24 text-right shrink-0 tabular-nums">
              {epochLabel(v.epochNo, currentEpoch)}
            </span>

            {/* Rationale indicator */}
            <span
              className="w-5 shrink-0 flex justify-center"
              title={v.hasRationale ? 'Has rationale' : undefined}
            >
              {v.hasRationale && <FileText className="h-3.5 w-3.5 text-[var(--wayfinder-amber)]" />}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
