'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { EnrichedVote } from '@/components/cc/CCMemberProfileClient';

interface CCRecentVotesProps {
  votes: EnrichedVote[];
  maxVotes?: number;
}

export function CCRecentVotes({ votes, maxVotes = 5 }: CCRecentVotesProps) {
  const recentVotes = votes.slice(0, maxVotes);

  if (recentVotes.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card/30 px-4 py-5 text-center">
        <p className="text-sm text-muted-foreground">No votes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Recent Votes</h3>
      <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
        {recentVotes.map((v) => (
          <Link
            key={`${v.proposalTxHash}-${v.proposalIndex}`}
            href={`/proposal/${v.proposalTxHash}/${v.proposalIndex}`}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
          >
            <span className="text-sm truncate min-w-0 flex-1">
              {v.proposalTitle ?? 'Untitled Proposal'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <BookOpen
                className={`h-3.5 w-3.5 ${v.hasRationale ? 'text-emerald-500' : 'text-muted-foreground/30'}`}
              />
              <Badge
                variant="outline"
                className={
                  v.vote === 'Yes'
                    ? 'text-emerald-500 border-emerald-500/40'
                    : v.vote === 'No'
                      ? 'text-rose-500 border-rose-500/40'
                      : 'text-amber-500 border-amber-500/40'
                }
              >
                {v.vote}
              </Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
