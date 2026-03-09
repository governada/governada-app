'use client';

// Score distribution histogram for DRep scores
import { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { bin as d3bin, max as d3max } from 'd3-array';
import { cn } from '@/lib/utils';
import { useChartDimensions, chartTheme } from '@/lib/charts';

interface ScoreDistributionProps {
  scores: number[];
  highlightScore?: number;
  className?: string;
  onBinClick?: (rangeStart: number, rangeEnd: number) => void;
}

const NUM_BINS = 10;
const BAR_RADIUS = 4;
const X_LABELS = [0, 20, 40, 60, 80, 100];

/** Color for a bin based on its midpoint score. */
function getBinColor(midpoint: number): {
  fill: string;
  fillHover: string;
  gradient: [string, string];
} {
  if (midpoint < 40) {
    return {
      fill: 'rgba(244,63,94,0.65)', // rose-500
      fillHover: 'rgba(244,63,94,0.85)',
      gradient: ['rgba(251,113,133,0.8)', 'rgba(225,29,72,0.6)'], // rose-400 -> rose-600
    };
  }
  if (midpoint < 70) {
    return {
      fill: 'rgba(245,158,11,0.65)', // amber-500
      fillHover: 'rgba(245,158,11,0.85)',
      gradient: ['rgba(251,191,36,0.8)', 'rgba(217,119,6,0.6)'], // amber-400 -> amber-600
    };
  }
  return {
    fill: 'rgba(16,185,129,0.65)', // emerald-500
    fillHover: 'rgba(16,185,129,0.85)',
    gradient: ['rgba(52,211,153,0.8)', 'rgba(5,150,105,0.6)'], // emerald-400 -> emerald-600
  };
}

export function ScoreDistribution({
  scores,
  highlightScore,
  className,
  onBinClick,
}: ScoreDistributionProps) {
  const { containerRef, dimensions } = useChartDimensions(200, {
    top: 24,
    right: 16,
    bottom: 32,
    left: 16,
  });
  const [hoveredBin, setHoveredBin] = useState<number | null>(null);

  const { bins, xScale, yScale } = useMemo(() => {
    const binner = d3bin<number, number>()
      .domain([0, 100])
      .thresholds(Array.from({ length: NUM_BINS - 1 }, (_, i) => (i + 1) * (100 / NUM_BINS)));

    const computed = binner(scores);

    const xScale = scaleLinear().domain([0, 100]).range([0, dimensions.innerWidth]);
    const maxCount = d3max(computed, (d) => d.length) ?? 0;
    const yScale = scaleLinear().domain([0, maxCount]).nice().range([dimensions.innerHeight, 0]);

    return { bins: computed, xScale, yScale };
  }, [scores, dimensions.innerWidth, dimensions.innerHeight]);

  const { margin } = dimensions;

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: 200 }}
        role="img"
        aria-label="DRep score distribution chart"
      >
        {dimensions.width > 0 && (
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="select-none"
            aria-hidden="true"
          >
            <defs>
              {bins.map((b, i) => {
                const mid = ((b.x0 ?? 0) + (b.x1 ?? 0)) / 2;
                const colors = getBinColor(mid);
                return (
                  <linearGradient key={i} id={`dist-bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.gradient[0]} />
                    <stop offset="100%" stopColor={colors.gradient[1]} />
                  </linearGradient>
                );
              })}
            </defs>

            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Bars */}
              {bins.map((b, i) => {
                const x0 = xScale(b.x0 ?? 0);
                const x1 = xScale(b.x1 ?? 0);
                const barWidth = Math.max(0, x1 - x0 - 2); // 2px gap between bars
                const barHeight = dimensions.innerHeight - yScale(b.length);
                const barX = x0 + 1; // center with 1px offset for gap
                const barY = yScale(b.length);
                const isHovered = hoveredBin === i;
                const count = b.length;
                const pct = scores.length > 0 ? ((count / scores.length) * 100).toFixed(1) : '0.0';

                if (barHeight <= 0) return null;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredBin(i)}
                    onMouseLeave={() => setHoveredBin(null)}
                    onTouchStart={() => setHoveredBin(i)}
                    onTouchEnd={() => setHoveredBin(null)}
                    onClick={() => onBinClick?.(b.x0 ?? 0, b.x1 ?? 0)}
                    className={onBinClick ? 'cursor-pointer' : 'cursor-default'}
                  >
                    {/* Bar with rounded top */}
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={BAR_RADIUS}
                      ry={BAR_RADIUS}
                      fill={`url(#dist-bar-grad-${i})`}
                      opacity={isHovered ? 1 : 0.85}
                      className="transition-opacity duration-150"
                    />
                    {/* Fill bottom corners so only top is rounded */}
                    {barHeight > BAR_RADIUS && (
                      <rect
                        x={barX}
                        y={barY + barHeight - BAR_RADIUS}
                        width={barWidth}
                        height={BAR_RADIUS}
                        fill={`url(#dist-bar-grad-${i})`}
                        opacity={isHovered ? 1 : 0.85}
                        className="transition-opacity duration-150"
                      />
                    )}

                    {/* Count label above bar */}
                    <text
                      x={barX + barWidth / 2}
                      y={barY - 6}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-muted-foreground"
                      fontSize={chartTheme.font.size.tick}
                      fontFamily={chartTheme.font.mono}
                      opacity={isHovered ? 1 : 0.7}
                    >
                      {count}
                    </text>

                    {/* Hover tooltip overlay */}
                    {isHovered && (
                      <g>
                        {/* Tooltip background */}
                        <rect
                          x={barX + barWidth / 2 - 44}
                          y={barY - 42}
                          width={88}
                          height={28}
                          rx={6}
                          fill={chartTheme.colors.tooltipBg}
                          stroke={chartTheme.colors.tooltipBorder}
                          strokeWidth={1}
                        />
                        <text
                          x={barX + barWidth / 2}
                          y={barY - 30}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="white"
                          fontSize={chartTheme.font.size.tooltip}
                          fontFamily={chartTheme.font.family}
                        >
                          {count} DReps ({pct}%)
                        </text>
                      </g>
                    )}

                    {/* Invisible hit area for better hover */}
                    <rect
                      x={barX}
                      y={0}
                      width={barWidth}
                      height={dimensions.innerHeight}
                      fill="transparent"
                    />
                  </g>
                );
              })}

              {/* X-axis line */}
              <line
                x1={0}
                y1={dimensions.innerHeight}
                x2={dimensions.innerWidth}
                y2={dimensions.innerHeight}
                stroke={chartTheme.colors.axis}
                strokeWidth={1}
                opacity={0.3}
              />

              {/* X-axis labels */}
              {X_LABELS.map((val) => (
                <text
                  key={val}
                  x={xScale(val)}
                  y={dimensions.innerHeight + 18}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-muted-foreground"
                  fontSize={chartTheme.font.size.tick}
                  fontFamily={chartTheme.font.mono}
                >
                  {val}
                </text>
              ))}

              {/* Highlight score marker */}
              {highlightScore != null && (
                <g>
                  {/* Vertical line */}
                  <line
                    x1={xScale(highlightScore)}
                    y1={-8}
                    x2={xScale(highlightScore)}
                    y2={dimensions.innerHeight}
                    stroke="#818cf8"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    opacity={0.9}
                  />
                  {/* Glow line for emphasis */}
                  <line
                    x1={xScale(highlightScore)}
                    y1={-8}
                    x2={xScale(highlightScore)}
                    y2={dimensions.innerHeight}
                    stroke="#818cf8"
                    strokeWidth={6}
                    opacity={0.15}
                  />
                  {/* Diamond marker at top */}
                  <polygon
                    points={`
                      ${xScale(highlightScore)},${-12}
                      ${xScale(highlightScore) + 5},${-6}
                      ${xScale(highlightScore)},${0}
                      ${xScale(highlightScore) - 5},${-6}
                    `}
                    fill="#818cf8"
                  />
                  {/* Label */}
                  <text
                    x={xScale(highlightScore)}
                    y={-18}
                    textAnchor="middle"
                    fill="#a5b4fc"
                    fontSize={chartTheme.font.size.label}
                    fontFamily={chartTheme.font.family}
                    fontWeight={600}
                  >
                    Your DRep
                  </text>
                </g>
              )}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
