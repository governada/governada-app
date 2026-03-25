'use client';

/**
 * HealthVitalTracesPanel — ICU-style vital sign traces for the Governance Health Index.
 *
 * Main heartbeat trace shows GHI score over recent epochs. Eight component traces
 * are stacked below, grouped by category (Engagement, Quality, Resilience).
 * Synchronized with the Observatory playback engine via position prop.
 */

import { useMemo, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGovernanceHealthIndex } from '@/hooks/queries';
import { Skeleton } from '@/components/ui/skeleton';

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

interface HealthVitalTracesPanelProps {
  expanded?: boolean;
  position: number;
  isLive: boolean;
  /** AI-generated Seneca narrative for the health drilldown */
  narrative?: string | null;
}

/** History point — components come as an array from the API, not a Record */
interface GHIHistoryComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

interface GHIHistoryPoint {
  epoch: number;
  score: number;
  components: GHIHistoryComponent[];
}

interface GHITrend {
  direction: string;
  delta: number;
  streakEpochs?: number;
}

/** componentTrends from API is an object keyed by display name */
interface ComponentTrendValue {
  direction: string;
  delta: number;
}

interface GHIData {
  current: { score: number; band: string; components?: GHIHistoryComponent[] };
  history: GHIHistoryPoint[];
  trend: GHITrend;
  componentTrends: Record<string, ComponentTrendValue>;
  calibration: Record<string, { min: number; max: number }>;
}

/* ──────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────── */

const BAND_CONFIG: Record<
  string,
  { color: string; stroke: string; glow: string; label: string; textClass: string; bgClass: string }
> = {
  strong: {
    color: 'oklch(0.72 0.12 192)',
    stroke: 'oklch(0.72 0.12 192)',
    glow: 'oklch(0.72 0.12 192 / 0.15)',
    label: 'Strong',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
  },
  good: {
    color: 'oklch(0.7 0.14 160)',
    stroke: 'oklch(0.7 0.14 160)',
    glow: 'oklch(0.7 0.14 160 / 0.15)',
    label: 'Good',
    textClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
  },
  fair: {
    color: 'oklch(0.75 0.12 80)',
    stroke: 'oklch(0.75 0.12 80)',
    glow: 'oklch(0.75 0.12 80 / 0.15)',
    label: 'Fair',
    textClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
  },
  critical: {
    color: 'oklch(0.65 0.18 15)',
    stroke: 'oklch(0.65 0.18 15)',
    glow: 'oklch(0.65 0.18 15 / 0.15)',
    label: 'Critical',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10',
  },
};

/** Component traces grouped by category with category-level colors. */
const COMPONENT_GROUPS: {
  category: string;
  color: string;
  glowColor: string;
  alertColor: string;
  components: { key: string; label: string }[];
}[] = [
  {
    category: 'Engagement',
    color: 'oklch(0.7 0.12 192)',
    glowColor: 'oklch(0.7 0.12 192 / 0.1)',
    alertColor: 'oklch(0.65 0.18 15)',
    components: [
      { key: 'drep_participation', label: 'DRep Participation' },
      { key: 'spo_participation', label: 'SPO Participation' },
      { key: 'citizen_engagement', label: 'Citizen Engagement' },
    ],
  },
  {
    category: 'Quality',
    color: 'oklch(0.75 0.12 80)',
    glowColor: 'oklch(0.75 0.12 80 / 0.1)',
    alertColor: 'oklch(0.65 0.18 15)',
    components: [
      { key: 'deliberation_quality', label: 'Deliberation Quality' },
      { key: 'governance_effectiveness', label: 'Governance Effectiveness' },
      { key: 'cc_constitutional_fidelity', label: 'CC Constitutional Fidelity' },
    ],
  },
  {
    category: 'Resilience',
    color: 'oklch(0.68 0.14 290)',
    glowColor: 'oklch(0.68 0.14 290 / 0.1)',
    alertColor: 'oklch(0.65 0.18 15)',
    components: [
      { key: 'power_distribution', label: 'Power Distribution' },
      { key: 'system_stability', label: 'System Stability' },
    ],
  },
  {
    category: 'Sustainability',
    color: 'oklch(0.75 0.14 85)',
    glowColor: 'oklch(0.75 0.14 85 / 0.1)',
    alertColor: 'oklch(0.65 0.18 15)',
    components: [
      { key: 'treasury_health', label: 'Treasury Health' },
      { key: 'governance_outcomes', label: 'Governance Outcomes' },
    ],
  },
];

