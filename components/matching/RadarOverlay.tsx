'use client';

import { useMemo } from 'react';
import {
  alignmentsToArray,
  getDimensionOrder,
  getDimensionLabel,
  getDominantDimension,
  getIdentityColor,
} from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

interface RadarOverlayProps {
  userAlignments: AlignmentScores | null | undefined;
  drepAlignments: AlignmentScores | null | undefined;
  size?: number;
  className?: string;
  /** Animate the two shapes merging together */
  animate?: boolean;
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
  animate = false,
}: RadarOverlayProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = (size - PADDING * 2) / 2;

  const safeUser = userAlignments ?? FALLBACK_ALIGNMENTS;
  const safeDrep = drepAlignments ?? FALLBACK_ALIGNMENTS;

  const userScores = useMemo(() => alignmentsToArray(safeUser), [safeUser]);
  const drepScores = useMemo(() => alignmentsToArray(safeDrep), [safeDrep]);
  const dimensions = getDimensionOrder();

  // Derive identity colors from alignment data
  const userColor = useMemo(() => {
    if (!userAlignments) return { hex: '#3b82f6', rgb: [59, 130, 246] as [number, number, number] };
    return getIdentityColor(getDominantDimension(userAlignments));
  }, [userAlignments]);

  const entityColor = useMemo(() => {
    if (!drepAlignments) return { hex: '#a855f7', rgb: [168, 85, 247] as [number, number, number] };
    return getIdentityColor(getDominantDimension(drepAlignments));
  }, [drepAlignments]);

  // eslint-disable-next-line react-hooks/purity -- stable SVG gradient ID
  const uid = useMemo(() => `ro-${Math.random().toString(36).slice(2, 6)}`, []);

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
  const showLabels = size >= 140;

  // Animation offset — shapes start displaced and merge together
  const offset = size * 0.15;
  const animDuration = '1.2s';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('shrink-0', className)}
    >
      <defs>
        <radialGradient id={`${uid}-entity`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={entityColor.hex} stopOpacity={0.3} />
          <stop offset="100%" stopColor={entityColor.hex} stopOpacity={0.05} />
        </radialGradient>
        <radialGradient id={`${uid}-user`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={userColor.hex} stopOpacity={0.35} />
          <stop offset="100%" stopColor={userColor.hex} stopOpacity={0.08} />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={2} />
        </filter>
      </defs>

      {/* Grid rings */}
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
          strokeOpacity={r === 1 ? 0.15 : 0.08}
          strokeWidth={r === 1 ? 0.8 : 0.5}
        />
      ))}

      {/* Axis lines with dimension-colored tips */}
      {dimensions.map((dim, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const dimColor = getIdentityColor(dim);
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(angle)}
              y2={cy + maxR * Math.sin(angle)}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={0.5}
            />
            <circle
              cx={cx + maxR * Math.cos(angle)}
              cy={cy + maxR * Math.sin(angle)}
              r={size >= 140 ? 2 : 1.5}
              fill={dimColor.hex}
              opacity={0.5}
            />
          </g>
        );
      })}

      {/* Entity shape (background) — with gradient fill and glow */}
      <g>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${offset} 0`}
            to="0 0"
            dur={animDuration}
            fill="freeze"
            calcMode="spline"
            keySplines="0.16 1 0.3 1"
          />
        )}
        <polygon
          points={drepPoints}
          fill={`url(#${uid}-entity)`}
          stroke={entityColor.hex}
          strokeWidth={1.5}
          strokeOpacity={0.6}
          strokeLinejoin="round"
          filter={`url(#${uid}-glow)`}
        />
        <polygon
          points={drepPoints}
          fill={`url(#${uid}-entity)`}
          stroke={entityColor.hex}
          strokeWidth={1.5}
          strokeOpacity={0.7}
          strokeLinejoin="round"
        />
        {/* Vertex dots for entity */}
        {drepScores.map((score, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const r = maxR * (score / 100);
          return (
            <circle
              key={`e-${i}`}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={1.5}
              fill={entityColor.hex}
              opacity={0.7}
            />
          );
        })}
      </g>

      {/* User shape (foreground) — with gradient fill */}
      <g>
        {animate && (
          <animateTransform
            attributeName="transform"
            type="translate"
            from={`${-offset} 0`}
            to="0 0"
            dur={animDuration}
            fill="freeze"
            calcMode="spline"
            keySplines="0.16 1 0.3 1"
          />
        )}
        <polygon
          points={userPoints}
          fill={`url(#${uid}-user)`}
          stroke={userColor.hex}
          strokeWidth={1.5}
          strokeOpacity={0.8}
          strokeLinejoin="round"
        />
        {/* Vertex dots for user */}
        {userScores.map((score, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const r = maxR * (score / 100);
          return (
            <circle
              key={`u-${i}`}
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r={1.5}
              fill={userColor.hex}
              opacity={0.8}
            />
          );
        })}
      </g>

      {/* Legend — which shape is you vs your match */}
      {animate && showLabels && (
        <g opacity={0}>
          <animate attributeName="opacity" from="0" to="1" begin="0.8s" dur="0.5s" fill="freeze" />
          <circle cx={PADDING} cy={size - 10} r={3} fill={userColor.hex} opacity={0.8} />
          <text
            x={PADDING + 7}
            y={size - 10}
            dominantBaseline="central"
            fontSize={7}
            fill={userColor.hex}
            opacity={0.8}
          >
            You
          </text>
          <circle cx={PADDING + 34} cy={size - 10} r={3} fill={entityColor.hex} opacity={0.7} />
          <text
            x={PADDING + 41}
            y={size - 10}
            dominantBaseline="central"
            fontSize={7}
            fill={entityColor.hex}
            opacity={0.7}
          >
            Match
          </text>
        </g>
      )}

      {/* Dimension labels — only on larger sizes */}
      {showLabels &&
        dimensions.map((dim, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const dimColor = getIdentityColor(dim);
          const labelR = maxR + 10;
          const x = cx + labelR * Math.cos(angle);
          const y = cy + labelR * Math.sin(angle);
          return (
            <text
              key={dim}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={dimColor.hex}
              fontSize={6.5}
              fontWeight={500}
              opacity={0.7}
            >
              {getDimensionLabel(dim).replace('Treasury ', '')}
            </text>
          );
        })}
    </svg>
  );
}
