'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VotePoint {
  drepName: string | null;
  drepId: string;
  vote: 'Yes' | 'No' | 'Abstain';
  blockTime: number;
}

interface VoteTimelineProps {
  votes: VotePoint[];
  proposalBlockTime: number;
  expirationEpoch: number | null;
  currentEpoch: number;
}

const VOTE_COLORS: Record<string, { dot: string; border: string; text: string }> = {
  Yes: {
    dot: 'bg-green-500',
    border: 'border-l-green-500',
    text: 'text-green-600 dark:text-green-400',
  },
  No: { dot: 'bg-red-500', border: 'border-l-red-500', text: 'text-red-600 dark:text-red-400' },
  Abstain: {
    dot: 'bg-amber-500',
    border: 'border-l-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

const VISIBLE_DEFAULT = 15;

function formatDateGroup(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysBetween(ts1: number, ts2: number): number {
  return Math.ceil(Math.abs(ts2 - ts1) / 86400);
}

export function VoteTimeline({ votes }: VoteTimelineProps) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (votes.length < 3) return null;

  const sorted = [...votes].sort((a, b) => b.blockTime - a.blockTime);
  const yesCount = votes.filter((v) => v.vote === 'Yes').length;
  const noCount = votes.filter((v) => v.vote === 'No').length;
  const abstainCount = votes.filter((v) => v.vote === 'Abstain').length;

  const earliest = Math.min(...votes.map((v) => v.blockTime));
  const latest = Math.max(...votes.map((v) => v.blockTime));
  const spanDays = daysBetween(earliest, latest);

  const grouped: { date: string; items: VotePoint[] }[] = [];
  for (const v of sorted) {
    const dateStr = formatDateGroup(v.blockTime);
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateStr) {
      last.items.push(v);
    } else {
      grouped.push({ date: dateStr, items: [v] });
    }
  }

  const visible = showAll ? sorted : sorted.slice(0, VISIBLE_DEFAULT);
  const visibleGrouped: { date: string; items: VotePoint[] }[] = [];
  for (const v of visible) {
    const dateStr = formatDateGroup(v.blockTime);
    const last = visibleGrouped[visibleGrouped.length - 1];
    if (last && last.date === dateStr) {
      last.items.push(v);
    } else {
      visibleGrouped.push({ date: dateStr, items: [v] });
    }
  }

  return (
    <Card>
      <CardHeader
        className="pb-2 pt-4 px-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <CardTitle className="text-sm flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Vote Activity
          <span className="text-xs font-normal text-muted-foreground">
            {votes.length} DReps over {spanDays === 0 ? '1' : spanDays} day
            {spanDays !== 1 ? 's' : ''}
          </span>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {yesCount} Yes
            </Badge>
            <Badge
              variant="outline"
              className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[10px] gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {noCount} No
            </Badge>
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {abstainCount} Abstain
            </Badge>
          </div>

          <div className="space-y-3">
            {visibleGrouped.map((group) => (
              <div key={group.date}>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                  {group.date}
                </p>
                <div className="space-y-0">
                  {group.items.map((v, i) => {
                    const colors = VOTE_COLORS[v.vote] || VOTE_COLORS.Abstain;
                    return (
                      <div
                        key={`${v.drepId}-${i}`}
                        className={`flex items-center gap-2.5 py-1.5 px-2.5 border-l-2 ${colors.border} hover:bg-muted/30 transition-colors rounded-r`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />
                        <span className="text-xs font-medium truncate flex-1 min-w-0">
                          {v.drepName || `${v.drepId.slice(0, 12)}...${v.drepId.slice(-6)}`}
                        </span>
                        <span className={`text-[10px] font-semibold shrink-0 ${colors.text}`}>
                          {v.vote}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {votes.length > VISIBLE_DEFAULT && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAll(!showAll);
              }}
              className="text-xs text-primary hover:underline w-full text-center pt-1"
            >
              {showAll ? 'Show less' : `Show all ${votes.length} votes`}
            </button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
