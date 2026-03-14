'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

interface ChainData {
  chain: string;
  color: string;
  values: Record<string, number>; // 0-100 for each axis
}

interface CrossChainRadarProps {
  chains: ChainData[];
  axes: { key: string; label: string }[];
  className?: string;
}

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_RADIUS = 95;

function polarPoint(angle: number, radius: number): { x: number; y: number } {
  // Start from top (-PI/2), go clockwise
  const a = angle - Math.PI / 2;
  return {
    x: CX + radius * Math.cos(a),
    y: CY + radius * Math.sin(a),
  };
}

export function CrossChainRadar({ chains, axes, className }: CrossChainRadarProps) {
  const [hoveredChain, setHoveredChain] = useState<string | null>(null);

  const angleStep = (2 * Math.PI) / axes.length;

  const gridLevels = [20, 40, 60, 80, 100];

  const polygons = useMemo(
    () =>
      chains.map((chain) => {
        const points = axes
          .map((axis, i) => {
            const value = chain.values[axis.key] ?? 0;
            const radius = (value / 100) * MAX_RADIUS;
            return polarPoint(i * angleStep, radius);
          })
          .map((p) => `${p.x},${p.y}`)
          .join(' ');
        return { chain: chain.chain, color: chain.color, points };
      }),
    [chains, axes, angleStep],
  );

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      role="img"
      aria-label="Cross-chain governance comparison radar chart"
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[280px]" aria-hidden="true">
        <defs>
          {chains.map((chain) => (
            <linearGradient
              key={`grad-${chain.chain}`}
              id={`radar-fill-${chain.chain}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={chain.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={chain.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>

        {/* Grid circles */}
        {gridLevels.map((level) => {
          const r = (level / 100) * MAX_RADIUS;
          const pts = axes
            .map((_, i) => polarPoint(i * angleStep, r))
            .map((p) => `${p.x},${p.y}`)
            .join(' ');
          return (
            <polygon
              key={level}
              points={pts}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={level === 100 ? 0.4 : 0.2}
            />
          );
        })}

        {/* Axis lines */}
        {axes.map((_, i) => {
          const endpoint = polarPoint(i * angleStep, MAX_RADIUS);
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={endpoint.x}
              y2={endpoint.y}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={0.3}
            />
          );
        })}

        {/* Data polygons */}
        {polygons.map(({ chain, color, points }) => (
          <g key={chain}>
            <polygon
              points={points}
              fill={`url(#radar-fill-${chain})`}
              stroke={color}
              strokeWidth={hoveredChain === chain ? 2.5 : 1.5}
              strokeLinejoin="round"
              opacity={hoveredChain && hoveredChain !== chain ? 0.3 : 1}
              className="transition-opacity duration-200"
            />
          </g>
        ))}

        {/* Data points */}
        {chains.map((chain) =>
          axes.map((axis, i) => {
            const value = chain.values[axis.key] ?? 0;
            const radius = (value / 100) * MAX_RADIUS;
            const point = polarPoint(i * angleStep, radius);
            const isActive = !hoveredChain || hoveredChain === chain.chain;
            return (
              <circle
                key={`${chain.chain}-${axis.key}`}
                cx={point.x}
                cy={point.y}
                r={isActive ? 3 : 2}
                fill={chain.color}
                opacity={isActive ? 1 : 0.3}
                className="transition-all duration-200"
              />
            );
          }),
        )}

        {/* Axis labels */}
        {axes.map((axis, i) => {
          const labelRadius = MAX_RADIUS + 16;
          const point = polarPoint(i * angleStep, labelRadius);
          const isTop = i === 0;
          const isBottom = axes.length > 1 && i === Math.floor(axes.length / 2);

          return (
            <text
              key={axis.key}
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline={isTop ? 'auto' : isBottom ? 'hanging' : 'central'}
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={9}
              fontFamily="var(--font-geist-sans)"
              fontWeight={500}
            >
              {axis.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
        {chains.map((chain) => (
          <button
            key={chain.chain}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium transition-opacity',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded',
              hoveredChain && hoveredChain !== chain.chain ? 'opacity-40' : 'opacity-100',
            )}
            onMouseEnter={() => setHoveredChain(chain.chain)}
            onMouseLeave={() => setHoveredChain(null)}
            onFocus={() => setHoveredChain(chain.chain)}
            onBlur={() => setHoveredChain(null)}
            aria-label={`Highlight ${chain.chain} data`}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: chain.color }}
            />
            <span className="capitalize text-foreground">{chain.chain}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
