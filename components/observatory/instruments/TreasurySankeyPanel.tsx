'use client';

/**
 * TreasurySankeyPanel — Sankey-style flow visualization of ADA
 * from the treasury through spending categories to proposals.
 *
 * Compact mode: stylized CSS/SVG flow with count-up stats.
 * Expanded mode: full Sankey + scroll sections (Phase 4 placeholder).
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Wallet, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useTreasuryCurrent, useTreasuryCategories, useTreasuryNcl } from '@/hooks/queries';
import { formatAda } from '@/lib/treasury';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreasurySankeyPanelProps {
  expanded?: boolean;
  position: number;
  isLive: boolean;
}

interface CategoryFlow {
  category: string;
  totalAda: number;
  proposalCount: number;
  pctOfTotal: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maps category name prefixes to colors. API returns full names like "Development & Infrastructure". */
const CATEGORY_COLORS: Record<string, string> = {
  Development: '#06b6d4', // cyan-500
  Community: '#10b981', // emerald-500
  Security: '#f59e0b', // amber-500
  Research: '#8b5cf6', // violet-500
  Operations: '#94a3b8', // slate-400
  Other: '#71717a', // zinc-500
};

const CATEGORY_BG_CLASSES: Record<string, string> = {
  Development: 'bg-cyan-500/15 text-cyan-400',
  Community: 'bg-emerald-500/15 text-emerald-400',
  Security: 'bg-amber-500/15 text-amber-400',
  Research: 'bg-violet-500/15 text-violet-400',
  Operations: 'bg-slate-400/15 text-slate-300',
  Other: 'bg-zinc-500/15 text-zinc-400',
};

const FLOW_ANIM_DURATION = 1.5;

/** Match by prefix — "Development & Infrastructure" → "Development" */
function matchCategoryKey(category: string): string {
  for (const key of Object.keys(CATEGORY_COLORS)) {
    if (category.startsWith(key)) return key;
  }
  return 'Other';
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[matchCategoryKey(category)] ?? CATEGORY_COLORS.Other;
}

function getCategoryBgClass(category: string): string {
  return CATEGORY_BG_CLASSES[matchCategoryKey(category)] ?? CATEGORY_BG_CLASSES.Other;
}

/** Short display name for flow labels */
function shortCategoryName(category: string): string {
  const key = matchCategoryKey(category);
  return key === 'Other' ? category : key;
}

// ---------------------------------------------------------------------------
// Animated number (count-up)
// ---------------------------------------------------------------------------

function AnimatedAda({
  value,
  position,
  className,
}: {
  value: number;
  position: number;
  className?: string;
}) {
  const displayed = value * Math.min(position, 1);
  return <span className={className}>{formatAda(displayed)}</span>;
}

// ---------------------------------------------------------------------------
// SVG Flow Visualization (compact)
// ---------------------------------------------------------------------------

const SVG_WIDTH = 480;
const SVG_HEIGHT = 200;
const SOURCE_X = 40;
const SOURCE_WIDTH = 16;
const TARGET_X = SVG_WIDTH - 56;
const TARGET_WIDTH = 16;
const FLOW_GAP = 4;
const MIN_FLOW_HEIGHT = 6;

