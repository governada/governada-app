'use client';

import type { CitizenSentiment } from '@/lib/workspace/types';

export function CommunitySignalCell({ signal }: { signal: CitizenSentiment | null }) {
  if (!signal || signal.total === 0) {
    return <span className="text-xs text-muted-foreground/40">—</span>;
  }

  const supportPct = Math.round((signal.support / signal.total) * 100);
  const opposePct = Math.round((signal.oppose / signal.total) * 100);

  let label: string;
  let colorClass: string;

  if (supportPct >= 60) {
    label = `${supportPct}% support`;
    colorClass = 'text-emerald-400';
  } else if (supportPct <= 40) {
    label = `${supportPct}% support`;
    colorClass = 'text-red-400';
  } else {
    label = `Split ${supportPct}/${opposePct}`;
    colorClass = 'text-amber-400';
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-medium ${colorClass}`}>{label}</span>
      {/* Mini progress bar */}
      <div className="h-1 w-8 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500/60"
          style={{ width: `${supportPct}%` }}
        />
      </div>
    </div>
  );
}
