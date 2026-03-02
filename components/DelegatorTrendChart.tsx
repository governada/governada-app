'use client';

import { useEffect, useState, useMemo, useCallback, type MouseEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';

interface Snapshot {
  epoch: number;
  votingPowerAda: number;
  delegatorCount: number | null;
}

interface DelegatorTrendChartProps {
  drepId: string;
}

export function DelegatorTrendChart({ drepId }: DelegatorTrendChartProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [currentDelegators, setCurrentDelegators] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(180);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  useEffect(() => {
    if (!drepId) return;
    fetch(`/api/dashboard/delegator-trends?drepId=${encodeURIComponent(drepId)}`)
      .then((r) => r.json())
      .then((d) => {
        setSnapshots(d.snapshots || []);
        setCurrentDelegators(d.currentDelegators);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [drepId]);

  const chartData = useMemo(
    () => snapshots.map((s) => ({ label: `E${s.epoch}`, value: s.votingPowerAda })),
    [snapshots],
  );

  const yMax = useMemo(
    () => Math.max(...chartData.map((d) => d.value), 1),
    [chartData],
  );

  const xScale = useMemo(
    () => scalePoint<string>().domain(chartData.map((d) => d.label)).range([0, innerWidth]).padding(0.1),
    [chartData, innerWidth],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]),
    [yMax, innerHeight],
  );

  const linePath = useMemo(() => {
    const gen = line<(typeof chartData)[0]>()
      .x((d) => xScale(d.label) ?? 0)
      .y((d) => yScale(d.value))
      .curve(curveMonotoneX);
    return gen(chartData) ?? '';
  }, [chartData, xScale, yScale]);

  const areaPath = useMemo(() => {
    const gen = area<(typeof chartData)[0]>()
      .x((d) => xScale(d.label) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.value))
      .curve(curveMonotoneX);
    return gen(chartData) ?? '';
  }, [chartData, xScale, yScale, innerHeight]);

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const step = innerWidth / Math.max(1, chartData.length - 1);
      const idx = Math.round(relX / step);
      setHoveredIndex(Math.max(0, Math.min(chartData.length - 1, idx)));
    },
    [chartData.length, innerWidth, margin.left],
  );

  const formatAdaValue = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toLocaleString();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Delegator Analytics</CardTitle>
        </CardHeader>
        <CardContent><div className="h-[180px] animate-pulse bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Delegator Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Power tracking data will appear here as snapshots are collected.</p>
          {currentDelegators !== null && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-bold tabular-nums">{currentDelegators}</span>
              <span className="text-sm text-muted-foreground">current delegators</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const powerChange = last.votingPowerAda - first.votingPowerAda;
  const powerChangeFormatted = formatAdaValue(Math.abs(powerChange));
  const hovered = hoveredIndex !== null ? chartData[hoveredIndex] : null;
  const ticks = yScale.ticks(4);
  const xTicks = chartData.length <= 8 ? chartData : chartData.filter((_, i) => i % Math.ceil(chartData.length / 6) === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Delegator Analytics</CardTitle>
          <div className="flex items-center gap-3">
            {currentDelegators !== null && (
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{currentDelegators}</span> delegators
              </span>
            )}
            {snapshots.length > 1 && (
              <span className={`text-xs font-medium flex items-center gap-1 ${powerChange > 0 ? 'text-green-600 dark:text-green-400' : powerChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {powerChange > 0 ? <TrendingUp className="h-3 w-3" /> : powerChange < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                {powerChange > 0 ? '+' : powerChange < 0 ? '-' : ''}{powerChangeFormatted} ADA
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative w-full" style={{ height: 180 }}>
          {width > 0 && (
            <svg width={width} height={180}>
              <defs>
                <GlowFilter id="delegator-glow" stdDeviation={3} />
                <AreaGradient id="delegator-fill" color="oklch(0.68 0.16 160)" topOpacity={0.2} />
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                    <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">
                      {formatAdaValue(t)}
                    </text>
                  </g>
                ))}

                {xTicks.map((d) => (
                  <text key={d.label} x={xScale(d.label) ?? 0} y={innerHeight + 18} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">
                    {d.label}
                  </text>
                ))}

                <path d={areaPath} fill="url(#delegator-fill)" />
                <path d={linePath} fill="none" stroke="oklch(0.68 0.16 160)" strokeWidth={2.5} filter="url(#delegator-glow)" opacity={0.5} />
                <path d={linePath} fill="none" stroke="oklch(0.68 0.16 160)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

                {chartData.map((d, i) => (
                  <circle
                    key={i}
                    cx={xScale(d.label) ?? 0}
                    cy={yScale(d.value)}
                    r={hoveredIndex === i ? 5 : 2.5}
                    fill="oklch(0.68 0.16 160)"
                    stroke="oklch(0.07 0.015 260)"
                    strokeWidth={1.5}
                  />
                ))}

                {hoveredIndex !== null && (
                  <line
                    x1={xScale(chartData[hoveredIndex].label) ?? 0}
                    x2={xScale(chartData[hoveredIndex].label) ?? 0}
                    y1={0} y2={innerHeight}
                    stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" className="text-muted-foreground"
                  />
                )}

                <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent"
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              </g>
            </svg>
          )}

          {hovered && hoveredIndex !== null && width > 0 && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: margin.left + (xScale(hovered.label) ?? 0),
                top: margin.top + yScale(hovered.value) - 10,
                transform: `translate(${(xScale(hovered.label) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'}, -50%)`,
              }}
            >
              <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium mb-0.5">{hovered.label}</p>
                <p className="font-mono tabular-nums">{hovered.value.toLocaleString()} ADA</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
