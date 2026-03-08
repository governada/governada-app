'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, stack, stackOrderNone, stackOffsetNone, type Series } from 'd3-shape';
import { useChartDimensions, AreaGradient } from '@/lib/charts';
import { cn } from '@/lib/utils';

interface VotePoint {
  epoch: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
}

interface VoteAdoptionCurveProps {
  votes: VotePoint[];
  className?: string;
}

const COLORS = {
  yes: '#34d399',
  no: '#f87171',
  abstain: '#94a3b8',
} as const;

const LEGEND_ITEMS = [
  { key: 'yes', label: 'Yes', color: COLORS.yes },
  { key: 'no', label: 'No', color: COLORS.no },
  { key: 'abstain', label: 'Abstain', color: COLORS.abstain },
] as const;

const STACK_KEYS = ['yes', 'no', 'abstain'] as const;

type StackDatum = { epoch: number; yes: number; no: number; abstain: number };

export function VoteAdoptionCurve({ votes, className }: VoteAdoptionCurveProps) {
  const { containerRef, dimensions } = useChartDimensions(220, {
    top: 28,
    right: 110,
    bottom: 32,
    left: 48,
  });

  const sorted = useMemo(() => [...votes].sort((a, b) => a.epoch - b.epoch), [votes]);

  // Build cumulative stack data
  const stackData: StackDatum[] = useMemo(() => {
    const result: StackDatum[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const prev = result[i - 1];
      result.push({
        epoch: sorted[i].epoch,
        yes: (prev?.yes ?? 0) + sorted[i].yesCount,
        no: (prev?.no ?? 0) + sorted[i].noCount,
        abstain: (prev?.abstain ?? 0) + sorted[i].abstainCount,
      });
    }
    return result;
  }, [sorted]);

  const { innerWidth, innerHeight, margin } = dimensions;

  // Compute scales
  const xScale = useMemo(() => {
    if (stackData.length === 0) return scaleLinear().domain([0, 1]).range([0, innerWidth]);
    const epochs = stackData.map((d) => d.epoch);
    return scaleLinear()
      .domain([Math.min(...epochs), Math.max(...epochs)])
      .range([0, innerWidth]);
  }, [stackData, innerWidth]);

  const yMax = useMemo(() => {
    if (stackData.length === 0) return 1;
    return Math.max(1, ...stackData.map((d) => d.yes + d.no + d.abstain));
  }, [stackData]);

  const yScale = useMemo(
    () => scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice(),
    [yMax, innerHeight],
  );

  // d3 stack
  const stackedSeries: Series<StackDatum, string>[] = useMemo(() => {
    const stacker = stack<StackDatum>()
      .keys([...STACK_KEYS])
      .order(stackOrderNone)
      .offset(stackOffsetNone);
    return stacker(stackData);
  }, [stackData]);

  // Area generator
  const areaGen = useMemo(
    () =>
      area<{ data: StackDatum; 0: number; 1: number }>()
        .x((d) => xScale(d.data.epoch))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1])),
    [xScale, yScale],
  );

  // Axis ticks
  const xTicks = useMemo(() => {
    if (stackData.length <= 1) return stackData.map((d) => d.epoch);
    const domain = xScale.domain();
    const count = Math.min(6, stackData.length);
    return xScale.ticks(count).filter((t) => t >= domain[0] && t <= domain[1]);
  }, [xScale, stackData]);

  const yTicks = useMemo(() => yScale.ticks(5), [yScale]);

  const isSingleEpoch = stackData.length === 1;

  // Single-epoch bar rendering
  const singleBar = useMemo(() => {
    if (!isSingleEpoch || stackData.length === 0) return null;
    const d = stackData[0];
    const total = d.yes + d.no + d.abstain;
    if (total === 0) return null;

    const barWidth = Math.min(60, innerWidth * 0.4);
    const cx = innerWidth / 2;
    const x = cx - barWidth / 2;

    // Build segments bottom-up: abstain, no, yes
    const segments: {
      key: string;
      color: string;
      gradientId: string;
      y: number;
      height: number;
    }[] = [];
    let currentY = innerHeight;

    for (const { key, color } of [
      { key: 'abstain', color: COLORS.abstain },
      { key: 'no', color: COLORS.no },
      { key: 'yes', color: COLORS.yes },
    ]) {
      const val = d[key as keyof typeof d] as number;
      if (val <= 0) continue;
      const h = (val / yMax) * innerHeight;
      currentY -= h;
      segments.push({
        key,
        color,
        gradientId: `vote-area-grad-${key}`,
        y: currentY,
        height: h,
      });
    }

    return { x, barWidth, segments };
  }, [isSingleEpoch, stackData, innerWidth, innerHeight, yMax]);

  if (dimensions.width === 0) {
    return <div ref={containerRef} className={cn('w-full', className)} style={{ height: 220 }} />;
  }

  return (
    <div
      ref={containerRef}
      className={cn('w-full', className)}
      role="img"
      aria-label="Vote adoption over time"
    >
      <svg width={dimensions.width} height={220} className="overflow-visible" aria-hidden="true">
        <defs>
          <AreaGradient
            id="vote-area-grad-yes"
            color={COLORS.yes}
            topOpacity={0.4}
            bottomOpacity={0.05}
          />
          <AreaGradient
            id="vote-area-grad-no"
            color={COLORS.no}
            topOpacity={0.4}
            bottomOpacity={0.05}
          />
          <AreaGradient
            id="vote-area-grad-abstain"
            color={COLORS.abstain}
            topOpacity={0.3}
            bottomOpacity={0.05}
          />
        </defs>

        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Grid lines */}
          {yTicks.map((tick) => (
            <line
              key={`grid-${tick}`}
              x1={0}
              y1={yScale(tick)}
              x2={innerWidth}
              y2={yScale(tick)}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-border"
              opacity={0.25}
            />
          ))}

          {/* Stacked areas or single-epoch bar */}
          {isSingleEpoch && singleBar
            ? singleBar.segments.map((seg) => (
                <rect
                  key={seg.key}
                  x={singleBar.x}
                  y={seg.y}
                  width={singleBar.barWidth}
                  height={seg.height}
                  fill={`url(#${seg.gradientId})`}
                  stroke={seg.color}
                  strokeWidth={1.5}
                  rx={3}
                />
              ))
            : stackedSeries.map((series) => {
                const key = series.key as (typeof STACK_KEYS)[number];
                const colorMap: Record<string, string> = {
                  yes: COLORS.yes,
                  no: COLORS.no,
                  abstain: COLORS.abstain,
                };
                const color = colorMap[key];
                const path = areaGen(
                  series as unknown as Array<{ data: StackDatum; 0: number; 1: number }>,
                );
                if (!path) return null;
                return (
                  <g key={key}>
                    <path
                      d={path}
                      fill={`url(#vote-area-grad-${key})`}
                      className="transition-opacity duration-200"
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      strokeLinejoin="round"
                      opacity={0.8}
                    />
                  </g>
                );
              })}

          {/* X axis */}
          <line
            x1={0}
            y1={innerHeight}
            x2={innerWidth}
            y2={innerHeight}
            stroke="currentColor"
            strokeWidth={0.5}
            className="text-border"
            opacity={0.4}
          />

          {/* X axis ticks */}
          {xTicks.map((tick) => (
            <text
              key={`x-${tick}`}
              x={xScale(tick)}
              y={innerHeight + 16}
              textAnchor="middle"
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={11}
              fontFamily="var(--font-geist-mono)"
            >
              {Number.isInteger(tick) ? tick : tick.toFixed(0)}
            </text>
          ))}

          {/* X axis label */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 28}
            textAnchor="middle"
            fill="currentColor"
            className="text-muted-foreground"
            fontSize={10}
            fontFamily="var(--font-geist-sans)"
          >
            Epoch
          </text>

          {/* Y axis ticks */}
          {yTicks.map((tick) => (
            <text
              key={`y-${tick}`}
              x={-8}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="central"
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={11}
              fontFamily="var(--font-geist-mono)"
            >
              {tick}
            </text>
          ))}

          {/* Legend — top right */}
          <g transform={`translate(${innerWidth + 14}, 0)`}>
            {LEGEND_ITEMS.map((item, i) => (
              <g key={item.key} transform={`translate(0, ${i * 18})`}>
                <circle cx={6} cy={6} r={4} fill={item.color} opacity={0.9} />
                <text
                  x={16}
                  y={6}
                  dominantBaseline="central"
                  fill="currentColor"
                  className="text-muted-foreground"
                  fontSize={11}
                  fontFamily="var(--font-geist-sans)"
                  fontWeight={500}
                >
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        </g>
      </svg>
    </div>
  );
}
