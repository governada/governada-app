'use client';

import { useState, useMemo, useCallback, type MouseEvent } from 'react';
import { scaleLinear, scalePoint } from 'd3-scale';
import { line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import type { ScoreSnapshot } from '@/lib/data';
import { getScoreAttribution, type DayAttribution } from '@/utils/attribution';

interface ScoreHistoryChartProps {
  history: ScoreSnapshot[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const PILLAR_KEYS = ['Participation', 'Rationale', 'Reliability', 'Profile'] as const;
const PILLAR_COLORS = [
  'oklch(0.68 0.16 160)',
  'oklch(0.60 0.18 290)',
  'oklch(0.75 0.14 80)',
  'oklch(0.60 0.20 25)',
];

export function ScoreHistoryChart({ history }: ScoreHistoryChartProps) {
  const [showPillars, setShowPillars] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const { containerRef, dimensions } = useChartDimensions(250);
  const { width, innerWidth, innerHeight, margin } = dimensions;

  const attributions = useMemo(() => getScoreAttribution(history), [history]);
  const attributionMap = useMemo(() => {
    const map = new Map<string, DayAttribution>();
    for (const a of attributions) map.set(a.date, a);
    return map;
  }, [attributions]);

  const chartData = useMemo(
    () =>
      history.map((s) => ({
        date: formatDate(s.date),
        rawDate: s.date,
        Score: s.score,
        Participation: s.effectiveParticipation,
        Rationale: s.rationaleRate,
        Reliability: s.reliabilityScore,
        Profile: s.profileCompleteness,
      })),
    [history],
  );

  const xScale = useMemo(
    () =>
      scalePoint<string>()
        .domain(chartData.map((d) => d.date))
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
      .x((d) => xScale(d.date) ?? 0)
      .y((d) => yScale(d.Score))
      .curve(curveMonotoneX);
    return gen(chartData) ?? '';
  }, [chartData, xScale, yScale]);

  const pillarPaths = useMemo(() => {
    if (!showPillars) return [];
    return PILLAR_KEYS.map((key) => {
      const gen = line<(typeof chartData)[0]>()
        .x((d) => xScale(d.date) ?? 0)
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
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Score tracking started recently. Check back soon to see how this DRep&apos;s score
            changes over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const scoreChange = latest.score - first.score;

  if (history.length === 1) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <p className="text-3xl font-bold tabular-nums">{latest.score}</p>
            <p className="text-sm text-muted-foreground mt-1">
              First snapshot recorded {formatDate(latest.date)}. Trend data will appear as more
              snapshots are collected.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hovered = hoveredIndex !== null ? chartData[hoveredIndex] : null;
  const hoveredAttr = hovered ? attributionMap.get(hovered.rawDate) : undefined;
  const ticks = yScale.ticks(5);
  const xTicks =
    chartData.length <= 10
      ? chartData
      : chartData.filter((_, i) => i % Math.ceil(chartData.length / 8) === 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Score History
          </CardTitle>
          <div className="flex items-center gap-3">
            {history.length > 1 && (
              <span
                className={`text-sm font-medium ${scoreChange > 0 ? 'text-green-600 dark:text-green-400' : scoreChange < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}
              >
                {scoreChange > 0 ? '+' : ''}
                {scoreChange} pts since tracking started
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
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: 250 }}
          role="img"
          aria-label="Score history over time"
        >
          {width > 0 && (
            <svg width={width} height={250} aria-hidden="true">
              <defs>
                <GlowFilter id="score-glow" stdDeviation={3} />
                <AreaGradient
                  id="score-area-grad"
                  color="oklch(0.72 0.14 200)"
                  topOpacity={0.15}
                  bottomOpacity={0}
                />
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
                    key={d.date}
                    x={xScale(d.date) ?? 0}
                    y={innerHeight + 18}
                    textAnchor="middle"
                    fontSize={chartTheme.font.size.tick}
                    className="fill-muted-foreground"
                  >
                    {d.date}
                  </text>
                ))}

                {/* Score line glow layer */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="oklch(0.72 0.14 200)"
                  strokeWidth={3}
                  filter="url(#score-glow)"
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
                {chartData.map((d, i) => {
                  const attr = attributionMap.get(d.rawDate);
                  const isSignificant = attr?.isSignificant;
                  return (
                    <circle
                      key={i}
                      cx={xScale(d.date) ?? 0}
                      cy={yScale(d.Score)}
                      r={hoveredIndex === i ? 5 : isSignificant ? 6 : 3}
                      fill={
                        isSignificant
                          ? attr!.totalDelta > 0
                            ? '#22c55e'
                            : '#ef4444'
                          : 'oklch(0.72 0.14 200)'
                      }
                      fillOpacity={isSignificant ? 0.4 : 1}
                      stroke={isSignificant ? 'none' : 'oklch(0.07 0.015 260)'}
                      strokeWidth={1.5}
                    />
                  );
                })}

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
                    x1={xScale(chartData[hoveredIndex].date) ?? 0}
                    x2={xScale(chartData[hoveredIndex].date) ?? 0}
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
                left: margin.left + (xScale(hovered.date) ?? 0),
                top: margin.top + yScale(hovered.Score) - 10,
                transform: `translate(${(xScale(hovered.date) ?? 0) > innerWidth * 0.7 ? '-110%' : '10%'}, -50%)`,
              }}
            >
              <div className="rounded-lg border bg-card p-3 shadow-xl text-sm max-w-[280px] backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium text-card-foreground mb-1">{hovered.date}</p>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: 'oklch(0.72 0.14 200)' }}
                    />
                    Score
                  </span>
                  <span className="font-mono tabular-nums">{hovered.Score}</span>
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
                {hoveredAttr && hoveredAttr.totalDelta !== 0 && (
                  <div className="mt-2 pt-2 border-t border-border">
                    <p
                      className={`text-xs font-medium ${hoveredAttr.totalDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                    >
                      {hoveredAttr.totalDelta > 0 ? '+' : ''}
                      {hoveredAttr.totalDelta} pts from previous
                    </p>
                    {hoveredAttr.pillars
                      .filter((p) => Math.abs(p.weightedDelta) >= 0.5)
                      .sort((a, b) => Math.abs(b.weightedDelta) - Math.abs(a.weightedDelta))
                      .map((p) => (
                        <p key={p.key} className="text-xs text-muted-foreground">
                          {p.label}: {p.weightedDelta > 0 ? '+' : ''}
                          {p.weightedDelta.toFixed(1)} pts
                          <span className="opacity-60">
                            {' '}
                            ({p.prev}→{p.curr})
                          </span>
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Pillar legend */}
        {showPillars && (
          <div className="flex gap-4 mt-2 justify-center">
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
