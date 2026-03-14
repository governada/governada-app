'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChartDimensions } from '@/lib/charts';

interface DRepPower {
  name: string;
  drepId: string;
  votingPower: number;
  score?: number;
}

interface VotingPowerTreemapProps {
  dreps: DRepPower[];
  className?: string;
}

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  drep: DRepPower;
  pct: number;
}

function squarify(
  items: { drep: DRepPower; pct: number }[],
  x: number,
  y: number,
  w: number,
  h: number,
): TreemapRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x, y, w, h, drep: items[0].drep, pct: items[0].pct }];
  }

  const totalPct = items.reduce((sum, item) => sum + item.pct, 0);
  const rects: TreemapRect[] = [];

  let remaining = [...items];
  let cx = x,
    cy = y,
    cw = w,
    ch = h;

  while (remaining.length > 0) {
    const isHorizontal = cw >= ch;
    const side = isHorizontal ? ch : cw;

    // Greedy row: add items until aspect ratio starts getting worse
    const row: typeof remaining = [];
    let rowSum = 0;

    for (const item of remaining) {
      const testSum = rowSum + item.pct;
      const rowWidth = (testSum / totalPct) * (isHorizontal ? cw : ch);
      if (rowWidth === 0) continue;

      const newAspects = [...row, item].map((r) => {
        const extent = (r.pct / testSum) * side;
        return Math.max(rowWidth / extent, extent / rowWidth);
      });
      const worstNew = Math.max(...newAspects);

      if (row.length === 0 || worstNew < 4) {
        row.push(item);
        rowSum = testSum;
      } else {
        break;
      }
    }

    if (row.length === 0) break;

    // Layout the row
    const rowFraction = rowSum / totalPct;
    const rowDepth = isHorizontal ? rowFraction * cw : rowFraction * ch;

    let pos = 0;
    for (const item of row) {
      const extent = (item.pct / rowSum) * side;
      if (isHorizontal) {
        rects.push({ x: cx, y: cy + pos, w: rowDepth, h: extent, drep: item.drep, pct: item.pct });
      } else {
        rects.push({ x: cx + pos, y: cy, w: extent, h: rowDepth, drep: item.drep, pct: item.pct });
      }
      pos += extent;
    }

    // Update remaining area
    if (isHorizontal) {
      cx += rowDepth;
      cw -= rowDepth;
    } else {
      cy += rowDepth;
      ch -= rowDepth;
    }

    remaining = remaining.slice(row.length);
  }

  return rects;
}

const POWER_COLORS = [
  'bg-primary/80',
  'bg-primary/60',
  'bg-primary/45',
  'bg-primary/30',
  'bg-primary/20',
  'bg-primary/15',
  'bg-muted',
];

export function VotingPowerTreemap({ dreps, className }: VotingPowerTreemapProps) {
  const { containerRef, dimensions } = useChartDimensions(280, {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const { rects, topDReps, othersPct, gini } = useMemo(() => {
    const sorted = [...dreps].sort((a, b) => b.votingPower - a.votingPower);
    const totalPower = sorted.reduce((sum, d) => sum + d.votingPower, 0) || 1;

    // Show top N individually, group the rest
    const TOP_N = Math.min(12, sorted.length);
    const top = sorted.slice(0, TOP_N);
    const rest = sorted.slice(TOP_N);
    const restPower = rest.reduce((sum, d) => sum + d.votingPower, 0);

    const items: { drep: DRepPower; pct: number }[] = top.map((d) => ({
      drep: d,
      pct: (d.votingPower / totalPower) * 100,
    }));

    if (restPower > 0) {
      items.push({
        drep: { name: `${rest.length} others`, drepId: '__others__', votingPower: restPower },
        pct: (restPower / totalPower) * 100,
      });
    }

    const w = dimensions.width || 400;
    const h = dimensions.height || 280;
    const computed = squarify(items, 0, 0, w, h);

    // Compute Gini coefficient for insight
    const powers = sorted.map((d) => d.votingPower / totalPower);
    let giniSum = 0;
    const n = powers.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        giniSum += Math.abs(powers[i] - powers[j]);
      }
    }
    const giniCoeff = n > 0 ? giniSum / (2 * n) : 0;

    return {
      rects: computed,
      topDReps: top,
      othersPct: (restPower / totalPower) * 100,
      gini: giniCoeff,
    };
  }, [dreps, dimensions.width, dimensions.height]);

  return (
    <div
      className={cn('space-y-3', className)}
      role="img"
      aria-label="Voting power distribution treemap"
    >
      <div
        ref={containerRef}
        className="relative rounded-xl border border-border overflow-hidden"
        style={{ height: 280 }}
      >
        {rects.map((rect, i) => {
          const isOthers = rect.drep.drepId === '__others__';
          const isHovered = hoveredIdx === i;
          const minSize = rect.w > 40 && rect.h > 24;
          const largeEnough = rect.w > 70 && rect.h > 36;

          return (
            <div
              key={rect.drep.drepId}
              className={cn(
                'absolute border border-background/20 transition-all duration-150 flex flex-col justify-end p-1.5 overflow-hidden cursor-default',
                isOthers ? 'bg-muted/60' : POWER_COLORS[Math.min(i, POWER_COLORS.length - 1)],
                isHovered && 'ring-1 ring-primary z-10 brightness-110',
              )}
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
              }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {minSize && (
                <>
                  <span
                    className={cn(
                      'text-[10px] font-medium truncate leading-tight',
                      isOthers ? 'text-muted-foreground' : 'text-primary-foreground',
                    )}
                  >
                    {rect.drep.name}
                  </span>
                  {largeEnough && (
                    <span
                      className={cn(
                        'text-[9px] tabular-nums opacity-80',
                        isOthers ? 'text-muted-foreground' : 'text-primary-foreground',
                      )}
                    >
                      {rect.pct.toFixed(1)}%
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Tooltip for hovered */}
        {hoveredIdx !== null && rects[hoveredIdx] && (
          <div
            className="absolute z-20 pointer-events-none bg-popover border border-border rounded-lg px-3 py-2 shadow-xl"
            style={{
              left: Math.min(
                rects[hoveredIdx].x + rects[hoveredIdx].w / 2,
                (dimensions.width || 400) - 160,
              ),
              top: Math.max(4, rects[hoveredIdx].y - 48),
            }}
          >
            <p className="text-xs font-medium text-foreground">{rects[hoveredIdx].drep.name}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {rects[hoveredIdx].pct.toFixed(2)}% voting power
            </p>
          </div>
        )}
      </div>

      {/* Insight line */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Top {topDReps.length} DReps control{' '}
          <strong className="text-foreground">{(100 - othersPct).toFixed(1)}%</strong> of voting
          power
        </span>
        <span className="tabular-nums">
          Gini:{' '}
          <strong
            className={cn(
              'text-foreground',
              gini > 0.6 && 'text-rose-400',
              gini <= 0.6 && gini > 0.3 && 'text-amber-400',
              gini <= 0.3 && 'text-emerald-400',
            )}
          >
            {gini.toFixed(2)}
          </strong>
        </span>
      </div>
    </div>
  );
}
