'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Vote, TrendingUp, Shield, BarChart3 } from 'lucide-react';
import { chartTheme, CHART_PALETTE } from '@/lib/charts';
import { useChartDimensions } from '@/lib/charts';

interface EpochStat {
  epoch_no: number;
  total_dreps: number | null;
  active_dreps: number | null;
  participation_rate: number | null;
  avg_drep_score: number | null;
  rationale_rate: number | null;
  proposals_submitted: number | null;
  proposals_ratified: number | null;
}

interface GHISnapshot {
  epoch_no: number;
  score: number;
  band: string;
}

interface DecentralizationSnapshot {
  epoch_no: number;
  composite_score: number;
  nakamoto_coefficient: number;
  gini: number;
  active_drep_count: number | null;
}

interface GovernanceData {
  epoch_stats: EpochStat[];
  ghi_snapshots: GHISnapshot[];
  decentralization: DecentralizationSnapshot[];
  tier_distribution: Array<{ tier: string; count: number }>;
  proposal_types: Array<{ type: string; count: number }>;
}

const TIER_COLORS: Record<string, string> = {
  Legendary: 'oklch(0.75 0.15 80)',
  Diamond: 'oklch(0.72 0.14 200)',
  Gold: 'oklch(0.75 0.14 80)',
  Silver: 'oklch(0.65 0.03 260)',
  Bronze: 'oklch(0.60 0.10 50)',
  Emerging: 'oklch(0.55 0.05 260)',
};

