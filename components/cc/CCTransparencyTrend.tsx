'use client';

import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import type { CCFidelitySnapshot, CCProposalFidelitySnapshot } from '@/lib/data';

const PILLAR_KEYS = ['Participation', 'Grounding', 'Reasoning'] as const;
const PILLAR_COLORS = [
  'oklch(0.68 0.16 160)', // green
  'oklch(0.60 0.18 290)', // purple
  'oklch(0.75 0.14 80)', // amber
];

interface CCTransparencyTrendProps {
  history: CCFidelitySnapshot[];
  /** Proposal-anchored snapshots — used instead of epoch-based when available */
  proposalSnapshots?: CCProposalFidelitySnapshot[];
}

export function CCTransparencyTrend({ history, proposalSnapshots }: CCTransparencyTrendProps) {
  const [showPillars, setShowPillars] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(250);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  // Prefer proposal-anchored snapshots when available (event-driven scoring)
  const useProposalMode = (proposalSnapshots?.length ?? 0) >= 2;

  const chartData = useMemo(() => {
    if (useProposalMode && proposalSnapshots) {
      return proposalSnapshots.map((s, i) => ({
        label: `P${i + 1}`,
        epochNo: s.proposalEpoch,
        Index: s.fidelityScore,
        Participation: s.participationScore,
        Grounding: s.constitutionalGroundingScore,
        Reasoning: s.reasoningQualityScore,
      }));
    }
    return history.map((s) => ({
      label: `E${s.epochNo}`,
      epochNo: s.epochNo,
      Index: s.fidelityScore,
      Participation: s.participationScore,
      Grounding: s.constitutionalGroundingScore,
      Reasoning: s.reasoningQualityScore,
    }));
  }, [history, proposalSnapshots, useProposalMode]);

  const xScale = useMemo(
    () =>
      scalePoint<string>()
        .domain(chartData.map((d) => d.label))
        .range([0, innerWidth])
        .padding(0.1),
    [chartData, innerWidth],
  );

  const yScale = useMemo(
    () => scaleLinear().domain([0, 100]).range([innerHeight, 0]),
    [innerHeight],
  );

  const linePath = useMemo(() => {
    const gen = line<(typeof chartData)[0]>()
      .x((d) => xScale(d.label) ?? 0)
      .y((d) => yScale(d.Index))
      .curve(curveMonotoneX);
    return gen(chartData) ?? '';
  }, [chartData, xScale, yScale]);

  const areaPath = useMemo(() => {
    if (!linePath || chartData.length < 2) return '';
    const firstX = xScale(chartData[0].label) ?? 0;
    const lastX = xScale(chartData[chartData.length - 1].label) ?? 0;
    return `${linePath} L ${lastX},${innerHeight} L ${firstX},${innerHeight} Z`;
  }, [linePath, chartData, xScale, innerHeight]);

  const pillarPaths = useMemo(() => {
    if (!showPillars) return [];
    return PILLAR_KEYS.map((key) => {
      const gen = line<(typeof chartData)[0]>()
        .x((d) => xScale(d.label) ?? 0)
        .y((d) => yScale(d[key]))
        .curve(curveMonotoneX);
      return gen(chartData) ?? '';
    });
  }, [showPillars, chartData, xScale, yScale]);

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

  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Constitutional Fidelity Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Fidelity tracking started recently. Check back after the next epoch to see how this
            member&apos;s score changes over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 1) {
    const s = history[0];
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Constitutional Fidelity Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-3xl font-bold tabular-nums">{s.fidelityScore}</p>
            <p className="text-sm text-muted-foreground mt-1">
              First snapshot at epoch {s.epochNo}. Trend data will appear as more epochs pass.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const change = latest.fidelityScore - first.fidelityScore;
  const hovered = hoveredIndex !== null ? chartData[hoveredIndex] : null;
  const ticks = yScale.ticks(5);
  const xTicks =
    chartData.length <= 10
      ? chartData
      : chartData.filter((_, i) => i % Math.ceil(chartData.length / 8) === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Constitutional Fidelity Trend
          </CardTitle>
          <div className="flex items-center gap-3">
            {history.length > 1 && (
              <span
                className={`text-sm font-medium ${change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
              >
                {change > 0 ? '+' : ''}
                {change} pts since epoch {first.epochNo}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPillars(!showPillars)}
              className="text-xs"
            >
              {showPillars ? 'Hide Pillars' : 'Show Pillars'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="w-full relative" style={{ height: 250 }}>
          {width > 0 && (
            <svg width={width} height={250}>
              <defs>
                <GlowFilter id="ti-glow" stdDeviation={3} />
                <linearGradient id="ti-area-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.14 200)" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="oklch(0.72 0.14 200)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {/* Grid lines */}
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

                {/* Y-axis labels */}
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

                {/* X-axis labels */}
                {xTicks.map((d) => (
                  <text
                    key={d.label}
                    x={xScale(d.label) ?? 0}
                    y={innerHeight + 18}
                    textAnchor="middle"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                  >
                    {d.label}
                  </text>
                ))}

                {/* Area gradient fill */}
                {areaPath && <path d={areaPath} fill="url(#ti-area-gradient)" />}

                {/* Score line glow */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="oklch(0.72 0.14 200)"
                  strokeWidth={3}
                  filter="url(#ti-glow)"
                  opacity={0.5}
                />

                {/* Score line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="oklch(0.72 0.14 200)"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Dots */}
                {chartData.map((d, i) => (
                  <circle
                    key={i}
                    cx={xScale(d.label) ?? 0}
                    cy={yScale(d.Index)}
                    r={hoveredIndex === i ? 5 : 3}
                    fill="oklch(0.72 0.14 200)"
                    stroke="oklch(0.07 0.015 260)"
                    strokeWidth={1.5}
                  />
                ))}

                {/* Pillar lines */}
                {showPillars &&
                  pillarPaths.map((path, i) => (
                    <path
                      key={PILLAR_KEYS[i]}
                      d={path}
                      fill="none"
                      stroke={PILLAR_COLORS[i]}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      opacity={0.7}
                    />
                  ))}

                {/* Hover crosshair */}
                {hoveredIndex !== null && (
                  <line
                    x1={xScale(chartData[hoveredIndex].label) ?? 0}
                    x2={xScale(chartData[hoveredIndex].label) ?? 0}
                    y1={0}
                    y2={innerHeight}
                    stroke="currentColor"
                    strokeWidth={0.5}
                    strokeDasharray="3 3"
                    className="text-muted-foreground"
                  />
                )}

                {/* Invisible hover rect */}
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

          {/* Tooltip */}
          {hovered && hoveredIndex !== null && width > 0 && (
            <div
              className="absolute z-50 pointer-events-none"
              style={{
                left: margin.left + (xScale(hovered.label) ?? 0),
                top: margin.top + yScale(hovered.Index) - 10,
                transform: `translate(${(xScale(hovered.label) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'}, -50%)`,
              }}
            >
              <div className="rounded-lg border bg-card p-3 shadow-xl text-sm max-w-[260px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium text-card-foreground mb-1">Epoch {hovered.epochNo}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'oklch(0.72 0.14 200)' }}
                    />
                    Index
                  </span>
                  <span className="font-mono tabular-nums">{hovered.Index}</span>
                </div>
                {showPillars &&
                  PILLAR_KEYS.map((key, i) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: PILLAR_COLORS[i] }}
                        />
                        {key}
                      </span>
                      <span className="font-mono tabular-nums">{hovered[key]}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Pillar legend */}
        {showPillars && (
          <div className="flex gap-4 mt-2 justify-center flex-wrap">
            {PILLAR_KEYS.map((key, i) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-0.5 rounded" style={{ backgroundColor: PILLAR_COLORS[i] }} />
                {key}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
