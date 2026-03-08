'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface HeatmapCell {
  epoch: number;
  value: number; // 0-100
  label?: string;
}

interface ActivityHeatmapProps {
  data: HeatmapCell[];
  valueLabel?: string;
  className?: string;
}

const CELL_SIZE = 18;
const CELL_GAP = 2;
const COLS = 10;

function getHeatColor(value: number): string {
  if (value >= 80) return 'bg-emerald-500/80';
  if (value >= 60) return 'bg-emerald-500/50';
  if (value >= 40) return 'bg-emerald-500/30';
  if (value >= 20) return 'bg-emerald-500/15';
  if (value > 0) return 'bg-emerald-500/8';
  return 'bg-muted/30';
}

export function ActivityHeatmap({
  data,
  valueLabel = 'participation',
  className,
}: ActivityHeatmapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const cells = useMemo(() => {
    // Take most recent N epochs, arrange in rows of COLS
    const sorted = [...data].sort((a, b) => a.epoch - b.epoch);
    return sorted.map((cell, i) => ({
      ...cell,
      row: Math.floor(i / COLS),
      col: i % COLS,
    }));
  }, [data]);

  const rows = Math.ceil(cells.length / COLS);
  const gridWidth = COLS * (CELL_SIZE + CELL_GAP);

  const avgValue = cells.length > 0 ? cells.reduce((s, c) => s + c.value, 0) / cells.length : 0;
  const recentAvg =
    cells.length >= 5 ? cells.slice(-5).reduce((s, c) => s + c.value, 0) / 5 : avgValue;
  const trend = recentAvg - avgValue;

  return (
    <div className={cn('space-y-3', className)} role="img" aria-label="Governance activity heatmap">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Legend gradient */}
          <span className="text-[10px] text-muted-foreground">Less</span>
          <div className="flex gap-0.5">
            {[
              'bg-muted/30',
              'bg-emerald-500/8',
              'bg-emerald-500/15',
              'bg-emerald-500/30',
              'bg-emerald-500/50',
              'bg-emerald-500/80',
            ].map((c, i) => (
              <div key={i} className={cn('h-3 w-3 rounded-sm', c)} />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          Avg: <strong className="text-foreground">{avgValue.toFixed(1)}%</strong>
          {Math.abs(trend) > 1 && (
            <span className={cn('ml-1', trend > 0 ? 'text-emerald-400' : 'text-rose-400')}>
              ({trend > 0 ? '+' : ''}
              {trend.toFixed(1)})
            </span>
          )}
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <div
          className="inline-grid"
          style={{
            gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
            gap: CELL_GAP,
          }}
        >
          {cells.map((cell, i) => (
            <div
              key={cell.epoch}
              className={cn(
                'rounded-sm transition-all duration-100 cursor-default',
                getHeatColor(cell.value),
                hoveredIdx === i && 'ring-1 ring-primary scale-110',
              )}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </div>

        {/* Tooltip */}
        {hoveredIdx !== null && cells[hoveredIdx] && (
          <div
            className="absolute z-10 pointer-events-none bg-popover border border-border rounded-lg px-2.5 py-1.5 shadow-lg"
            style={{
              left: Math.min(cells[hoveredIdx].col * (CELL_SIZE + CELL_GAP), gridWidth - 120),
              top: cells[hoveredIdx].row * (CELL_SIZE + CELL_GAP) - 40,
            }}
          >
            <p className="text-[11px] font-medium text-foreground">
              Epoch {cells[hoveredIdx].epoch}
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {cells[hoveredIdx].value.toFixed(1)}% {valueLabel}
            </p>
          </div>
        )}
      </div>

      {/* Epoch range */}
      {cells.length > 0 && (
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Epoch {cells[0].epoch}</span>
          <span>{cells.length} epochs</span>
          <span>Epoch {cells[cells.length - 1].epoch}</span>
        </div>
      )}
    </div>
  );
}
