'use client';

import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { motion, useInView, useSpring, useMotionValue } from 'framer-motion';
import {
  type AlignmentScores,
  type AlignmentDimension,
  getDominantDimension,
  getIdentityColor,
  getDimensionLabel,
  getDimensionOrder,
  alignmentsToArray,
} from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

type RadarSize = 'full' | 'medium' | 'mini';

interface GovernanceRadarProps {
  alignments: AlignmentScores;
  compareAlignments?: AlignmentScores;
  size?: RadarSize;
  className?: string;
  animate?: boolean;
}

const SIZE_MAP: Record<RadarSize, number> = { full: 220, medium: 80, mini: 32 };
const PADDING_MAP: Record<RadarSize, number> = { full: 44, medium: 8, mini: 2 };

function getPolygonPoints(scores: number[], cx: number, cy: number, maxR: number): string {
  return scores
    .map((score, i) => {
      const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
      const r = maxR * (score / 100);
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

function useAnimatedScores(targets: number[], shouldAnimate: boolean): number[] {
  const springs = [
    useSpring(shouldAnimate ? 0 : targets[0], { stiffness: 180, damping: 22 }),
    useSpring(shouldAnimate ? 0 : targets[1], { stiffness: 180, damping: 22 }),
    useSpring(shouldAnimate ? 0 : targets[2], { stiffness: 180, damping: 22 }),
    useSpring(shouldAnimate ? 0 : targets[3], { stiffness: 180, damping: 22 }),
    useSpring(shouldAnimate ? 0 : targets[4], { stiffness: 180, damping: 22 }),
    useSpring(shouldAnimate ? 0 : targets[5], { stiffness: 180, damping: 22 }),
  ];

  const [values, setValues] = useState(shouldAnimate ? [0, 0, 0, 0, 0, 0] : targets);

  useEffect(() => {
    if (!shouldAnimate) {
      setValues(targets);
      return;
    }
    springs.forEach((s, i) => {
      setTimeout(() => s.set(targets[i]), i * 60);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAnimate, ...targets]);

  useEffect(() => {
    const unsubs = springs.map((s, i) =>
      s.on('change', (v) =>
        setValues((prev) => {
          const next = [...prev];
          next[i] = v;
          return next;
        }),
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return values;
}

function BreathingVertices({
  scores,
  cx,
  cy,
  maxR,
  color,
}: {
  scores: number[];
  cx: number;
  cy: number;
  maxR: number;
  color: string;
}) {
  const [offsets, setOffsets] = useState(() => scores.map(() => 0));
  const rafRef = useRef(0);

  const animate = useCallback(() => {
    const now = Date.now();
    setOffsets(scores.map((_, i) => Math.sin(now / 1200 + i * 1.05) * 1.8));
    rafRef.current = requestAnimationFrame(animate);
  }, [scores]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  return (
    <>
      {scores.map((score, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const r = maxR * (score / 100) + offsets[i];
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} opacity={0.9} />;
      })}
    </>
  );
}

export function GovernanceRadar({
  alignments,
  compareAlignments,
  size = 'full',
  className,
  animate = true,
}: GovernanceRadarProps) {
  const ref = useRef<SVGSVGElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-40px' });
  const shouldAnimate = animate && isInView;

  const svgSize = SIZE_MAP[size];
  const padding = PADDING_MAP[size];
  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const maxR = (svgSize - padding * 2) / 2;

  const dimensions = getDimensionOrder();
  const rawScores = alignmentsToArray(alignments);
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);

  const animatedScores = useAnimatedScores(rawScores, shouldAnimate && size === 'full');
  const displayScores = size === 'full' ? animatedScores : rawScores;

  const mainPoints = useMemo(
    () => getPolygonPoints(displayScores, cx, cy, maxR),
    [displayScores, cx, cy, maxR],
  );

  const axisEndpoints = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        return [cx + maxR * Math.cos(angle), cy + maxR * Math.sin(angle)] as [number, number];
      }),
    [cx, cy, maxR],
  );

  const comparePoints = useMemo(() => {
    if (!compareAlignments) return null;
    const cScores = alignmentsToArray(compareAlignments);
    return getPolygonPoints(cScores, cx, cy, maxR);
  }, [compareAlignments, cx, cy, maxR]);

  const compareColor = useMemo(() => {
    if (!compareAlignments) return null;
    return getIdentityColor(getDominantDimension(compareAlignments));
  }, [compareAlignments]);

  const uid = useMemo(() => `radar-${size}-${Math.random().toString(36).slice(2, 6)}`, [size]);

  if (size === 'mini') {
    return (
      <div role="img" aria-label="Governance alignment radar" className={cn('shrink-0', className)}>
        <svg
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          width={svgSize}
          height={svgSize}
          aria-hidden="true"
        >
          <polygon
            points={getPolygonPoints(rawScores, cx, cy, maxR)}
            fill={`rgba(${identityColor.rgb.join(',')}, 0.25)`}
            stroke={identityColor.hex}
            strokeWidth={1}
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div role="img" aria-label="Governance alignment radar" className={cn('shrink-0', className)}>
      <svg
        ref={ref}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        width={svgSize}
        height={svgSize}
        aria-hidden="true"
      >
        <defs>
          <filter id={`${uid}-bloom`} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size === 'full' ? 12 : 4} />
          </filter>
          <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size === 'full' ? 4 : 2} />
          </filter>
          <radialGradient id={`${uid}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={identityColor.hex} stopOpacity={0.4} />
            <stop offset="100%" stopColor={identityColor.hex} stopOpacity={0.08} />
          </radialGradient>
          {compareColor && (
            <radialGradient id={`${uid}-cfill`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={compareColor.hex} stopOpacity={0.25} />
              <stop offset="100%" stopColor={compareColor.hex} stopOpacity={0.04} />
            </radialGradient>
          )}
          {/* Axis gradient */}
          {axisEndpoints.map((_, i) => {
            const dimColor = getIdentityColor(dimensions[i]);
            return (
              <linearGradient
                key={i}
                id={`${uid}-axis-${i}`}
                x1="50%"
                y1="50%"
                x2={`${(axisEndpoints[i][0] / svgSize) * 100}%`}
                y2={`${(axisEndpoints[i][1] / svgSize) * 100}%`}
              >
                <stop offset="0%" stopColor={dimColor.hex} stopOpacity={0} />
                <stop offset="50%" stopColor={dimColor.hex} stopOpacity={0.3} />
                <stop offset="100%" stopColor={dimColor.hex} stopOpacity={0.1} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Grid rings — solid, subtle */}
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <polygon
            key={pct}
            points={Array.from({ length: 6 }, (_, i) => {
              const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
              const r = maxR * pct;
              return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
            }).join(' ')}
            fill="none"
            stroke={pct === 1 ? `rgba(${identityColor.rgb.join(',')}, 0.12)` : 'currentColor'}
            strokeWidth={pct === 1 ? 0.8 : 0.4}
            className={pct === 1 ? undefined : 'text-border'}
            opacity={pct === 1 ? 1 : 0.5}
          />
        ))}

        {/* Axis lines with gradient */}
        {axisEndpoints.map(([ex, ey], i) => (
          <g key={`axis-${i}`}>
            <line
              x1={cx}
              y1={cy}
              x2={ex}
              y2={ey}
              stroke={`url(#${uid}-axis-${i})`}
              strokeWidth={0.8}
            />
            {/* Glowing dot at axis tip */}
            <circle
              cx={ex}
              cy={ey}
              r={size === 'full' ? 2.5 : 1.5}
              fill={getIdentityColor(dimensions[i]).hex}
              opacity={0.6}
            />
          </g>
        ))}

        {/* Compare polygon (behind main) */}
        {comparePoints && compareColor && (
          <>
            <polygon
              points={comparePoints}
              fill={`url(#${uid}-cfill)`}
              stroke={compareColor.hex}
              strokeWidth={1}
              strokeLinejoin="round"
              opacity={0.5}
            />
          </>
        )}

        {/* Layer 1: Wide bloom */}
        <polygon
          points={mainPoints}
          fill={`rgba(${identityColor.rgb.join(',')}, 0.08)`}
          stroke={identityColor.hex}
          strokeWidth={1.5}
          filter={`url(#${uid}-bloom)`}
        />

        {/* Layer 2: Tight glow */}
        <polygon
          points={mainPoints}
          fill={`rgba(${identityColor.rgb.join(',')}, 0.15)`}
          stroke={identityColor.hex}
          strokeWidth={1.5}
          filter={`url(#${uid}-glow)`}
        />

        {/* Layer 3: Crisp shape */}
        <polygon
          points={mainPoints}
          fill={`url(#${uid}-fill)`}
          stroke={identityColor.hex}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Breathing vertex dots — full size only */}
        {size === 'full' && shouldAnimate && (
          <BreathingVertices
            scores={rawScores}
            cx={cx}
            cy={cy}
            maxR={maxR}
            color={identityColor.hex}
          />
        )}

        {/* Static vertex dots for medium or pre-animation */}
        {(size === 'medium' || !shouldAnimate) &&
          displayScores.map((score, i) => {
            const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
            const r = maxR * (score / 100);
            return (
              <circle
                key={i}
                cx={cx + r * Math.cos(angle)}
                cy={cy + r * Math.sin(angle)}
                r={size === 'full' ? 3 : 2}
                fill={identityColor.hex}
                opacity={0.9}
              />
            );
          })}

        {/* Dimension labels — full size only */}
        {size === 'full' &&
          axisEndpoints.map(([ex, ey], i) => {
            const dim = dimensions[i];
            const label = getDimensionLabel(dim);
            const score = rawScores[i];
            const dimColor = getIdentityColor(dim);

            const labelOffset = 20;
            const dx = ex - cx;
            const dy = ey - cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / len;
            const ny = dy / len;
            const lx = ex + nx * labelOffset;
            const ly = ey + ny * labelOffset;

            let textAnchor: 'start' | 'middle' | 'end' = 'middle';
            if (nx > 0.3) textAnchor = 'start';
            else if (nx < -0.3) textAnchor = 'end';

            return (
              <g key={dim}>
                <text
                  x={lx}
                  y={ly - 7}
                  textAnchor={textAnchor}
                  dominantBaseline="auto"
                  fill={dimColor.hex}
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="var(--font-geist-sans)"
                  opacity={0.85}
                >
                  {label}
                </text>
                <text
                  x={lx}
                  y={ly + 7}
                  textAnchor={textAnchor}
                  dominantBaseline="hanging"
                  fill="white"
                  fontSize={12}
                  fontWeight={700}
                  fontFamily="var(--font-geist-mono)"
                  style={{ textShadow: `0 0 8px ${dimColor.hex}60` }}
                >
                  {score}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}
