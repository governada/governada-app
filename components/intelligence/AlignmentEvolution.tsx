'use client';

import { cn } from '@/lib/utils';
import { getDimensionLabel, getDimensionOrder } from '@/lib/drepIdentity';
import type { AlignmentDimension } from '@/lib/drepIdentity';

/* ─── Types ─────────────────────────────────────────────── */

export interface AlignmentHistoryEntry {
  alignments: Record<string, number>;
  archetype: string;
  epoch: number;
  timestamp?: number;
}

interface AlignmentEvolutionProps {
  history: AlignmentHistoryEntry[];
  communityCentroid?: number[];
  className?: string;
}

/* ─── Mini Sparkline (pure SVG) ─────────────────────────── */

function Sparkline({
  values,
  color,
  width = 64,
  height = 20,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {values.length > 0 && (
        <circle
          cx={width}
          cy={height - ((values[values.length - 1] - min) / range) * (height - 4) - 2}
          r="2"
          fill={color}
        />
      )}
    </svg>
  );
}

/* ─── Main Component ────────────────────────────────────── */

export function AlignmentEvolution({
  history,
  communityCentroid,
  className,
}: AlignmentEvolutionProps) {
  const dimensions = getDimensionOrder();

  // Single entry — prompt for more data
  if (history.length < 2) {
    return (
      <div
        className={cn(
          'rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-center',
          className,
        )}
      >
        <p className="text-xs text-white/50">
          Complete matching again next epoch to track your governance evolution
        </p>
      </div>
    );
  }

  const first = history[0];
  const current = history[history.length - 1];
  const archetypeChanged = first.archetype !== current.archetype;

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Your governance evolution
      </p>

      {/* Per-dimension sparklines */}
      <div className="space-y-1.5">
        {dimensions.map((dim) => {
          const values = history.map((h) => (h.alignments[dim] as number) ?? 50);
          const currentVal = values[values.length - 1];
          const firstVal = values[0];
          const delta = currentVal - firstVal;

          // Determine if movement is toward or away from community centroid
          let trendColor = '#94a3b8'; // neutral slate
          if (communityCentroid) {
            const centroidVal = communityCentroid[dimensions.indexOf(dim)] ?? 50;
            const distNow = Math.abs(currentVal - centroidVal);
            const distThen = Math.abs(firstVal - centroidVal);
            if (distNow < distThen) {
              trendColor = '#10b981'; // green — converging with community
            } else if (distNow > distThen) {
              trendColor = '#f59e0b'; // amber — diverging from community
            }
          }

          return (
            <div key={dim} className="flex items-center gap-2 h-6">
              <span className="text-[11px] text-muted-foreground w-24 truncate shrink-0">
                {getDimensionLabel(dim as AlignmentDimension)}
              </span>
              <Sparkline values={values} color={trendColor} />
              <span className="text-xs tabular-nums text-white/70 w-8 text-right shrink-0">
                {currentVal}
              </span>
              <span
                className={cn(
                  'text-[10px] tabular-nums w-10 text-right shrink-0',
                  delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-white/30',
                )}
              >
                {delta > 0 ? '+' : ''}
                {delta !== 0 ? delta : '--'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Archetype shift narrative */}
      {archetypeChanged && (
        <p className="text-xs text-white/60 text-center">
          Your governance identity shifted from{' '}
          <span className="font-medium text-white/80">{first.archetype}</span> to{' '}
          <span className="font-medium text-white/80">{current.archetype}</span>
        </p>
      )}

      {/* Legend */}
      {communityCentroid && (
        <div className="flex items-center justify-center gap-3 text-[9px] text-white/40">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-0.5 rounded-full bg-emerald-500" /> Converging
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-0.5 rounded-full bg-amber-500" /> Diverging
          </span>
        </div>
      )}

      <p className="text-[10px] text-white/30 text-center">
        {history.length} sessions across {history[history.length - 1].epoch - history[0].epoch + 1}{' '}
        epoch{history[history.length - 1].epoch - history[0].epoch > 0 ? 's' : ''}
      </p>
    </div>
  );
}
