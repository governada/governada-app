'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useChartDimensions, GlowFilter } from '@/lib/charts';

interface StatusCount {
  status: string;
  count: number;
  color: string;
}

interface ProposalStatusFunnelProps {
  statuses: StatusCount[];
  className?: string;
}

const ROW_HEIGHT = 40;
const BAR_HEIGHT = 24;
const LABEL_WIDTH = 90;
const COUNT_WIDTH = 50;
const CONNECTOR_INSET = 4;

export function ProposalStatusFunnel({ statuses, className }: ProposalStatusFunnelProps) {
  const totalHeight = statuses.length * ROW_HEIGHT + 8;
  const { containerRef, dimensions } = useChartDimensions(totalHeight, {
    top: 4,
    right: 12,
    bottom: 4,
    left: 0,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger the CSS transition after initial render
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const maxCount = Math.max(...statuses.map((s) => s.count), 1);
  const barAreaWidth = Math.max(0, dimensions.innerWidth - LABEL_WIDTH - COUNT_WIDTH);

  return (
    <div className={cn('w-full', className)}>
      <div
        ref={containerRef}
        className="w-full"
        role="img"
        aria-label="Proposal status funnel chart"
      >
        <svg
          width={dimensions.width || '100%'}
          height={totalHeight}
          viewBox={`0 0 ${dimensions.width || 400} ${totalHeight}`}
          className="overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <GlowFilter id="funnel-glow" stdDeviation={3} />
            {statuses.map((s, i) => (
              <linearGradient key={`grad-${i}`} id={`funnel-bar-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>

          {statuses.map((s, i) => {
            const barWidth = (s.count / maxCount) * barAreaWidth;
            const y = i * ROW_HEIGHT + 4;
            const barY = y + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const barX = LABEL_WIDTH;
            const isMax = s.count === maxCount;

            // Connecting line to next bar
            const nextStatus = statuses[i + 1];
            const nextBarWidth = nextStatus ? (nextStatus.count / maxCount) * barAreaWidth : 0;

            return (
              <g key={s.status}>
                {/* Status label */}
                <text
                  x={LABEL_WIDTH - 10}
                  y={barY + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  fill="currentColor"
                  className={cn(isMax ? 'text-foreground' : 'text-muted-foreground')}
                  fontSize={12}
                  fontWeight={isMax ? 600 : 400}
                  fontFamily="var(--font-geist-sans)"
                >
                  {s.status}
                </text>

                {/* Shadow beneath bar */}
                <rect
                  x={barX + 1}
                  y={barY + 2}
                  width={mounted ? barWidth : 0}
                  height={BAR_HEIGHT}
                  rx={6}
                  ry={6}
                  fill="black"
                  opacity={0.2}
                  style={{
                    transition: 'width 700ms ease-out',
                  }}
                />

                {/* Bar background track */}
                <rect
                  x={barX}
                  y={barY}
                  width={barAreaWidth}
                  height={BAR_HEIGHT}
                  rx={6}
                  ry={6}
                  fill="currentColor"
                  className="text-muted/30"
                  opacity={0.15}
                />

                {/* Animated bar */}
                <rect
                  x={barX}
                  y={barY}
                  width={mounted ? barWidth : 0}
                  height={BAR_HEIGHT}
                  rx={6}
                  ry={6}
                  fill={`url(#funnel-bar-${i})`}
                  filter={isMax ? 'url(#funnel-glow)' : undefined}
                  style={{
                    transition: 'width 700ms ease-out',
                  }}
                />

                {/* Subtle highlight on top of bar */}
                <rect
                  x={barX + 2}
                  y={barY + 1}
                  width={mounted ? Math.max(0, barWidth - 4) : 0}
                  height={1}
                  rx={0.5}
                  fill="white"
                  opacity={0.15}
                  style={{
                    transition: 'width 700ms ease-out',
                  }}
                />

                {/* Count label */}
                <text
                  x={barX + barAreaWidth + 12}
                  y={barY + BAR_HEIGHT / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fill={s.color}
                  fontSize={13}
                  fontWeight={isMax ? 700 : 500}
                  fontFamily="var(--font-geist-mono)"
                  opacity={mounted ? 1 : 0}
                  style={{
                    transition: 'opacity 700ms ease-out 200ms',
                  }}
                >
                  {s.count}
                </text>

                {/* Connecting line to next row */}
                {nextStatus && (
                  <path
                    d={`
                      M ${barX + (mounted ? barWidth : 0) - CONNECTOR_INSET} ${barY + BAR_HEIGHT}
                      C ${barX + (mounted ? barWidth : 0) - CONNECTOR_INSET} ${barY + BAR_HEIGHT + ROW_HEIGHT * 0.4},
                        ${barX + (mounted ? nextBarWidth : 0) - CONNECTOR_INSET} ${barY + ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2 - ROW_HEIGHT * 0.4},
                        ${barX + (mounted ? nextBarWidth : 0) - CONNECTOR_INSET} ${barY + ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2}
                    `}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    opacity={mounted ? 0.35 : 0}
                    style={{
                      transition: 'opacity 700ms ease-out 400ms',
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
