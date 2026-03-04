'use client';

import { useEffect, useState, useMemo, useCallback, type MouseEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { useDRepTrajectory } from '@/hooks/queries';
import { line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import { posthog } from '@/lib/posthog';
import { TrendingUp } from 'lucide-react';
import type { AlignmentDimension } from '@/lib/drepIdentity';

interface Snapshot {
  epoch: number;
  treasuryConservative: number | null;
  treasuryGrowth: number | null;
  decentralization: number | null;
  security: number | null;
  innovation: number | null;
  transparency: number | null;
}

interface AlignmentTrajectoryProps {
  drepId: string;
}

const DIMENSIONS: { key: AlignmentDimension; label: string; color: string }[] = [
  { key: 'treasuryConservative', label: 'Conservative', color: '#dc2626' },
  { key: 'treasuryGrowth', label: 'Growth', color: '#10b981' },
  { key: 'decentralization', label: 'Decentralization', color: '#a855f7' },
  { key: 'security', label: 'Security', color: '#f59e0b' },
  { key: 'innovation', label: 'Innovation', color: '#06b6d4' },
  { key: 'transparency', label: 'Transparency', color: '#3b82f6' },
];

export function AlignmentTrajectory({ drepId }: AlignmentTrajectoryProps) {
  const { data: trajectoryData, isLoading } = useDRepTrajectory(drepId);
  const snapshots = useMemo<Snapshot[]>(
    () => ((trajectoryData as any)?.snapshots || []).slice(-20),
    [trajectoryData],
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(280);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  useEffect(() => {
    if (snapshots.length > 0) {
      posthog.capture('alignment_trajectory_viewed', {
        drep_id: drepId,
        epoch_count: snapshots.length,
      });
    }
  }, [snapshots.length, drepId]);

  const xScale = useMemo(
    () =>
      scalePoint<number>()
        .domain(snapshots.map((s) => s.epoch))
        .range([0, innerWidth])
        .padding(0.1),
    [snapshots, innerWidth],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([innerHeight, 0]),
    [innerHeight],
  );

  const linePaths = useMemo(() => {
    if (snapshots.length < 2) return [];
    return DIMENSIONS.map(({ key }) => {
      const gen = line<Snapshot>()
        .defined((d) => d[key] != null)
        .x((d) => xScale(d.epoch) ?? 0)
        .y((d) => yScale(d[key] ?? 50))
        .curve(curveMonotoneX);
      return gen(snapshots) ?? '';
    });
  }, [snapshots, xScale, yScale]);

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const step = innerWidth / Math.max(1, snapshots.length - 1);
      const idx = Math.round(relX / step);
      setHoveredIndex(Math.max(0, Math.min(snapshots.length - 1, idx)));
    },
    [snapshots.length, innerWidth, margin.left],
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Alignment Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (snapshots.length < 2) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Alignment Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Alignment tracking needs at least 2 epochs of data. Check back after the next snapshot.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ticks = yScale.ticks(5);
  const xTicks =
    snapshots.length <= 10
      ? snapshots
      : snapshots.filter((_, i) => i % Math.ceil(snapshots.length / 8) === 0);

  const hovered = hoveredIndex !== null ? snapshots[hoveredIndex] : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Alignment Trajectory
          </CardTitle>
          <span className="text-[10px] text-muted-foreground">
            Epochs {snapshots[0].epoch}–{snapshots[snapshots.length - 1].epoch}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full relative" style={{ height: 280 }}>
          {width > 0 && (
            <svg width={width} height={280}>
              <defs>
                <GlowFilter id="trajectory-glow" stdDeviation={2} />
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {ticks.map((t) => (
                  <line
                    key={t}
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(t)}
                    y2={yScale(t)}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="4 4"
                    className="text-border"
                  />
                ))}

                {ticks.map((t) => (
                  <text
                    key={`y-${t}`}
                    x={-8}
                    y={yScale(t)}
                    textAnchor="end"
                    dominantBaseline="central"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                  >
                    {t}
                  </text>
                ))}

                {xTicks.map((s) => (
                  <text
                    key={s.epoch}
                    x={xScale(s.epoch) ?? 0}
                    y={innerHeight + 18}
                    textAnchor="middle"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                  >
                    E{s.epoch}
                  </text>
                ))}

                {/* Glow layer */}
                {linePaths.map((path, i) => (
                  <path
                    key={`glow-${DIMENSIONS[i].key}`}
                    d={path}
                    fill="none"
                    stroke={DIMENSIONS[i].color}
                    strokeWidth={3}
                    filter="url(#trajectory-glow)"
                    opacity={0.3}
                  />
                ))}

                {/* Lines */}
                {linePaths.map((path, i) => (
                  <path
                    key={DIMENSIONS[i].key}
                    d={path}
                    fill="none"
                    stroke={DIMENSIONS[i].color}
                    strokeWidth={1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                ))}

                {hoveredIndex !== null && (
                  <line
                    x1={xScale(snapshots[hoveredIndex].epoch) ?? 0}
                    x2={xScale(snapshots[hoveredIndex].epoch) ?? 0}
                    y1={0}
                    y2={innerHeight}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="3 3"
                    className="text-muted-foreground"
                  />
                )}

                <rect
                  x={0}
                  y={0}
                  width={innerWidth}
                  height={innerHeight}
                  fill="transparent"
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
                left: margin.left + (xScale(hovered.epoch) ?? 0),
                top: margin.top,
                transform: `translateX(${(xScale(hovered.epoch) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'})`,
              }}
            >
              <div className="rounded-lg border bg-card p-3 shadow-xl text-sm max-w-[220px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium text-card-foreground mb-1">Epoch {hovered.epoch}</p>
                {DIMENSIONS.map(({ key, label, color }) => {
                  const val = hovered[key];
                  if (val == null) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        {label}
                      </span>
                      <span className="font-mono tabular-nums">{Math.round(val)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
          {DIMENSIONS.map(({ key, label, color }) => (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
              {label}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
