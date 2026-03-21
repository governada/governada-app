'use client';

import { useState, useMemo, useRef } from 'react';
import { scaleLinear } from 'd3-scale';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────────────── */

interface AlignmentEntity {
  id: string;
  name: string | null;
  score: number;
  alignments: number[]; // 6 values, 0-100
  dominant: string; // dominant alignment dimension
}

interface AlignmentScatterProps {
  /** DRep alignment data from constellation API or useDReps */
  entities: AlignmentEntity[];
  /** User's alignment from quiz (6 values, 0-100) — shown as "You" dot */
  userAlignments?: number[] | null;
  /** Callback when a DRep dot is clicked */
  onEntityClick?: (id: string) => void;
  className?: string;
}

/* ── Constants ──────────────────────────────────────────────────── */

/** Alignment dimension indices */
const X_INDEX = 0; // treasury_conservative
const Y_INDEX = 4; // innovation

const DIMENSION_COLORS: Record<string, string> = {
  treasury_conservative: '#6b8aad',
  treasury_growth: '#e5a158',
  decentralization: '#5bb5a2',
  security: '#8b7ec8',
  innovation: '#5b9bd5',
  transparency: '#78b065',
};

const FALLBACK_COLOR = '#6b8aad';
const USER_COLOR = '#5bb5a2'; // teal / primary

/** SVG layout */
const MARGIN = { top: 16, right: 16, bottom: 36, left: 40 };
const MOBILE_MARGIN = { top: 12, right: 12, bottom: 12, left: 12 };

/* ── Tooltip state ──────────────────────────────────────────────── */

interface TooltipState {
  x: number;
  y: number;
  name: string;
  score: number;
}

/* ── Component ──────────────────────────────────────────────────── */

