'use client';

import { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface GovernanceHealthGaugeProps {
  score: number;
  band: string;
  delta?: number;
  narrative?: string;
  className?: string;
}

const ARC_START = -Math.PI * 0.75;
const ARC_END = Math.PI * 0.75;
const ARC_RANGE = ARC_END - ARC_START;
const RADIUS = 80;
const CX = 100;
const CY = 100;
const STROKE_WIDTH = 12;

function polarToCartesian(angle: number): { x: number; y: number } {
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

function describeArc(startAngle: number, endAngle: number): string {
  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// Generate tick marks at 0, 25, 50, 75, 100
function generateTicks() {
  return [0, 25, 50, 75, 100].map((value) => {
    const angle = ARC_START + (value / 100) * ARC_RANGE;
    const inner = {
      x: CX + (RADIUS - STROKE_WIDTH / 2 - 6) * Math.cos(angle),
      y: CY + (RADIUS - STROKE_WIDTH / 2 - 6) * Math.sin(angle),
    };
    const outer = {
      x: CX + (RADIUS + STROKE_WIDTH / 2 + 2) * Math.cos(angle),
      y: CY + (RADIUS + STROKE_WIDTH / 2 + 2) * Math.sin(angle),
    };
    const label = {
      x: CX + (RADIUS + STROKE_WIDTH / 2 + 14) * Math.cos(angle),
      y: CY + (RADIUS + STROKE_WIDTH / 2 + 14) * Math.sin(angle),
    };
    return { value, inner, outer, label };
  });
}

function getGaugeColor(score: number): string {
  if (score >= 70) return '#34d399'; // emerald
  if (score >= 45) return '#fbbf24'; // amber
  return '#f87171'; // rose
}

export function GovernanceHealthGauge({
  score,
  band,
  delta,
  narrative,
  className,
}: GovernanceHealthGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 1200;
    const from = 0;
    const to = Math.min(100, Math.max(0, score));

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [score]);

  const valueAngle = ARC_START + (animatedScore / 100) * ARC_RANGE;
  const color = getGaugeColor(score);
  const ticks = generateTicks();

  // Needle tip position
  const needle = polarToCartesian(valueAngle);

  return (
    <div
      className={cn('flex flex-col items-center', className)}
      role="meter"
      aria-valuenow={Math.round(score)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Governance Health Index: ${Math.round(score)} out of 100, ${band}`}
    >
      <svg viewBox="0 0 200 140" className="w-full max-w-[220px]" aria-hidden="true">
        <defs>
          <filter id="gauge-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            <feComposite in2="SourceGraphic" operator="over" />
          </filter>
          <linearGradient id="gauge-arc-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="45%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>

        {/* Background arc */}
        <path
          d={describeArc(ARC_START, ARC_END)}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          className="text-border"
          opacity={0.4}
        />

        {/* Gradient arc (full range) */}
        <path
          d={describeArc(ARC_START, ARC_END)}
          fill="none"
          stroke="url(#gauge-arc-gradient)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          opacity={0.15}
        />

        {/* Value arc */}
        {animatedScore > 0 && (
          <path
            d={describeArc(ARC_START, valueAngle)}
            fill="none"
            stroke={color}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            filter="url(#gauge-glow)"
          />
        )}

        {/* Tick marks */}
        {ticks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={tick.inner.x}
              y1={tick.inner.y}
              x2={tick.outer.x}
              y2={tick.outer.y}
              stroke="currentColor"
              strokeWidth={1}
              className="text-muted-foreground"
              opacity={0.3}
            />
            <text
              x={tick.label.x}
              y={tick.label.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill="currentColor"
              className="text-muted-foreground"
              fontSize={8}
              fontFamily="var(--font-geist-mono)"
            >
              {tick.value}
            </text>
          </g>
        ))}

        {/* Needle */}
        <line
          x1={CX}
          y1={CY}
          x2={needle.x}
          y2={needle.y}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={4} fill={color} />
        <circle cx={CX} cy={CY} r={2} fill="currentColor" className="text-background" />

        {/* Center score */}
        <text
          x={CX}
          y={CY + 28}
          textAnchor="middle"
          fill={color}
          fontSize={28}
          fontWeight="bold"
          fontFamily="var(--font-geist-sans)"
        >
          {Math.round(animatedScore)}
        </text>
      </svg>

      {/* Band label below */}
      <div className="flex flex-col items-center gap-1.5 -mt-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs font-semibold px-2.5 py-0.5 rounded-full',
              band === 'Healthy'
                ? 'bg-emerald-900/30 text-emerald-400'
                : band === 'Moderate'
                  ? 'bg-amber-900/30 text-amber-400'
                  : 'bg-rose-900/30 text-rose-400',
            )}
          >
            {band}
          </span>
          {delta != null && delta !== 0 && (
            <span
              className={cn(
                'text-xs font-medium tabular-nums',
                delta > 0 ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}
            </span>
          )}
        </div>
        {narrative && (
          <p className="text-[11px] text-muted-foreground text-center max-w-[200px] leading-snug">
            {narrative}
          </p>
        )}
      </div>
    </div>
  );
}