/** Flatten for iteration with stagger index. */
const ALL_COMPONENTS = COMPONENT_GROUPS.flatMap((group) =>
  group.components.map((comp) => ({
    ...comp,
    category: group.category,
    color: group.color,
    glowColor: group.glowColor,
    alertColor: group.alertColor,
  })),
);

/* ──────────────────────────────────────────────
   SVG geometry
   ────────────────────────────────────────────── */

const MAIN_TRACE_HEIGHT = 80;
const COMPONENT_TRACE_HEIGHT = 42;
const COMPONENT_TRACE_GAP = 6;
const PADDING = { top: 8, right: 80, bottom: 4, left: 8 };

/** Build an SVG path `d` attribute from an array of values (0–100 scale). */
function buildTracePath(
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): string {
  if (values.length < 2) return '';

  const usableW = width - padding.left - padding.right;
  const usableH = height - padding.top - padding.bottom;
  const stepX = usableW / (values.length - 1);

  return values
    .map((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + usableH - (v / 100) * usableH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** Build a closed area path for the glow beneath a trace. */
function buildAreaPath(
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
): string {
  if (values.length < 2) return '';

  const linePath = buildTracePath(values, width, height, padding);
  const usableW = width - padding.left - padding.right;
  const stepX = usableW / (values.length - 1);
  const lastX = padding.left + (values.length - 1) * stepX;
  const baseline = height - padding.bottom;

  return `${linePath} L${lastX.toFixed(1)},${baseline} L${padding.left},${baseline} Z`;
}

/* ──────────────────────────────────────────────
   Count-up hook
   ────────────────────────────────────────────── */

function useCountUp(target: number, duration = 1500, enabled = true): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled]);

  return value;
}

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function TraceSkeleton({ expanded }: { expanded?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-16 rounded-lg" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-4 w-10" />
      </div>
      <Skeleton className={cn('w-full rounded-lg', expanded ? 'h-[80px]' : 'h-[60px]')} />
      {expanded && (
        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="w-full h-[24px] rounded" />
          ))}
        </div>
      )}
    </div>
  );
}

interface TraceLineProps {
  values: number[];
  svgWidth: number;
  height: number;
  strokeColor: string;
  glowColor: string;
  strokeWidth: number;
  drawProgress: number;
  isLive: boolean;
  isAnomaly?: boolean;
  alertColor?: string;
  delayIndex: number;
  reducedMotion: boolean | null;
}

