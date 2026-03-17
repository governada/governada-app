'use client';

import { useEffect, useState, useRef } from 'react';

export interface GovernanceRingsData {
  /** Participation: 0-100 (votes cast, proposals reviewed, sessions) */
  participation: number;
  /** Deliberation: 0-100 (time on proposals, annotations, rationales) */
  deliberation: number;
  /** Impact: 0-100 (delegation count, vote influence, alignment accuracy) */
  impact: number;
}

interface GovernanceRingsProps {
  data: GovernanceRingsData;
  size?: 'hero' | 'card' | 'badge' | 'inline';
  animate?: boolean;
  className?: string;
  showLabels?: boolean;
}

const SIZE_CONFIG = {
  hero: { diameter: 200, strokeWidth: 12, gap: 4, labelSize: 'text-xs' },
  card: { diameter: 80, strokeWidth: 8, gap: 3, labelSize: 'text-[10px]' },
  badge: { diameter: 32, strokeWidth: 4, gap: 2, labelSize: '' },
  inline: { diameter: 20, strokeWidth: 3, gap: 1, labelSize: '' },
} as const;

// Ring colors from the Compass Palette
const RING_COLORS = {
  participation: {
    stroke: 'oklch(0.50 0.12 192)',
    strokeDark: 'oklch(0.72 0.12 192)',
    track: 'oklch(0.50 0.12 192 / 0.08)',
    trackDark: 'oklch(0.72 0.12 192 / 0.08)',
    label: 'Participation',
  },
  deliberation: {
    stroke: 'oklch(0.68 0.14 75)',
    strokeDark: 'oklch(0.78 0.12 75)',
    track: 'oklch(0.68 0.14 75 / 0.08)',
    trackDark: 'oklch(0.78 0.12 75 / 0.08)',
    label: 'Deliberation',
  },
  impact: {
    stroke: 'oklch(0.55 0.15 295)',
    strokeDark: 'oklch(0.70 0.14 295)',
    track: 'oklch(0.55 0.15 295 / 0.08)',
    trackDark: 'oklch(0.70 0.14 295 / 0.08)',
    label: 'Impact',
  },
} as const;

function Ring({
  cx,
  cy,
  radius,
  strokeWidth,
  value,
  color,
  animate,
  delay,
}: {
  cx: number;
  cy: number;
  radius: number;
  strokeWidth: number;
  value: number;
  color: { stroke: string; strokeDark: string; track: string; trackDark: string };
  animate: boolean;
  delay: number;
}) {
  const circumference = 2 * Math.PI * radius;
  const fillLength = (Math.min(value, 100) / 100) * circumference;
  const [currentFill, setCurrentFill] = useState(animate ? 0 : fillLength);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setCurrentFill(fillLength);
      return;
    }

    const startTime = performance.now() + delay;
    const duration = 800; // ms

    function tick(now: number) {
      const elapsed = now - startTime;
      if (elapsed < 0) {
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }
      // Spring-like ease-out
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrentFill(eased * fillLength);
      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [animate, fillLength, delay]);

  return (
    <g>
      {/* Background track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        className="[stroke:--ring-track]"
        style={
          {
            '--ring-track': color.track,
          } as React.CSSProperties
        }
      />
      {/* Foreground fill */}
      {currentFill > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${currentFill} ${circumference - currentFill}`}
          strokeDashoffset={circumference * 0.25} // Start from top
          className="[stroke:--ring-fill]"
          style={
            {
              '--ring-fill': color.stroke,
              transition: animate ? 'none' : 'stroke-dasharray 0.5s ease-out',
            } as React.CSSProperties
          }
        />
      )}
    </g>
  );
}

export function GovernanceRings({
  data,
  size = 'hero',
  animate = true,
  className = '',
  showLabels = false,
}: GovernanceRingsProps) {
  const config = SIZE_CONFIG[size];
  const { diameter, strokeWidth, gap } = config;
  const center = diameter / 2;

  // Calculate radii for each ring (outer to inner)
  const outerRadius = center - strokeWidth / 2;
  const middleRadius = outerRadius - strokeWidth - gap;
  const innerRadius = middleRadius - strokeWidth - gap;

  const rings = [
    {
      key: 'participation',
      value: data.participation,
      radius: outerRadius,
      color: RING_COLORS.participation,
      delay: 0,
    },
    {
      key: 'deliberation',
      value: data.deliberation,
      radius: middleRadius,
      color: RING_COLORS.deliberation,
      delay: 100,
    },
    {
      key: 'impact',
      value: data.impact,
      radius: innerRadius,
      color: RING_COLORS.impact,
      delay: 200,
    },
  ] as const;

  const showLabelText = showLabels && (size === 'hero' || size === 'card');

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <svg
        width={diameter}
        height={diameter}
        viewBox={`0 0 ${diameter} ${diameter}`}
        aria-label={`Governance rings: Participation ${data.participation}%, Deliberation ${data.deliberation}%, Impact ${data.impact}%`}
        role="img"
      >
        {rings.map((ring) => (
          <Ring
            key={ring.key}
            cx={center}
            cy={center}
            radius={ring.radius}
            strokeWidth={strokeWidth}
            value={ring.value}
            color={ring.color}
            animate={animate}
            delay={ring.delay}
          />
        ))}
      </svg>
      {showLabelText && (
        <div className={`flex items-center gap-3 mt-3 ${config.labelSize}`}>
          {rings.map((ring) => (
            <div key={ring.key} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: ring.color.stroke }}
              />
              <span className="text-muted-foreground font-medium">{ring.color.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