function FlowVisualization({
  categories,
  position,
  prefersReducedMotion,
}: {
  categories: CategoryFlow[];
  position: number;
  prefersReducedMotion: boolean | null;
}) {
  const flows = useMemo(() => {
    if (!categories.length) return [];

    // Scale category amounts to SVG height
    const totalSpent = categories.reduce((s, c) => s + c.totalAda, 0);
    if (totalSpent === 0) return [];

    const usableHeight = SVG_HEIGHT - FLOW_GAP * (categories.length - 1) - 20;

    let sourceY = 10;
    let targetY = 10;

    return categories.map((cat) => {
      const pct = cat.totalAda / totalSpent;
      const height = Math.max(pct * usableHeight, MIN_FLOW_HEIGHT);

      const sY = sourceY;
      const tY = targetY;
      sourceY += height + FLOW_GAP;
      targetY += height + FLOW_GAP;

      // Curved path from source to target
      const sx = SOURCE_X + SOURCE_WIDTH;
      const tx = TARGET_X;
      const cp1x = sx + (tx - sx) * 0.4;
      const cp2x = sx + (tx - sx) * 0.6;

      const pathTop = `M ${sx} ${sY} C ${cp1x} ${sY}, ${cp2x} ${tY}, ${tx} ${tY}`;
      const pathBottom = `M ${sx} ${sY + height} C ${cp1x} ${sY + height}, ${cp2x} ${tY + height}, ${tx} ${tY + height}`;

      // Build a closed area path
      const areaPath = [
        `M ${sx} ${sY}`,
        `C ${cp1x} ${sY}, ${cp2x} ${tY}, ${tx} ${tY}`,
        `L ${tx} ${tY + height}`,
        `C ${cp2x} ${tY + height}, ${cp1x} ${sY + height}, ${sx} ${sY + height}`,
        'Z',
      ].join(' ');

      return {
        category: cat.category,
        color: getCategoryColor(cat.category),
        height,
        sourceY: sY,
        targetY: tY,
        pathTop,
        pathBottom,
        areaPath,
        totalAda: cat.totalAda,
        proposalCount: cat.proposalCount,
      };
    });
  }, [categories]);

  const totalHeight = useMemo(() => {
    if (!flows.length) return SVG_HEIGHT;
    const last = flows[flows.length - 1];
    return Math.max(last.sourceY + last.height + 10, SVG_HEIGHT);
  }, [flows]);

  const animProgress = prefersReducedMotion ? 1 : position;

  return (
    <svg
      viewBox={`0 0 ${SVG_WIDTH} ${totalHeight}`}
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {flows.map((f) => (
          <linearGradient
            key={`grad-${f.category}`}
            id={`flow-grad-${f.category}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={f.color} stopOpacity={0.6} />
            <stop offset="100%" stopColor={f.color} stopOpacity={0.25} />
          </linearGradient>
        ))}
        {/* Clip path for playback position reveal */}
        <clipPath id="flow-reveal">
          <rect x={0} y={0} width={SVG_WIDTH * animProgress} height={totalHeight} />
        </clipPath>
      </defs>

      {/* Source block (Treasury) */}
      <rect
        x={SOURCE_X}
        y={flows[0]?.sourceY ?? 10}
        width={SOURCE_WIDTH}
        height={
          flows.length
            ? flows[flows.length - 1].sourceY +
              flows[flows.length - 1].height -
              (flows[0]?.sourceY ?? 10)
            : totalHeight - 20
        }
        rx={4}
        className="fill-amber-500/80"
      />

      {/* Flows */}
      <g clipPath="url(#flow-reveal)">
        {flows.map((f) => (
          <g key={f.category}>
            <motion.path
              d={f.areaPath}
              fill={`url(#flow-grad-${f.category})`}
              initial={prefersReducedMotion ? undefined : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: FLOW_ANIM_DURATION, ease: 'easeOut' }}
            />
            {/* Flow label */}
            <text
              x={(SOURCE_X + SOURCE_WIDTH + TARGET_X) / 2}
              y={f.targetY + f.height / 2 + 3}
              textAnchor="middle"
              className="fill-current text-[9px] opacity-60"
              style={{ fill: f.color }}
            >
              {shortCategoryName(f.category)}
            </text>
          </g>
        ))}
      </g>

      {/* Target blocks (per-category) */}
      {flows.map((f) => (
        <rect
          key={`target-${f.category}`}
          x={TARGET_X}
          y={f.targetY}
          width={TARGET_WIDTH}
          height={f.height}
          rx={3}
          fill={f.color}
          opacity={0.7 * animProgress}
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NCL Progress Bar
// ---------------------------------------------------------------------------

function NclBar({ utilizationPct, position }: { utilizationPct: number; position: number }) {
  const displayPct = Math.min(utilizationPct * position, 100);
  const barColor =
    utilizationPct >= 90 ? 'bg-red-500' : utilizationPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">NCL Utilization</span>
        <span className="tabular-nums font-medium">{displayPct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${displayPct}%` }}
          transition={{ duration: FLOW_ANIM_DURATION, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact Stats Row
// ---------------------------------------------------------------------------

function StatsRow({
  balanceAda,
  pendingCount,
  trend,
  position,
}: {
  balanceAda: number;
  pendingCount: number;
  trend?: string;
  position: number;
}) {
  const TrendIcon = trend === 'growing' ? TrendingUp : trend === 'shrinking' ? TrendingDown : Minus;

  const trendColor =
    trend === 'growing'
      ? 'text-emerald-400'
      : trend === 'shrinking'
        ? 'text-red-400'
        : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-4 text-sm">
      {/* Balance */}
      <div className="flex items-center gap-1.5">
        <Wallet className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-muted-foreground">Balance:</span>
        <span className="font-semibold tabular-nums">
          <AnimatedAda value={balanceAda} position={position} />
        </span>
      </div>

      {/* Trend */}
      <div className={cn('flex items-center gap-1', trendColor)}>
        <TrendIcon className="w-3 h-3" />
        <span className="text-xs capitalize">{trend ?? 'stable'}</span>
      </div>

      {/* Pending */}
      <div className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">{pendingCount} pending</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Legend
// ---------------------------------------------------------------------------

function CategoryLegend({ categories }: { categories: CategoryFlow[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((cat) => (
        <div
          key={cat.category}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            getCategoryBgClass(cat.category),
          )}
        >
          <span>{cat.category}</span>
          <span className="opacity-60">{formatAda(cat.totalAda)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SankeySkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-[160px] w-full rounded-lg" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function TreasurySankeyPanel({
  expanded = false,
  position,
  isLive,
}: TreasurySankeyPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const { data: currentData, isLoading: currentLoading } = useTreasuryCurrent();
  const { data: categoriesData, isLoading: categoriesLoading } = useTreasuryCategories();
  const { data: nclData, isLoading: nclLoading } = useTreasuryNcl();

  const isLoading = currentLoading || categoriesLoading || nclLoading;

  // Parse treasury current data — API returns flat object
  const treasury = currentData as
    | {
        balance: number;
        epoch: number;
        pendingCount: number;
        pendingTotalAda: number;
        trend: string;
        runwayMonths: number;
        burnRatePerEpoch: number;
        healthScore: number;
      }
    | undefined;

  const balanceAda = treasury?.balance ?? 0;
  const pendingCount = treasury?.pendingCount ?? 0;
  const epoch = treasury?.epoch ?? 0;

  // Trend comes directly from API
  const trend = treasury?.trend ?? 'stable';

  // NCL data — API wraps in { ncl: ... }
  const nclRaw = nclData as { ncl?: Record<string, unknown> } | undefined;
  const ncl = (nclRaw?.ncl ?? null) as {
    utilizationPct: number;
    remainingAda: number;
    period: { nclAda: number };
    status: string;
    epochsRemaining: number;
  } | null;

  // Category flows
  const categoryFlows = useMemo<CategoryFlow[]>(() => {
    const cats = categoriesData?.categories ?? [];
    return cats
      .map((c) => ({
        category: c.category,
        totalAda: c.totalAda,
        proposalCount: c.proposalCount,
        pctOfTotal: c.pctOfTotal,
        color: getCategoryColor(c.category),
      }))
      .sort((a, b) => b.totalAda - a.totalAda)
      .slice(0, 6);
  }, [categoriesData?.categories]);

  // Effective animation position: in live mode, show everything
  const effectivePosition = isLive ? 1 : position;

  if (isLoading) {
    return <SankeySkeleton />;
  }

  return (
    <div className={cn('space-y-4', expanded ? 'p-4' : 'p-3')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold tracking-tight">Treasury Flow</h3>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              LIVE
            </span>
          )}
        </div>
        {expanded && <span className="text-xs text-muted-foreground">Epoch {epoch || '...'}</span>}
      </div>

      {/* Stats */}
      <StatsRow
        balanceAda={balanceAda}
        pendingCount={pendingCount}
        trend={trend}
        position={effectivePosition}
      />

      {/* Flow Visualization */}
      {categoryFlows.length > 0 && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <FlowVisualization
            categories={categoryFlows}
            position={effectivePosition}
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.div>
      )}

      {/* NCL Budget Utilization */}
      {ncl && <NclBar utilizationPct={ncl.utilizationPct} position={effectivePosition} />}

      {/* Category Legend */}
      {categoryFlows.length > 0 && <CategoryLegend categories={categoryFlows} />}

      {/* Expanded: runway + key metrics */}
      {expanded && treasury && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/30 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Runway
            </p>
            <p className="text-lg font-bold tabular-nums">
              {treasury.runwayMonths >= 999 ? '∞' : `${treasury.runwayMonths}mo`}
            </p>
          </div>
          <div className="rounded-lg border border-border/30 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Health
            </p>
            <p className="text-lg font-bold tabular-nums">{treasury.healthScore}/100</p>
          </div>
        </div>
      )}
    </div>
  );
}