function TraceLine({
  values,
  svgWidth,
  height,
  strokeColor,
  glowColor,
  strokeWidth,
  drawProgress,
  isLive,
  isAnomaly,
  alertColor,
  delayIndex,
  reducedMotion,
}: TraceLineProps) {
  const padding = useMemo(
    () => ({
      top: height > 40 ? PADDING.top : 3,
      right: PADDING.right,
      bottom: height > 40 ? PADDING.bottom : 3,
      left: PADDING.left,
    }),
    [height],
  );

  const d = useMemo(
    () => buildTracePath(values, svgWidth, height, padding),
    [values, svgWidth, height, padding],
  );
  const areaD = useMemo(
    () => buildAreaPath(values, svgWidth, height, padding),
    [values, svgWidth, height, padding],
  );

  if (!d) return null;

  const activeStroke = isAnomaly ? (alertColor ?? strokeColor) : strokeColor;
  const drawDelay = reducedMotion ? 0 : 0.3 + delayIndex * 0.08;

  return (
    <g>
      {/* Glow area beneath trace */}
      <motion.path
        d={areaD}
        fill={glowColor}
        initial={{ opacity: 0 }}
        animate={{ opacity: drawProgress > 0.1 ? 1 : 0 }}
        transition={{ duration: 0.4, delay: drawDelay }}
      />

      {/* Main trace line */}
      <motion.path
        d={d}
        fill="none"
        stroke={activeStroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reducedMotion ? drawProgress : 0 }}
        animate={{ pathLength: drawProgress }}
        transition={
          reducedMotion ? { duration: 0 } : { duration: 2, ease: 'easeInOut', delay: drawDelay }
        }
      />

      {/* Live pulse at the trace tip */}
      {isLive && drawProgress >= 0.95 && values.length > 0 && (
        <motion.circle
          cx={svgWidth - PADDING.right}
          cy={
            padding.top +
            (height - padding.top - padding.bottom) -
            (values[values.length - 1] / 100) * (height - padding.top - padding.bottom)
          }
          r={strokeWidth * 1.2}
          fill={activeStroke}
          animate={
            reducedMotion
              ? undefined
              : {
                  opacity: [1, 0.4, 1],
                  scale: [1, 1.6, 1],
                }
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Anomaly pulse overlay */}
      {isAnomaly && drawProgress >= 0.5 && (
        <motion.path
          d={d}
          fill="none"
          stroke={alertColor ?? strokeColor}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'blur(3px)' }}
          animate={reducedMotion ? undefined : { opacity: [0.6, 0.15, 0.6] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          initial={{ pathLength: drawProgress }}
        />
      )}
    </g>
  );
}

/* ──────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────── */

export function HealthVitalTracesPanel({
  expanded = false,
  position,
  isLive,
  narrative,
}: HealthVitalTracesPanelProps) {
  const { data: rawGhi, isLoading } = useGovernanceHealthIndex(20);
  const prefersReducedMotion = useReducedMotion();

  const ghi = rawGhi as GHIData | undefined;

  const score = ghi?.current?.score ?? 0;
  const band = ghi?.current?.band ?? 'fair';
  const trend = ghi?.trend;
  const rawComponentTrends = ghi?.componentTrends;
  const history = useMemo(() => ghi?.history ?? [], [ghi?.history]);

  const bandStyle = BAND_CONFIG[band] ?? BAND_CONFIG.fair;

  // Count-up animation for the score
  const displayScore = useCountUp(Math.round(score), 1500, !prefersReducedMotion && !isLoading);

  // Draw progress: controlled by playback position
  const drawProgress = Math.max(0, Math.min(1, position));

  // Extract main GHI trace from history
  const mainTraceValues = useMemo(() => {
    if (history.length === 0) return [];
    return history.map((h) => Math.max(0, Math.min(100, h.score)));
  }, [history]);

  // Extract per-component traces from history.
  // History components are arrays of {name, value, ...} — match by label.
  const componentTraces = useMemo(() => {
    const traces: Record<string, number[]> = {};
    for (const comp of ALL_COMPONENTS) {
      traces[comp.key] = history.map((h) => {
        const arr = Array.isArray(h.components) ? h.components : [];
        const match = arr.find((c) => c.name === comp.label);
        const val = match?.value;
        return val != null ? Math.max(0, Math.min(100, val)) : 50;
      });
    }
    return traces;
  }, [history]);

  // Build anomaly map and current values from componentTrends (object keyed by display name).
  const { anomalyMap, currentValues } = useMemo(() => {
    const aMap: Record<string, boolean> = {};
    const cVals: Record<string, number> = {};
    if (rawComponentTrends && typeof rawComponentTrends === 'object') {
      for (const comp of ALL_COMPONENTS) {
        const trend = rawComponentTrends[comp.label];
        if (trend) {
          aMap[comp.key] = Math.abs(trend.delta) > 5;
        }
      }
    }
    // Get current values from the latest history point or current.components
    const latestComponents =
      ghi?.current?.components ?? (history[0]?.components ? history[0].components : []);
    if (Array.isArray(latestComponents)) {
      for (const comp of ALL_COMPONENTS) {
        const match = latestComponents.find((c: GHIHistoryComponent) => c.name === comp.label);
        if (match) cVals[comp.key] = match.value;
      }
    }
    return { anomalyMap: aMap, currentValues: cVals };
  }, [rawComponentTrends, ghi?.current?.components, history]);

  // SVG dimensions
  const svgWidth = 600;
  const componentSectionHeight =
    ALL_COMPONENTS.length * (COMPONENT_TRACE_HEIGHT + COMPONENT_TRACE_GAP);
  const totalHeight = expanded
    ? MAIN_TRACE_HEIGHT + 16 + componentSectionHeight
    : MAIN_TRACE_HEIGHT + 8 + componentSectionHeight;

  // Trend display
  const trendDirection = trend?.direction ?? 'flat';
  const trendDelta = trend?.delta ?? 0;
  const TrendIcon =
    trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;
  const trendColorClass =
    trendDirection === 'up'
      ? 'text-emerald-400'
      : trendDirection === 'down'
        ? 'text-rose-400'
        : 'text-muted-foreground';

  if (isLoading) {
    return <TraceSkeleton expanded={expanded} />;
  }

  return (
    <div className="space-y-2">
      {/* Seneca narrative */}
      {expanded && narrative && (
        <div className="mb-2 flex items-start gap-2 rounded-lg bg-muted/20 px-4 py-3">
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/40 mt-0.5" />
          <p className="text-sm italic leading-relaxed text-muted-foreground">{narrative}</p>
        </div>
      )}

      {/* Score header */}
      <div className="flex items-center gap-3">
        {/* Large GHI number */}
        <div className="flex items-baseline gap-1">
          <span className={cn('text-3xl font-bold tabular-nums leading-none', bandStyle.textClass)}>
            {displayScore}
          </span>
          <span className="text-xs text-muted-foreground font-medium">/100</span>
        </div>

        {/* Band badge */}
        <span
          className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
            bandStyle.bgClass,
            bandStyle.textClass,
          )}
        >
          {bandStyle.label}
        </span>

        {/* Trend arrow + delta */}
        {trendDelta !== 0 && (
          <span
            className={cn('inline-flex items-center gap-0.5 text-xs font-medium', trendColorClass)}
          >
            <TrendIcon className="h-3 w-3" />
            {trendDelta > 0 ? '+' : ''}
            {Math.round(trendDelta * 10) / 10}
          </span>
        )}

        {/* Live indicator */}
        {isLive && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
        )}
      </div>

      {/* SVG traces */}
      <svg
        viewBox={`0 0 ${svgWidth} ${totalHeight}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-label="Governance Health Index vital traces"
        role="img"
      >
        <defs>
          {/* Gradient for main trace glow */}
          <linearGradient id="vt-main-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={bandStyle.color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={bandStyle.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Main GHI heartbeat trace */}
        <g>
          <TraceLine
            values={mainTraceValues}
            svgWidth={svgWidth}
            height={MAIN_TRACE_HEIGHT}
            strokeColor={bandStyle.stroke}
            glowColor={bandStyle.glow}
            strokeWidth={2.5}
            drawProgress={drawProgress}
            isLive={isLive}
            delayIndex={0}
            reducedMotion={prefersReducedMotion}
          />
        </g>

        {/* Component traces — stacked below the main trace */}
        {ALL_COMPONENTS.map((comp, idx) => {
          const yOffset =
            MAIN_TRACE_HEIGHT +
            (expanded ? 16 : 8) +
            idx * (COMPONENT_TRACE_HEIGHT + COMPONENT_TRACE_GAP);
          const values = componentTraces[comp.key] ?? [];
          const isAnomaly = anomalyMap[comp.key] ?? false;

          // Find the current value for the label
          const currentValue = currentValues[comp.key] ?? 0;

          return (
            <g key={comp.key} transform={`translate(0, ${yOffset})`}>
              <TraceLine
                values={values}
                svgWidth={svgWidth}
                height={COMPONENT_TRACE_HEIGHT}
                strokeColor={comp.color}
                glowColor={comp.glowColor}
                strokeWidth={1.2}
                drawProgress={drawProgress}
                isLive={isLive}
                isAnomaly={isAnomaly}
                alertColor={comp.alertColor}
                delayIndex={idx + 1}
                reducedMotion={prefersReducedMotion}
              />

              {/* Component label + value at the right end */}
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: drawProgress > 0.5 ? 1 : 0 }}
                transition={{ duration: 0.3, delay: prefersReducedMotion ? 0 : 0.5 + idx * 0.08 }}
              >
                <text
                  x={svgWidth - 3}
                  y={COMPONENT_TRACE_HEIGHT / 2 - 4}
                  textAnchor="end"
                  className="fill-muted-foreground"
                  style={{ fontSize: '9px' }}
                >
                  {comp.label}
                </text>
                <text
                  x={svgWidth - 3}
                  y={COMPONENT_TRACE_HEIGHT / 2 + 10}
                  textAnchor="end"
                  className="font-bold"
                  style={{
                    fontSize: '11px',
                    fill: isAnomaly
                      ? comp.alertColor
                      : currentValue >= 70
                        ? 'rgb(52,211,153)' // emerald-400
                        : currentValue >= 40
                          ? comp.color
                          : 'rgb(251,113,133)', // rose-400
                  }}
                >
                  {Math.round(currentValue)}
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>

      {/* Expanded mode: per-component detail (Phase 4 placeholder) */}
      {expanded && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-border/20">
          {COMPONENT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-1">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: group.color }}
              >
                {group.category}
              </span>
              {group.components.map((comp) => {
                const trendVal = rawComponentTrends?.[comp.label];
                const curVal = currentValues[comp.key] ?? 0;
                const delta = trendVal?.delta ?? 0;
                const isAnomaly = Math.abs(delta) > 5;

                return (
                  <div key={comp.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{comp.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          isAnomaly ? 'text-rose-400' : 'text-foreground',
                        )}
                      >
                        {Math.round(curVal)}
                      </span>
                      {delta !== 0 && (
                        <span
                          className={cn(
                            'text-[10px] tabular-nums',
                            delta > 0 ? 'text-emerald-400' : 'text-rose-400',
                          )}
                        >
                          {delta > 0 ? '+' : ''}
                          {Math.round(delta * 10) / 10}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Breathing animation keyframes for live mode */}
      <style>{`
        @keyframes vt-breathe {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
