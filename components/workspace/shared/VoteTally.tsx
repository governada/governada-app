'use client';

import { cn } from '@/lib/utils';

interface TallyRow {
  label: string;
  yes: number;
  no: number;
  abstain: number;
}

/**
 * Vote tally display — shows yes/no/abstain counts with colored mini bars for each body.
 */
export function VoteTally({ rows }: { rows: TallyRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const total = row.yes + row.no + row.abstain;
        if (total === 0) {
          return (
            <div key={row.label} className="flex items-center gap-3 text-xs">
              <span className="w-12 text-muted-foreground font-medium shrink-0">{row.label}</span>
              <span className="text-muted-foreground/60">No votes yet</span>
            </div>
          );
        }
        const yesPct = (row.yes / total) * 100;
        const noPct = (row.no / total) * 100;
        const abstainPct = (row.abstain / total) * 100;

        return (
          <div key={row.label} className="flex items-center gap-3 text-xs">
            <span className="w-12 text-muted-foreground font-medium shrink-0">{row.label}</span>
            <div className="flex-1 flex h-2 rounded-full overflow-hidden bg-muted">
              {yesPct > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${yesPct}%` }}
                />
              )}
              {noPct > 0 && (
                <div className="h-full bg-rose-500 transition-all" style={{ width: `${noPct}%` }} />
              )}
              {abstainPct > 0 && (
                <div
                  className={cn('h-full bg-muted-foreground/30 transition-all')}
                  style={{ width: `${abstainPct}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-2 tabular-nums text-[10px] shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400">{row.yes}</span>
              <span className="text-rose-600 dark:text-rose-400">{row.no}</span>
              <span className="text-muted-foreground">{row.abstain}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
