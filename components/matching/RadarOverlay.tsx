'use client';

import { useMemo } from 'react';
import { alignmentsToArray, getDimensionOrder, getDimensionLabel } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

interface RadarOverlayProps {
  userAlignments: AlignmentScores | null | undefined;
  drepAlignments: AlignmentScores | null | undefined;
  size?: number;
  className?: string;
}

const PADDING = 20;

const FALLBACK_ALIGNMENTS: AlignmentScores = {
  treasuryConservative: 50,
  treasuryGrowth: 50,
  decentralization: 50,
  security: 50,
  innovation: 50,
  transparency: 50,
};

function getPolygonPoints(scores: number[], cx: number, cy: number, maxR: number): string {
  return scores
    .map((score, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const r = maxR * (score / 100);
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export function RadarOverlay({
  userAlignments,
  drepAlignments,
  size = 160,
  className,
}: RadarOverlayProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size - PADDING * 2) / 2;

  const safeUser = userAlignments ?? FALLBACK_ALIGNMENTS;
  const safeDrep = drepAlignments ?? FALLBACK_ALIGNMENTS;

  const userScores = useMemo(() => alignmentsToArray(safeUser), [safeUser]);
  const drepScores = useMemo(() => alignmentsToArray(safeDrep), [safeDrep]);
  const dimensions = getDimensionOrder();

  // If both alignments are missing, show placeholder text
  if (!userAlignments && !drepAlignments) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn('shrink-0', className)}
      >
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          fontSize={10}
        >
          No alignment data
        </text>
      </svg>
    );
  }

  const userPoints = getPolygonPoints(userScores, cx, cy, maxR);
  const drepPoints = getPolygonPoints(drepScores, cx, cy, maxR);

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
    >
      {/* Grid */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: 6 }, (_, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const radius = maxR * r;
            return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
          strokeWidth={0.5}
        />
      ))}

      {/* Axis lines */}
      {dimensions.map((_, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={0.5}
          />
        );
      })}

      {/* DRep shape (background) */}
      <polygon
        points={drepPoints}
        fill="hsl(var(--primary))"
        fillOpacity={0.1}
        stroke="hsl(var(--primary))"
        strokeOpacity={0.4}
        strokeWidth={1.5}
      />

      {/* User shape (foreground) */}
      <polygon
        points={userPoints}
        fill="hsl(var(--chart-2))"
        fillOpacity={0.15}
        stroke="hsl(var(--chart-2))"
        strokeOpacity={0.7}
        strokeWidth={1.5}
      />

      {/* Dimension labels */}
      {dimensions.map((dim, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const labelR = maxR + 12;
        const x = cx + labelR * Math.cos(angle);
        const y = cy + labelR * Math.sin(angle);
        return (
          <text
            key={dim}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-muted-foreground"
            fontSize={7}
          >
            {getDimensionLabel(dim).replace('Treasury ', '')}
          </text>
        );
      })}
    </svg>
  );
}
