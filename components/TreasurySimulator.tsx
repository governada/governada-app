'use client';

import { useEffect, useState, useCallback, useMemo, type MouseEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sliders, Share2, Undo2, History } from 'lucide-react';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter } from '@/lib/charts/GlowDefs';
import { chartTheme, SCENARIO_CHART_COLORS } from '@/lib/charts/theme';
import { posthog } from '@/lib/posthog';
import { formatAda } from '@/lib/treasury';

interface SimulationData {
  currentBalance: number;
  currentEpoch: number;
  burnRatePerEpoch: number;
  avgIncomePerEpoch: number;
  pendingTotalAda: number;
  scenarios: Array<{
    name: string;
    key: string;
    projectedMonths: number;
    depletionEpoch: number | null;
    balanceCurve: Array<{ epoch: number; balanceAda: number }>;
  }>;
  counterfactual: {
    totalWithdrawnAda: number;
    largestWithdrawals: Array<{ title: string; amountAda: number; epoch: number }>;
    hypotheticalBalanceAda: number;
    additionalRunwayMonths: number;
  };
}

interface Props {
  currentBalance: number;
  burnRate: number;
  currentEpoch: number;
}

export function TreasurySimulator({ currentBalance, burnRate, currentEpoch }: Props) {
  const [data, setData] = useState<SimulationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [burnAdjust, setBurnAdjust] = useState(1);

  const fetchSimulation = useCallback((adjust: number) => {
    setLoading(true);
    fetch(`/api/treasury/simulate?burnAdjust=${adjust}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSimulation(1); }, [fetchSimulation]);

  const handleBurnChange = (value: number) => {
    setBurnAdjust(value);
    fetchSimulation(value);
    posthog.capture('treasury_simulator_used', { burnAdjust: value });
  };

  const handleShare = () => {
    const text = data?.scenarios
      ? `Cardano Treasury Scenarios:\n${data.scenarios.map(s => `• ${s.name}: ${s.projectedMonths >= 999 ? '∞' : s.projectedMonths + ' months'}`).join('\n')}\n\nExplore at ${window.location.href}`
      : '';
    navigator.clipboard.writeText(text);
    posthog.capture('treasury_scenario_shared');
  };

  if (loading && !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" /> Scenario Controls
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleBurnChange(1)}>
                <Undo2 className="h-3.5 w-3.5 mr-1" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5 mr-1" /> Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Spending rate adjustment</span>
              <span className="font-mono tabular-nums">{Math.round(burnAdjust * 100)}%</span>
            </div>
            <input type="range" min={0} max={3} step={0.05} value={burnAdjust}
              onChange={e => handleBurnChange(parseFloat(e.target.value))} className="w-full accent-primary" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Freeze</span><span>Current</span><span>3x</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[{ label: 'Current', value: 1 }, { label: '+25%', value: 1.25 }, { label: '+50%', value: 1.5 }, { label: '2x', value: 2 }, { label: 'Freeze', value: 0 }].map(preset => (
              <Button key={preset.label} variant={burnAdjust === preset.value ? 'default' : 'outline'} size="sm" onClick={() => handleBurnChange(preset.value)}>
                {preset.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {data?.scenarios && <ProjectionChart scenarios={data.scenarios} />}

      {data?.counterfactual && data.counterfactual.totalWithdrawnAda > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Counterfactual Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">What if the largest treasury withdrawals had been rejected?</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Total Withdrawn</div>
                <div className="text-lg font-bold">{formatAda(data.counterfactual.totalWithdrawnAda)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Hypothetical Balance</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatAda(data.counterfactual.hypotheticalBalanceAda)}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <div className="text-xs text-muted-foreground">Additional Runway</div>
                <div className="text-lg font-bold">+{data.counterfactual.additionalRunwayMonths}mo</div>
              </div>
            </div>
            {data.counterfactual.largestWithdrawals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-muted-foreground">Largest Withdrawals</div>
                {data.counterfactual.largestWithdrawals.map((w, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="truncate flex-1">{w.title}</span>
                    <span className="font-mono tabular-nums ml-4">{formatAda(w.amountAda)} ADA</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProjectionChart({ scenarios }: { scenarios: SimulationData['scenarios'] }) {
  const { containerRef, dimensions } = useChartDimensions(350);
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const [hoveredEpoch, setHoveredEpoch] = useState<number | null>(null);

  const allPoints = useMemo(() => scenarios.flatMap((s) => s.balanceCurve), [scenarios]);
  const epochExtent = useMemo(() => {
    const epochs = allPoints.map((p) => p.epoch);
    return [Math.min(...epochs), Math.max(...epochs)];
  }, [allPoints]);
  const balanceMax = useMemo(() => Math.max(...allPoints.map((p) => p.balanceAda), 1), [allPoints]);

  const xScale = useMemo(() => scaleLinear().domain(epochExtent).range([0, innerWidth]), [epochExtent, innerWidth]);
  const yScale = useMemo(() => scaleLinear().domain([0, balanceMax * 1.05]).range([innerHeight, 0]), [balanceMax, innerHeight]);

  const paths = useMemo(
    () =>
      scenarios.map((s) => {
        const gen = d3line<{ epoch: number; balanceAda: number }>()
          .x((d) => xScale(d.epoch))
          .y((d) => yScale(d.balanceAda))
          .curve(curveMonotoneX);
        return {
          key: s.key,
          name: s.name,
          d: gen(s.balanceCurve) ?? '',
          color: SCENARIO_CHART_COLORS[s.key] || 'oklch(0.55 0.03 260)',
          isMain: s.key === 'conservative',
          isDashed: s.key === 'freeze',
        };
      }),
    [scenarios, xScale, yScale],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      setHoveredEpoch(Math.round(xScale.invert(relX)));
    },
    [xScale, margin.left],
  );

  const ticks = yScale.ticks(5);
  const xTicks = xScale.ticks(6).map(Math.round);

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Runway Projections</CardTitle></CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative w-full" style={{ height: 350 }}>
          {width > 0 && (
            <svg width={width} height={350}>
              <defs>
                {paths.map((p) => (
                  <GlowFilter key={p.key} id={`sim-glow-${p.key}`} stdDeviation={2} />
                ))}
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={0.5} strokeDasharray="4 4" className="text-border" />
                    <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{formatAda(t)}</text>
                  </g>
                ))}
                {xTicks.map((t) => (
                  <text key={t} x={xScale(t)} y={innerHeight + 18} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{t}</text>
                ))}

                {paths.map((p) => (
                  <g key={p.key}>
                    <path d={p.d} fill="none" stroke={p.color} strokeWidth={p.isMain ? 2.5 : 1.5} filter={`url(#sim-glow-${p.key})`} opacity={0.3} />
                    <path d={p.d} fill="none" stroke={p.color} strokeWidth={p.isMain ? 2.5 : 1.5} strokeDasharray={p.isDashed ? '5 5' : 'none'} strokeLinecap="round" />
                  </g>
                ))}

                {hoveredEpoch !== null && (
                  <line x1={xScale(hoveredEpoch)} x2={xScale(hoveredEpoch)} y1={0} y2={innerHeight} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" className="text-muted-foreground" />
                )}
                <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredEpoch(null)} />
              </g>
            </svg>
          )}

          {hoveredEpoch !== null && width > 0 && (
            <div className="absolute z-50 pointer-events-none" style={{ left: margin.left + xScale(hoveredEpoch), top: 40, transform: `translate(${xScale(hoveredEpoch) > innerWidth * 0.7 ? '-110%' : '10%'}, 0)` }}>
              <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
                <p className="font-medium mb-1">Epoch {hoveredEpoch}</p>
                {scenarios.map((s) => {
                  const closest = s.balanceCurve.reduce((best, p) => (Math.abs(p.epoch - hoveredEpoch) < Math.abs(best.epoch - hoveredEpoch) ? p : best), s.balanceCurve[0]);
                  if (!closest || Math.abs(closest.epoch - hoveredEpoch) > 5) return null;
                  return (
                    <div key={s.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SCENARIO_CHART_COLORS[s.key] || '#888' }} />
                        {s.name}
                      </span>
                      <span className="font-mono tabular-nums">{formatAda(closest.balanceAda)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {scenarios.map(s => (
            <div key={s.key} className="text-center p-3 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground">{s.name}</div>
              <div className="text-lg font-bold tabular-nums">
                {s.projectedMonths >= 999 ? '∞' : `${s.projectedMonths}mo`}
              </div>
              {s.depletionEpoch && (
                <div className="text-[10px] text-muted-foreground">Depletion: Epoch {s.depletionEpoch}</div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-3 justify-center flex-wrap">
          {paths.map((p) => (
            <div key={p.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-0.5 rounded" style={{ backgroundColor: p.color, borderStyle: p.isDashed ? 'dashed' : 'solid' }} />
              {p.name}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