function TrendLineChart({
  data,
  xKey,
  yKey,
  color = CHART_PALETTE[0],
  yLabel,
  formatY = (v: number) => v.toFixed(1),
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Array<Record<string, any>>;
  xKey: string;
  yKey: string;
  color?: string;
  yLabel?: string;
  formatY?: (v: number) => string;
}) {
  const { containerRef, dimensions } = useChartDimensions(200);
  const { width, height } = dimensions;
  const margin = { top: 10, right: 12, bottom: 28, left: 48 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const values = useMemo(() => data.map((d) => Number(d[yKey]) || 0), [data, yKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  if (innerW <= 0 || innerH <= 0 || data.length < 2) {
    return <div ref={containerRef} className="w-full h-[200px]" />;
  }

  const points = values.map((v, i) => {
    const x = margin.left + (i / (data.length - 1)) * innerW;
    const y = margin.top + innerH - ((v - min) / range) * innerH;
    return { x, y, v };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaD =
    pathD +
    ` L ${points[points.length - 1].x} ${margin.top + innerH} L ${points[0].x} ${margin.top + innerH} Z`;

  return (
    <div ref={containerRef} className="w-full h-[200px]">
      <svg width={width} height={height}>
        {/* Grid */}
        {[0, 0.5, 1].map((frac) => (
          <g key={frac}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={margin.top + innerH * (1 - frac)}
              y2={margin.top + innerH * (1 - frac)}
              stroke={chartTheme.colors.grid}
              strokeWidth={0.5}
            />
            <text
              x={margin.left - 6}
              y={margin.top + innerH * (1 - frac) + 4}
              textAnchor="end"
              fill={chartTheme.colors.axis}
              fontSize={chartTheme.font.size.tick}
              fontFamily={chartTheme.font.mono}
            >
              {formatY(min + range * frac)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={color} opacity={0.08} />

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={2} />

        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color}>
            <title>
              Epoch {String(data[i][xKey])}: {formatY(p.v)}
            </title>
          </circle>
        ))}

        {/* X-axis labels */}
        {data
          .filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0)
          .map((d) => {
            const origIdx = data.indexOf(d);
            const x = margin.left + (origIdx / (data.length - 1)) * innerW;
            return (
              <text
                key={origIdx}
                x={x}
                y={height - 4}
                textAnchor="middle"
                fill={chartTheme.colors.axis}
                fontSize={chartTheme.font.size.tick}
                fontFamily={chartTheme.font.mono}
              >
                {String(d[xKey])}
              </text>
            );
          })}

        {/* Y label */}
        {yLabel && (
          <text
            x={margin.left - 36}
            y={margin.top + innerH / 2}
            textAnchor="middle"
            transform={`rotate(-90, ${margin.left - 36}, ${margin.top + innerH / 2})`}
            fill={chartTheme.colors.axis}
            fontSize={chartTheme.font.size.label}
            fontFamily={chartTheme.font.family}
          >
            {yLabel}
          </text>
        )}
      </svg>
    </div>
  );
}

function TierBarChart({ data }: { data: Array<{ tier: string; count: number }> }) {
  const { containerRef, dimensions } = useChartDimensions(160);
  const { width, height } = dimensions;
  const margin = { top: 8, right: 12, bottom: 20, left: 8 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const total = data.reduce((s, d) => s + d.count, 0);
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  if (innerW <= 0 || data.length === 0) {
    return <div ref={containerRef} className="w-full h-[160px]" />;
  }

  const barH = Math.min(20, (innerH - (data.length - 1) * 4) / data.length);

  return (
    <div ref={containerRef} className="w-full h-[160px]">
      <svg width={width} height={height}>
        {data.map((d, i) => {
          const y = margin.top + i * (barH + 4);
          const w = (d.count / maxCount) * (innerW * 0.6);
          const color = TIER_COLORS[d.tier] || CHART_PALETTE[i % CHART_PALETTE.length];

          return (
            <g key={d.tier}>
              <text
                x={margin.left}
                y={y + barH / 2 + 4}
                fill={chartTheme.colors.axis}
                fontSize={chartTheme.font.size.tick}
                fontFamily={chartTheme.font.family}
              >
                {d.tier}
              </text>
              <rect
                x={margin.left + innerW * 0.3}
                y={y}
                width={w}
                height={barH}
                fill={color}
                rx={2}
                opacity={0.8}
              >
                <title>
                  {d.tier}: {d.count} ({((d.count / total) * 100).toFixed(1)}%)
                </title>
              </rect>
              <text
                x={margin.left + innerW * 0.3 + w + 6}
                y={y + barH / 2 + 4}
                fill={chartTheme.colors.axis}
                fontSize={chartTheme.font.size.tick}
                fontFamily={chartTheme.font.mono}
              >
                {d.count}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function GovernanceClient() {
  const { data, isLoading } = useQuery<GovernanceData>({
    queryKey: ['admin', 'governance'],
    queryFn: async () => {
      const res = await fetch('/api/admin/governance');
      if (!res.ok) throw new Error('Failed to fetch governance data');
      return res.json();
    },
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-56 bg-muted rounded" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg" />
          ))}
        </div>
        <div className="h-[200px] bg-muted rounded-lg" />
      </div>
    );
  }

  const latest = data.epoch_stats[data.epoch_stats.length - 1];
  const latestGHI = data.ghi_snapshots[data.ghi_snapshots.length - 1];
  const latestDecent = data.decentralization[data.decentralization.length - 1];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Governance Overview</h1>
        <p className="text-sm text-muted-foreground">Network-level governance metrics and trends</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-chart-1" />
              <span className="text-xs text-muted-foreground">Active DReps</span>
            </div>
            <p className="text-xl font-bold">
              {latest?.active_dreps?.toLocaleString() || '--'}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                / {latest?.total_dreps?.toLocaleString()}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Vote className="h-4 w-4 text-chart-2" />
              <span className="text-xs text-muted-foreground">Participation</span>
            </div>
            <p className="text-xl font-bold">
              {latest?.participation_rate != null
                ? `${(latest.participation_rate * 100).toFixed(1)}%`
                : '--'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-chart-3" />
              <span className="text-xs text-muted-foreground">GHI Score</span>
            </div>
            <p className="text-xl font-bold">
              {latestGHI?.score?.toFixed(1) || '--'}
              {latestGHI?.band && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {latestGHI.band}
                </Badge>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-4 w-4 text-chart-4" />
              <span className="text-xs text-muted-foreground">Nakamoto Coeff</span>
            </div>
            <p className="text-xl font-bold">{latestDecent?.nakamoto_coefficient || '--'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participation Rate by Epoch</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart
              data={data.epoch_stats.filter((d) => d.participation_rate != null)}
              xKey="epoch_no"
              yKey="participation_rate"
              color={CHART_PALETTE[0]}
              formatY={(v) => `${(v * 100).toFixed(0)}%`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GHI Score by Epoch</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart
              data={data.ghi_snapshots}
              xKey="epoch_no"
              yKey="score"
              color={CHART_PALETTE[2]}
              formatY={(v) => v.toFixed(1)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active DReps by Epoch</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart
              data={data.epoch_stats.filter((d) => d.active_dreps != null)}
              xKey="epoch_no"
              yKey="active_dreps"
              color={CHART_PALETTE[1]}
              formatY={(v) => Math.round(v).toLocaleString()}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decentralization (Composite)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendLineChart
              data={data.decentralization}
              xKey="epoch_no"
              yKey="composite_score"
              color={CHART_PALETTE[3]}
              formatY={(v) => v.toFixed(2)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              DRep Tier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TierBarChart data={data.tier_distribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposal Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.proposal_types.map((pt) => (
                <div key={pt.type} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate mr-2">{pt.type}</span>
                  <span className="font-mono font-medium">{pt.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
