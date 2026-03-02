'use client';

import { useEffect, useState, useMemo, useCallback, type MouseEvent } from 'react';
import { scaleLinear } from 'd3-scale';
import { area as d3area, line as d3line, curveMonotoneX } from 'd3-shape';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { useChartDimensions } from '@/lib/charts/useChartDimensions';
import { GlowFilter, AreaGradient } from '@/lib/charts/GlowDefs';
import { chartTheme } from '@/lib/charts/theme';
import { formatAda } from '@/lib/treasury';

interface HistoryData {
  snapshots: Array<{ epoch: number; balanceAda: number; withdrawalsAda: number; reservesIncomeAda: number }>;
  incomeVsOutflow: Array<{ epoch: number; incomeAda: number; outflowAda: number; netAda: number }>;
}

function BalanceChart({ data }: { data: HistoryData['snapshots'] }) {
  const { containerRef, dimensions } = useChartDimensions(280);
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const xScale = useMemo(
    () => scaleLinear().domain([data[0].epoch, data[data.length - 1].epoch]).range([0, innerWidth]),
    [data, innerWidth],
  );

  const yMax = useMemo(() => Math.max(...data.map((d) => d.balanceAda)), [data]);
  const yScale = useMemo(
    () => scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]),
    [yMax, innerHeight],
  );

  const linePath = useMemo(() => {
    const gen = d3line<(typeof data)[0]>()
      .x((d) => xScale(d.epoch))
      .y((d) => yScale(d.balanceAda))
      .curve(curveMonotoneX);
    return gen(data) ?? '';
  }, [data, xScale, yScale]);

  const areaPath = useMemo(() => {
    const gen = d3area<(typeof data)[0]>()
      .x((d) => xScale(d.epoch))
      .y0(innerHeight)
      .y1((d) => yScale(d.balanceAda))
      .curve(curveMonotoneX);
    return gen(data) ?? '';
  }, [data, xScale, yScale, innerHeight]);

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const epoch = xScale.invert(relX);
      const idx = data.reduce((best, d, i) => (Math.abs(d.epoch - epoch) < Math.abs(data[best].epoch - epoch) ? i : best), 0);
      setHoveredIndex(idx);
    },
    [data, xScale, margin.left],
  );

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const ticks = yScale.ticks(5);
  const xTicks = xScale.ticks(6).map(Math.round);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
      {width > 0 && (
        <svg width={width} height={280}>
          <defs>
            <GlowFilter id="balance-glow" stdDeviation={3} />
            <AreaGradient id="balance-fill" color="oklch(0.72 0.14 200)" topOpacity={0.2} />
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
            <path d={areaPath} fill="url(#balance-fill)" />
            <path d={linePath} fill="none" stroke="oklch(0.72 0.14 200)" strokeWidth={2.5} filter="url(#balance-glow)" opacity={0.5} />
            <path d={linePath} fill="none" stroke="oklch(0.72 0.14 200)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {hoveredIndex !== null && (
              <line x1={xScale(data[hoveredIndex].epoch)} x2={xScale(data[hoveredIndex].epoch)} y1={0} y2={innerHeight} stroke="currentColor" strokeWidth={0.5} strokeDasharray="3 3" className="text-muted-foreground" />
            )}
            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIndex(null)} />
          </g>
        </svg>
      )}
      {hovered && width > 0 && (
        <div className="absolute z-50 pointer-events-none" style={{ left: margin.left + xScale(hovered.epoch), top: 40, transform: `translate(${xScale(hovered.epoch) > innerWidth * 0.7 ? '-110%' : '10%'}, 0)` }}>
          <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
            <p className="font-medium mb-0.5">Epoch {hovered.epoch}</p>
            <p className="font-mono tabular-nums">{formatAda(hovered.balanceAda)} ADA</p>
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeOutflowChart({ data }: { data: HistoryData['incomeVsOutflow'] }) {
  const { containerRef, dimensions } = useChartDimensions(280);
  const { width, innerWidth, innerHeight, margin } = dimensions;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const xScale = useMemo(
    () => scaleLinear().domain([data[0].epoch, data[data.length - 1].epoch]).range([0, innerWidth]),
    [data, innerWidth],
  );

  const yExtent = useMemo(() => {
    const vals = data.flatMap((d) => [d.incomeAda, -d.outflowAda]);
    return [Math.min(0, ...vals), Math.max(0, ...vals)];
  }, [data]);

  const yScale = useMemo(
    () => scaleLinear().domain([yExtent[0] * 1.1, yExtent[1] * 1.1]).range([innerHeight, 0]),
    [yExtent, innerHeight],
  );

  const barWidth = Math.max(2, innerWidth / data.length - 2);

  const handleMouseMove = useCallback(
    (e: MouseEvent<SVGRectElement>) => {
      const svg = e.currentTarget.closest('svg');
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const relX = e.clientX - rect.left - margin.left;
      const epoch = xScale.invert(relX);
      const idx = data.reduce((best, d, i) => (Math.abs(d.epoch - epoch) < Math.abs(data[best].epoch - epoch) ? i : best), 0);
      setHoveredIndex(idx);
    },
    [data, xScale, margin.left],
  );

  const hovered = hoveredIndex !== null ? data[hoveredIndex] : null;
  const ticks = yScale.ticks(5);
  const xTicks = xScale.ticks(6).map(Math.round);

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 280 }}>
      {width > 0 && (
        <svg width={width} height={280}>
          <g transform={`translate(${margin.left},${margin.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerWidth} y1={yScale(t)} y2={yScale(t)} stroke="currentColor" strokeWidth={t === 0 ? 1 : 0.5} strokeDasharray={t === 0 ? 'none' : '4 4'} className="text-border" />
                <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="central" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{formatAda(t)}</text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={xScale(t)} y={innerHeight + 18} textAnchor="middle" fontSize={chartTheme.font.size.tick} className="fill-muted-foreground">{t}</text>
            ))}

            {data.map((d, i) => {
              const x = xScale(d.epoch) - barWidth / 2;
              const incomeH = Math.abs(yScale(0) - yScale(d.incomeAda));
              const outflowH = Math.abs(yScale(0) - yScale(-d.outflowAda));
              return (
                <g key={d.epoch}>
                  <rect x={x - barWidth * 0.1} y={yScale(d.incomeAda)} width={barWidth * 0.45} height={incomeH} fill="hsl(142, 71%, 45%)" rx={2} opacity={hoveredIndex === i ? 1 : 0.8} />
                  <rect x={x + barWidth * 0.55} y={yScale(0)} width={barWidth * 0.45} height={outflowH} fill="hsl(0, 84%, 60%)" rx={2} opacity={hoveredIndex === i ? 1 : 0.8} />
                </g>
              );
            })}

            <rect x={0} y={0} width={innerWidth} height={innerHeight} fill="transparent" onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIndex(null)} />
          </g>
        </svg>
      )}
      {hovered && width > 0 && (
        <div className="absolute z-50 pointer-events-none" style={{ left: margin.left + xScale(hovered.epoch), top: 40, transform: `translate(${xScale(hovered.epoch) > innerWidth * 0.7 ? '-110%' : '10%'}, 0)` }}>
          <div className="rounded-lg border bg-card p-2.5 shadow-xl text-xs backdrop-blur-sm dark:border-border/60 dark:bg-card/95">
            <p className="font-medium mb-1">Epoch {hovered.epoch}</p>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-500" /> Income: {formatAda(hovered.incomeAda)} ADA</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Outflow: {formatAda(hovered.outflowAda)} ADA</div>
            <div className="pt-1 mt-1 border-t border-border font-medium">Net: {formatAda(hovered.netAda)} ADA</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TreasuryCharts() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<30 | 90 | 500>(90);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/treasury/history?epochs=${range}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading) return <Skeleton className="h-80 w-full" />;
  if (!data || !data.snapshots.length) return null;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {([30, 90, 500] as const).map(r => (
          <Button
            key={r}
            variant={range === r ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setRange(r); posthog.capture('treasury_chart_range_changed', { range: r }); }}
          >
            {r === 500 ? 'All Time' : `${r} Epochs`}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Treasury Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BalanceChart data={data.snapshots} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Income vs Outflow Per Epoch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IncomeOutflowChart data={data.incomeVsOutflow} />
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-2.5 rounded-sm bg-green-500" /> Income (reserves + fees)
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-2.5 rounded-sm bg-red-500" /> Outflow (withdrawals)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