export function AlignmentScatter({
  entities,
  userAlignments,
  onEntityClick,
  className,
}: AlignmentScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount via ref callback
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);

  const containerCallbackRef = useMemo(() => {
    return (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (resizeRef.current) {
        resizeRef.current.disconnect();
        resizeRef.current = null;
      }
      if (node) {
        const observer = new ResizeObserver((entries) => {
          const width = entries[0]?.contentRect.width ?? 640;
          setIsMobile(width < 640);
        });
        observer.observe(node);
        resizeRef.current = observer;
      }
    };
  }, []);

  // Dimensions
  const viewWidth = 600;
  const viewHeight = isMobile ? 260 : 380;
  const margin = isMobile ? MOBILE_MARGIN : MARGIN;
  const plotWidth = viewWidth - margin.left - margin.right;
  const plotHeight = viewHeight - margin.top - margin.bottom;

  // Scales
  const xScale = useMemo(() => scaleLinear().domain([0, 100]).range([0, plotWidth]), [plotWidth]);
  const yScale = useMemo(() => scaleLinear().domain([0, 100]).range([plotHeight, 0]), [plotHeight]);

  // Dot sizing
  const baseRadius = isMobile ? 2.5 : 3;
  const highlightRadius = isMobile ? 4 : 5;
  const userRadius = isMobile ? 6 : 8;

  // Sort entities so high-score ones render on top
  const sortedEntities = useMemo(() => [...entities].sort((a, b) => a.score - b.score), [entities]);

  /* ── Handlers ──────────────────────────────────────────────────── */

  function handleDotEnter(
    e: React.MouseEvent<SVGCircleElement> | React.FocusEvent<SVGCircleElement>,
    entity: AlignmentEntity,
  ) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clientX =
      'clientX' in e ? e.clientX : (e.target as SVGCircleElement).getBoundingClientRect().x;
    const clientY =
      'clientY' in e ? e.clientY : (e.target as SVGCircleElement).getBoundingClientRect().y;

    setTooltip({
      x: clientX - rect.left,
      y: clientY - rect.top,
      name: entity.name || 'Anonymous DRep',
      score: entity.score,
    });
  }

  function handleDotLeave() {
    setTooltip(null);
  }

  function handleDotClick(entity: AlignmentEntity) {
    onEntityClick?.(entity.id);
  }

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <motion.div
      ref={containerCallbackRef}
      className={cn(
        'rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 sm:p-6',
        className,
      )}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* Chart */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          className="w-full"
          style={{ minHeight: isMobile ? 200 : 300 }}
          role="img"
          aria-label="Alignment scatter plot showing DRep governance positions"
        >
          {/* Plot area group */}
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            {/* Grid lines */}
            {[25, 50, 75].map((tick) => (
              <g key={tick}>
                <line
                  x1={xScale(tick)}
                  y1={0}
                  x2={xScale(tick)}
                  y2={plotHeight}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                  strokeDasharray="2,4"
                />
                <line
                  x1={0}
                  y1={yScale(tick)}
                  x2={plotWidth}
                  y2={yScale(tick)}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                  strokeDasharray="2,4"
                />
              </g>
            ))}

            {/* Border */}
            <rect
              x={0}
              y={0}
              width={plotWidth}
              height={plotHeight}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.08}
              rx={4}
            />

            {/* DRep dots */}
            {sortedEntities.map((entity, i) => {
              const cx = xScale(entity.alignments[X_INDEX] ?? 50);
              const cy = yScale(entity.alignments[Y_INDEX] ?? 50);
              const isHighScore = entity.score > 70;
              const r = isHighScore ? highlightRadius : baseRadius;
              const color = DIMENSION_COLORS[entity.dominant] ?? FALLBACK_COLOR;
              const opacity = isHighScore ? 0.9 : 0.6;

              return (
                <motion.circle
                  key={entity.id}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  fillOpacity={opacity}
                  stroke={color}
                  strokeOpacity={opacity * 0.5}
                  strokeWidth={0.5}
                  className={cn('transition-[r] duration-150', onEntityClick && 'cursor-pointer')}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.003, 0.6) }}
                  onMouseEnter={(e) => handleDotEnter(e, entity)}
                  onMouseLeave={handleDotLeave}
                  onFocus={(e) => handleDotEnter(e, entity)}
                  onBlur={handleDotLeave}
                  onClick={() => handleDotClick(entity)}
                  tabIndex={onEntityClick ? 0 : undefined}
                  role={onEntityClick ? 'button' : undefined}
                  aria-label={`${entity.name || 'Anonymous DRep'}, score ${entity.score}`}
                />
              );
            })}

            {/* User dot */}
            {userAlignments && userAlignments.length >= 5 && (
              <g>
                {/* Pulsing ring */}
                <motion.circle
                  cx={xScale(userAlignments[X_INDEX] ?? 50)}
                  cy={yScale(userAlignments[Y_INDEX] ?? 50)}
                  r={userRadius + 4}
                  fill="none"
                  stroke={USER_COLOR}
                  strokeWidth={1.5}
                  strokeOpacity={0.4}
                  animate={{ r: [userRadius + 4, userRadius + 10], strokeOpacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                />

                {/* Outer ring */}
                <circle
                  cx={xScale(userAlignments[X_INDEX] ?? 50)}
                  cy={yScale(userAlignments[Y_INDEX] ?? 50)}
                  r={userRadius + 2}
                  fill="none"
                  stroke={USER_COLOR}
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />

                {/* Solid dot */}
                <motion.circle
                  cx={xScale(userAlignments[X_INDEX] ?? 50)}
                  cy={yScale(userAlignments[Y_INDEX] ?? 50)}
                  r={userRadius}
                  fill={USER_COLOR}
                  fillOpacity={0.95}
                  stroke="#fff"
                  strokeWidth={1.5}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.4, type: 'spring', stiffness: 200 }}
                />

                {/* "You" label */}
                <text
                  x={xScale(userAlignments[X_INDEX] ?? 50)}
                  y={yScale(userAlignments[Y_INDEX] ?? 50) - userRadius - 6}
                  textAnchor="middle"
                  className="fill-current text-[11px] font-semibold"
                  style={{ fill: USER_COLOR }}
                >
                  You
                </text>
              </g>
            )}
          </g>

          {/* Axis labels (desktop only) */}
          {!isMobile && (
            <>
              {/* X-axis label */}
              <text
                x={margin.left + plotWidth / 2}
                y={viewHeight - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {'← Conservative · Treasury · Growth →'}
              </text>

              {/* Y-axis label */}
              <text
                x={14}
                y={margin.top + plotHeight / 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
                transform={`rotate(-90, 14, ${margin.top + plotHeight / 2})`}
              >
                {'← Security · Priorities · Innovation →'}
              </text>
            </>
          )}
        </svg>

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: tooltip.x,
              top: tooltip.y - 40,
              transform: 'translateX(-50%)',
            }}
          >
            <p className="font-medium text-foreground">{tooltip.name}</p>
            <p className="text-muted-foreground">Score: {tooltip.score}</p>
          </div>
        )}
      </div>

      {/* Compass Guide text */}
      {userAlignments && (
        <p className="mt-3 text-center text-xs text-muted-foreground/80">
          Each dot represents a DRep, positioned by their governance values. The closer they are to
          you, the more they think like you.
        </p>
      )}
    </motion.div>
  );
}
