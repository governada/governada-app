'use client';

/**
 * Shared sub-components used by multiple globe panel variants.
 */

import { cn } from '@/lib/utils';

/** Color mapping for vote directions */
export const VOTE_COLOR: Record<string, string> = {
  Yes: 'text-emerald-400',
  No: 'text-red-400',
  Abstain: 'text-amber-400',
};

/** Compact horizontal bar for a score pillar */
export function PillarBar({ label, value }: { label: string; value: number | null }) {
  const pct = value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct >= 70
              ? 'bg-emerald-500/80'
              : pct >= 40
                ? 'bg-amber-500/70'
                : 'bg-muted-foreground/40',
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
        {Math.round(pct)}
      </span>
    </div>
  );
}

/** Tri-body vote bar (DRep / SPO / CC) */
export function VoteBar({
  label,
  data,
}: {
  label: string;
  data: { yes: number; no: number; abstain: number };
}) {
  const total = data.yes + data.no + data.abstain;
  if (total === 0) return null;
  const yesPct = (data.yes / total) * 100;
  const noPct = (data.no / total) * 100;
  const abstainPct = (data.abstain / total) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{total.toLocaleString()} votes</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
        {yesPct > 0 && (
          <div
            className="bg-emerald-500/90 transition-all duration-500"
            style={{ width: `${yesPct}%` }}
          />
        )}
        {noPct > 0 && (
          <div
            className="bg-red-500/80 transition-all duration-500"
            style={{ width: `${noPct}%` }}
          />
        )}
        {abstainPct > 0 && (
          <div
            className="bg-amber-500/60 transition-all duration-500"
            style={{ width: `${abstainPct}%` }}
          />
        )}
      </div>
      <div className="flex gap-3 text-[10px] tabular-nums">
        <span className="text-emerald-400">Yes {Math.round(yesPct)}%</span>
        <span className="text-red-400">No {Math.round(noPct)}%</span>
        <span className="text-amber-400">Abstain {Math.round(abstainPct)}%</span>
      </div>
    </div>
  );
}
