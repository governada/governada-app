'use client';

/**
 * TreasurySankeyPanel — Two-lens treasury view for the Observatory.
 *
 * Compact mode: Reservoir headline + Budget Window NCL bar + top pending proposal.
 * Expanded mode: Full two-lens layout with Sankey flows, NCL budget detail,
 *   pending proposals, and unified Treasury Futures interactive tool.
 *
 * Lens 1 "The Reservoir" — total balance, runway, historical spending categories.
 * Lens 2 "The Budget Window" — NCL utilization, pending proposals, projected impact.
 */

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Landmark,
  CircleDollarSign,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useTreasuryCurrent,
  useTreasuryCategories,
  useTreasuryNcl,
  useTreasuryPending,
} from '@/hooks/queries';
import { formatAda } from '@/lib/treasury';

// Lazy-load heavy interactive component only in expanded mode
const TreasuryFutures = dynamic(() => import('@/components/treasury/TreasuryFutures'), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreasurySankeyPanelProps {
  expanded?: boolean;
  position: number;
  isLive: boolean;
  /** AI-generated Seneca narrative for the treasury drilldown */
  narrative?: string | null;
}

interface CategoryFlow {
  category: string;
  totalAda: number;
  proposalCount: number;
  pctOfTotal: number;
  color: string;
}

interface PendingProposal {
  txHash: string;
  index: number;
  title: string;
  withdrawalAda: number;
  pctOfBalance: number;
  treasuryTier: string;
  proposedEpoch: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  Development: '#06b6d4',
  Community: '#10b981',
  Security: '#f59e0b',
  Research: '#8b5cf6',
  Operations: '#94a3b8',
  Other: '#71717a',
};

const CATEGORY_BG_CLASSES: Record<string, string> = {
  Development: 'bg-cyan-500/15 text-cyan-400',
  Community: 'bg-emerald-500/15 text-emerald-400',
  Security: 'bg-amber-500/15 text-amber-400',
  Research: 'bg-violet-500/15 text-violet-400',
  Operations: 'bg-slate-400/15 text-slate-300',
  Other: 'bg-zinc-500/15 text-zinc-400',
};

const TIER_CLASSES: Record<string, string> = {
  major: 'bg-rose-500/15 text-rose-400',
  significant: 'bg-amber-500/15 text-amber-400',
  routine: 'bg-emerald-500/15 text-emerald-400',
};

const FLOW_ANIM_DURATION = 1.5;

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

function shortCategoryName(category: string): string {
  const key = matchCategoryKey(category);
  return key === 'Other' ? category : key;
}

// ---------------------------------------------------------------------------
// Animated number
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
// SVG Flow Visualization
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
      const sx = SOURCE_X + SOURCE_WIDTH;
      const tx = TARGET_X;
      const cp1x = sx + (tx - sx) * 0.4;
      const cp2x = sx + (tx - sx) * 0.6;
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
        areaPath,
        totalAda: cat.totalAda,
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
        <clipPath id="flow-reveal">
          <rect x={0} y={0} width={SVG_WIDTH * animProgress} height={totalHeight} />
        </clipPath>
      </defs>
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
// NCL Budget Bar (enhanced)
// ---------------------------------------------------------------------------

function NclBudgetBar({
  ncl,
  position,
  compact,
}: {
  ncl: {
    utilizationPct: number;
    projectedUtilizationPct: number;
    remainingAda: number;
    headroomAfterPendingAda: number;
    enactedWithdrawalsAda: number;
    pendingWithdrawalsAda: number;
    period: { nclAda: number; startEpoch: number; endEpoch: number };
    epochsRemaining: number;
    periodProgressPct: number;
    status: string;
  };
  position: number;
  compact?: boolean;
}) {
  const nclBudgetAda = ncl.period?.nclAda ?? 0;
  const enactedPct = nclBudgetAda > 0 ? ((ncl.enactedWithdrawalsAda ?? 0) / nclBudgetAda) * 100 : 0;
  const pendingPct = nclBudgetAda > 0 ? ((ncl.pendingWithdrawalsAda ?? 0) / nclBudgetAda) * 100 : 0;
  const displayEnacted = enactedPct * Math.min(position, 1);
  const displayPending = pendingPct * Math.min(position, 1);

  const statusColor =
    ncl.status === 'healthy'
      ? 'text-emerald-400'
      : ncl.status === 'elevated'
        ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <CircleDollarSign className="w-3 h-3" />
          Budget Window
          <span className="text-[10px] text-muted-foreground/60">
            Ep {ncl.period.startEpoch}–{ncl.period.endEpoch}
          </span>
        </span>
        <span className={cn('font-medium', statusColor)}>
          {formatAda(ncl.remainingAda)} remaining
        </span>
      </div>

      {/* Stacked bar: enacted (solid) + pending (striped) */}
      <div className="h-2.5 w-full rounded-full bg-muted/50 overflow-hidden relative">
        {/* Enacted portion */}
        <motion.div
          className="absolute inset-y-0 left-0 bg-amber-500 rounded-l-full"
          initial={{ width: 0 }}
          animate={{ width: `${displayEnacted}%` }}
          transition={{ duration: FLOW_ANIM_DURATION, ease: 'easeOut' }}
        />
        {/* Pending portion (dashed/striped) */}
        <motion.div
          className="absolute inset-y-0 bg-amber-500/40 rounded-r-full"
          style={{
            left: `${displayEnacted}%`,
            backgroundImage:
              'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${displayPending}%` }}
          transition={{ duration: FLOW_ANIM_DURATION, ease: 'easeOut', delay: 0.3 }}
        />
        {/* Time progress marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/30"
          style={{ left: `${ncl.periodProgressPct}%` }}
          title={`${ncl.epochsRemaining} epochs remaining`}
        />
      </div>

      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-amber-500" />
            Withdrawn: {formatAda(ncl.enactedWithdrawalsAda)}
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-sm bg-amber-500/40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, transparent, transparent 1px, rgba(255,255,255,0.15) 1px, rgba(255,255,255,0.15) 2px)',
              }}
            />
            Pending: {formatAda(ncl.pendingWithdrawalsAda)}
          </span>
          <span className="ml-auto tabular-nums">{ncl.epochsRemaining} epochs left</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending Proposals List
// ---------------------------------------------------------------------------

function PendingProposalsList({
  proposals,
  nclBudget,
  nclRemaining,
}: {
  proposals: PendingProposal[];
  nclBudget: number;
  nclRemaining: number;
}) {
  if (!proposals.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        Pending Proposals
      </p>
      {proposals.map((p) => {
        const pctOfBudget = nclBudget > 0 ? ((p.withdrawalAda ?? 0) / nclBudget) * 100 : 0;
        return (
          <div
            key={`${p.txHash}-${p.index}`}
            className="flex items-center gap-3 rounded-lg border border-border/20 bg-card/30 px-3 py-2"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{p.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatAda(p.withdrawalAda)}
                {nclBudget > 0 && (
                  <>
                    {' · '}
                    {pctOfBudget.toFixed(1)}% of NCL budget
                  </>
                )}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase',
                TIER_CLASSES[p.treasuryTier] ?? TIER_CLASSES.routine,
              )}
            >
              {p.treasuryTier}
            </span>
          </div>
        );
      })}
      {nclRemaining > 0 && nclBudget > 0 && (
        <p className="text-[10px] text-muted-foreground italic">
          If all pass, {formatAda(nclRemaining)} of {formatAda(nclBudget)} budget remains (
          {((nclRemaining / nclBudget) * 100).toFixed(0)}%)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SankeySkeleton() {
  return (
    <div className="space-y-3 p-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-[100px] w-full rounded-lg" />
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
  narrative,
}: TreasurySankeyPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const { data: currentData, isLoading: currentLoading } = useTreasuryCurrent();
  const { data: categoriesData, isLoading: categoriesLoading } = useTreasuryCategories();
  const { data: nclData, isLoading: nclLoading } = useTreasuryNcl();
  const { data: pendingData } = useTreasuryPending();

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
  const epoch = treasury?.epoch ?? 0;
  const trend = treasury?.trend ?? 'stable';

  // NCL data
  const nclRaw = nclData as { ncl?: Record<string, unknown> } | undefined;
  const ncl = (nclRaw?.ncl ?? null) as {
    utilizationPct: number;
    projectedUtilizationPct: number;
    remainingAda: number;
    headroomAfterPendingAda: number;
    enactedWithdrawalsAda: number;
    pendingWithdrawalsAda: number;
    period: { nclAda: number; startEpoch: number; endEpoch: number };
    epochsRemaining: number;
    periodProgressPct: number;
    status: string;
  } | null;

  // Pending proposals
  const pending = pendingData as
    | { proposals: PendingProposal[]; totalAda: number; pctOfTreasury: string }
    | undefined;
  const pendingProposals = pending?.proposals ?? [];

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

  const effectivePosition = isLive ? 1 : position;
  const TrendIcon = trend === 'growing' ? TrendingUp : trend === 'shrinking' ? TrendingDown : Minus;
  const trendColor =
    trend === 'growing'
      ? 'text-emerald-400'
      : trend === 'shrinking'
        ? 'text-red-400'
        : 'text-muted-foreground';

  if (isLoading) return <SankeySkeleton />;

  // ── Compact View ────────────────────────────────────────────────────────
  if (!expanded) {
    const runwayMonths = treasury?.runwayMonths ?? 0;
    const burnRate = treasury?.burnRatePerEpoch ?? 0;
    const runwayLabel =
      runwayMonths >= 999 || burnRate === 0
        ? 'Insufficient data'
        : runwayMonths >= 564
          ? `${Math.floor(runwayMonths / 12)}+ years`
          : `${runwayMonths}mo`;

    return (
      <div className="space-y-2.5 p-3">
        {/* Reservoir: balance headline */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-lg font-bold tabular-nums">
              <AnimatedAda value={balanceAda} position={effectivePosition} />
            </span>
            <span className={cn('flex items-center gap-0.5 text-xs', trendColor)}>
              <TrendIcon className="w-3 h-3" />
            </span>
          </div>
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

        {/* Runway estimate */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3 shrink-0" />
          <span>
            Runway: <span className="font-medium text-foreground">{runwayLabel}</span>
          </span>
        </div>

        {/* Budget Window: NCL bar */}
        {ncl && <NclBudgetBar ncl={ncl} position={effectivePosition} compact />}

        {/* Mini NCL utilization bar (when NCL data exists but no full bar) */}
        {ncl && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <CircleDollarSign className="w-3 h-3 shrink-0" />
            <span>NCL: {(ncl.utilizationPct ?? 0).toFixed(0)}% utilized</span>
            {ncl.epochsRemaining > 0 && (
              <span className="ml-auto tabular-nums">{ncl.epochsRemaining} ep left</span>
            )}
          </div>
        )}

        {/* Pending proposals with total ADA */}
        {pendingProposals.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate text-muted-foreground">
              {pendingProposals.length} pending
              {(pending?.totalAda ?? 0) > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-medium text-foreground">
                    {formatAda(pending?.totalAda ?? 0)}
                  </span>{' '}
                  requested
                </>
              )}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Expanded View ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-4">
      {/* Seneca narrative */}
      {narrative && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-muted/20 px-4 py-3">
          <ScrollText className="h-3.5 w-3.5 shrink-0 text-primary/40 mt-0.5" />
          <p className="text-sm italic leading-relaxed text-muted-foreground">{narrative}</p>
        </div>
      )}

      {/* ── LENS 1: The Reservoir ─────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            The Reservoir
          </h3>
          <span className="text-xs text-muted-foreground/60">Epoch {epoch}</span>
        </div>

        {/* Big balance + metrics */}
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold tabular-nums">
            <AnimatedAda value={balanceAda} position={effectivePosition} />
          </span>
          <span className={cn('flex items-center gap-0.5 text-sm', trendColor)}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{trend}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border/20 bg-card/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Runway</p>
            <p className="text-sm font-bold tabular-nums">
              {treasury && (treasury.runwayMonths >= 999 || treasury.burnRatePerEpoch === 0)
                ? 'Insufficient data'
                : `${treasury?.runwayMonths ?? 0}mo`}
            </p>
          </div>
          <div className="rounded-lg border border-border/20 bg-card/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">Treasury Health</p>
            <p className="text-sm font-bold tabular-nums">{treasury?.healthScore ?? 0}/100</p>
          </div>
        </div>

        {/* Spending categories flow */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Historical Spending
          </p>
          {categoryFlows.length > 0 ? (
            <>
              <FlowVisualization
                categories={categoryFlows}
                position={effectivePosition}
                prefersReducedMotion={prefersReducedMotion}
              />
              <div className="flex flex-wrap gap-1.5">
                {categoryFlows.map((cat) => (
                  <span
                    key={cat.category}
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full',
                      getCategoryBgClass(cat.category),
                    )}
                  >
                    {shortCategoryName(cat.category)}: {formatAda(cat.totalAda)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No treasury withdrawals recorded this epoch
            </p>
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border/20" />

      {/* ── LENS 2: The Budget Window ─────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Budget Window
          </h3>
          {ncl && (
            <span className="text-xs text-muted-foreground/60">
              {formatAda(ncl.period.nclAda)} · Ep {ncl.period.startEpoch}–{ncl.period.endEpoch}
            </span>
          )}
        </div>

        {ncl && <NclBudgetBar ncl={ncl} position={effectivePosition} />}

        {/* Budget metrics */}
        {ncl && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Utilized</p>
              <p className="text-sm font-bold tabular-nums">
                {(ncl.projectedUtilizationPct ?? 0).toFixed(1)}%
              </p>
              <p className="text-[9px] text-muted-foreground">if all pass</p>
            </div>
            <div className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Headroom</p>
              <p className="text-sm font-bold tabular-nums">
                {formatAda(ncl.headroomAfterPendingAda)}
              </p>
              <p className="text-[9px] text-muted-foreground">after pending</p>
            </div>
            <div className="rounded-lg border border-border/20 bg-card/30 px-2.5 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Window</p>
              <p className="text-sm font-bold tabular-nums">{ncl.epochsRemaining} ep</p>
              <p className="text-[9px] text-muted-foreground">remaining</p>
            </div>
          </div>
        )}

        {/* Pending proposals */}
        <PendingProposalsList
          proposals={pendingProposals}
          nclBudget={ncl?.period.nclAda ?? 0}
          nclRemaining={ncl?.headroomAfterPendingAda ?? 0}
        />
      </section>

      {/* Divider */}
      <div className="border-t border-border/20" />

      {/* ── Treasury Futures ─────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Treasury Futures
        </p>
        <TreasuryFutures />
      </section>
    </div>
  );
}
