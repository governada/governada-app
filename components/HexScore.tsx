'use client';

import { useRef, useEffect, useMemo, useState } from 'react';
import { motion, useInView, useSpring } from 'framer-motion';
import {
  type AlignmentScores,
  getDominantDimension,
  getIdentityColor,
  getHexVertices,
  hexVerticesToPath,
} from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

type HexSize = 'hero' | 'hero-lg' | 'card' | 'badge';

interface HexScoreProps {
  score: number;
  alignments: AlignmentScores;
  size?: HexSize;
  className?: string;
  animate?: boolean;
}

const SIZE_MAP: Record<HexSize, number> = {
  'hero-lg': 172,
  hero: 120,
  card: 48,
  badge: 24,
};

const FONT_MAP: Record<HexSize, number> = {
  'hero-lg': 38,
  hero: 28,
  card: 14,
  badge: 0,
};

function useCountUp(target: number, shouldAnimate: boolean): number {
  const [display, setDisplay] = useState(shouldAnimate ? 0 : target);
  const springValue = useSpring(0, { stiffness: 80, damping: 20, restDelta: 0.5 });

  useEffect(() => {
    if (shouldAnimate) springValue.set(target);
    else setDisplay(target);
  }, [target, shouldAnimate, springValue]);

  useEffect(() => {
    const unsub = springValue.on('change', (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [springValue]);

  return display;
}

export function HexScore({
  score,
  alignments,
  size = 'hero',
  className,
  animate: enableAnim = true,
}: HexScoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-30px' });
  const shouldAnimate = enableAnim && isInView;

  const svgSize = SIZE_MAP[size];
  const fontSize = FONT_MAP[size];
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);

  const vertices = useMemo(() => getHexVertices(alignments, svgSize), [alignments, svgSize]);
  const polygonPoints = useMemo(() => hexVerticesToPath(vertices), [vertices]);

  const animatedScore = useCountUp(score, shouldAnimate);
  // eslint-disable-next-line react-hooks/purity -- stable random ID for SVG gradient defs, only changes with size
  const uid = useMemo(() => `hex-${size}-${Math.random().toString(36).slice(2, 6)}`, [size]);

  const showNumber = size !== 'badge';
  const showGlow = size !== 'badge';
  const showShimmer = size === 'hero' || size === 'hero-lg';

  const perimeterLength = useMemo(() => {
    let len = 0;
    for (let i = 0; i < vertices.length; i++) {
      const [x1, y1] = vertices[i];
      const [x2, y2] = vertices[(i + 1) % vertices.length];
      len += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    return Math.round(len);
  }, [vertices]);

  return (
    <div
      ref={ref}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: svgSize, height: svgSize }}
    >
      <motion.svg
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        width={svgSize}
        height={svgSize}
        initial={shouldAnimate ? { scale: 0.85, opacity: 0 } : undefined}
        animate={shouldAnimate ? { scale: 1, opacity: 1 } : undefined}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        role="img"
        aria-label={`Score: ${score}`}
      >
        <defs>
          {showGlow && (
            <>
              <filter id={`${uid}-bloom`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={size === 'hero-lg' ? 14 : size === 'hero' ? 10 : 3}
                />
              </filter>
              <filter id={`${uid}-glow`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation={size === 'hero-lg' ? 5 : size === 'hero' ? 4 : 2}
                />
              </filter>
            </>
          )}
          <radialGradient id={`${uid}-fill`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={identityColor.hex} stopOpacity={0.2} />
            <stop offset="100%" stopColor={identityColor.hex} stopOpacity={0.04} />
          </radialGradient>
        </defs>

        {/* Layer 1: Wide bloom */}
        {showGlow && (
          <polygon
            points={polygonPoints}
            fill={`rgba(${identityColor.rgb.join(',')}, 0.08)`}
            stroke={identityColor.hex}
            strokeWidth={size === 'hero-lg' || size === 'hero' ? 1.5 : 1}
            filter={`url(#${uid}-bloom)`}
            className="animate-breathing-glow"
          />
        )}

        {/* Layer 2: Tight glow */}
        {showGlow && (
          <polygon
            points={polygonPoints}
            fill={`rgba(${identityColor.rgb.join(',')}, 0.18)`}
            stroke={identityColor.hex}
            strokeWidth={size === 'hero-lg' || size === 'hero' ? 1.5 : 1}
            filter={`url(#${uid}-glow)`}
          />
        )}

        {/* Layer 3: Crisp shape */}
        <polygon
          points={polygonPoints}
          fill={
            size === 'badge' ? `rgba(${identityColor.rgb.join(',')}, 0.3)` : `url(#${uid}-fill)`
          }
          stroke={identityColor.hex}
          strokeWidth={size === 'hero-lg' || size === 'hero' ? 1.5 : size === 'card' ? 1 : 0.5}
          strokeLinejoin="round"
        />

        {/* Edge shimmer — animated dash traveling along the hex edge */}
        {showShimmer && (
          <polygon
            points={polygonPoints}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeDasharray={`${Math.round(perimeterLength * 0.06)} ${Math.round(perimeterLength * 0.94)}`}
            strokeLinecap="round"
            opacity={0.5}
            style={{
              animation: `hex-shimmer ${Math.max(3, perimeterLength / 80)}s linear infinite`,
              strokeDashoffset: 0,
            }}
          />
        )}

        {/* Score number */}
        {showNumber && (
          <>
            <text
              x={svgSize / 2}
              y={size === 'card' ? svgSize / 2 : svgSize / 2 - 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              fontWeight={700}
              letterSpacing="0.04em"
              fontFamily="var(--font-geist-mono)"
              style={{
                textShadow: `0 0 20px ${identityColor.hex}, 0 0 40px ${identityColor.hex}40`,
              }}
            >
              {animatedScore}
            </text>
            {(size === 'hero' || size === 'hero-lg') && (
              <text
                x={svgSize / 2}
                y={svgSize / 2 + fontSize * 0.55}
                textAnchor="middle"
                dominantBaseline="hanging"
                fill="white"
                fontSize={11}
                fontFamily="var(--font-geist-mono)"
                opacity={0.35}
              >
                / 100
              </text>
            )}
          </>
        )}
      </motion.svg>
    </div>
  );
}
