'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────── */

interface RingSnapshot {
  epoch: number;
  delegation_ring: number;
  coverage_ring: number;
  engagement_ring: number;
  pulse: number;
}

interface PulseHistoryChartProps {
  className?: string;
}

/* ── Data hook ─────────────────────────────────────────────────── */

function useRingHistory() {
  return useQuery<{ snapshots: RingSnapshot[] }>({
    queryKey: ['ring-history'],
    queryFn: async () => {
      const res = await fetch('/api/you/ring-history?limit=20');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ── SVG Sparkline ─────────────────────────────────────────────── */

function Sparkline({ values, width, height }: { values: number[]; width: number; height: number }) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;
  const innerHeight = height - padding * 2;
  const innerWidth = width - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((v - min) / range) * innerHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Gradient fill area
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = `${pathD} L ${lastPoint.split(',')[0]},${height} L ${firstPoint.split(',')[0]},${height} Z`;

  // Color based on trend
  const latest = values[values.length - 1];
  const previous = values[Math.max(0, values.length - 4)];
  const trending = latest > previous ? 'up' : latest < previous ? 'down' : 'flat';
  const strokeColor = trending === 'up' ? '#22c55e' : trending === 'down' ? '#f59e0b' : '#6366f1';
  const fillColor =
    trending === 'up'
      ? 'rgba(34, 197, 94, 0.1)'
      : trending === 'down'
        ? 'rgba(245, 158, 11, 0.1)'
        : 'rgba(99, 102, 241, 0.1)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <path d={areaD} fill={fillColor} />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Latest value dot */}
      <circle
        cx={Number(lastPoint.split(',')[0])}
        cy={Number(lastPoint.split(',')[1])}
        r={2.5}
        fill={strokeColor}
      />
    </svg>
  );
}

/* ── Component ─────────────────────────────────────────────────── */

export function PulseHistoryChart({ className }: PulseHistoryChartProps) {
  const { data, isLoading } = useRingHistory();
  const snapshots = data?.snapshots ?? [];

  // Need at least 2 data points for a meaningful chart
  if (isLoading || snapshots.length < 2) return null;

  const pulseValues = snapshots.map((s) => s.pulse);
  const latest = pulseValues[pulseValues.length - 1];
  const earliest = pulseValues[0];
  const delta = latest - earliest;

  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendColor =
    delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-amber-500' : 'text-muted-foreground';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Sparkline values={pulseValues} width={120} height={32} />
      <div className="flex items-center gap-1">
        <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
        <span className={cn('text-xs font-medium tabular-nums', trendColor)}>
          {delta > 0 ? '+' : ''}
          {delta}
        </span>
        <span className="text-xs text-muted-foreground">/ {snapshots.length} epochs</span>
      </div>
    </div>
  );
}
