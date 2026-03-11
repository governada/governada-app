'use client';

import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  AlertTriangle,
  Archive,
  Users,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BORDER, TIER_BG, TIER_GLOW, tierKey } from './tierStyles';
import { TierBadge } from './TierBadge';
import { ScoreExplainer } from '@/components/ui/ScoreExplainer';

export interface CivicaSPOData {
  poolId: string;
  ticker: string | null;
  poolName: string | null;
  governanceScore: number | null;
  voteCount: number;
  participationPct: number | null;
  consistencyPct?: number | null;
  reliabilityPct?: number | null;
  deliberationPct?: number | null;
  governanceIdentityPct?: number | null;
  confidence?: number | null;
  delegatorCount: number;
  liveStakeAda: number;
  claimedBy?: string | null;
  governanceStatement?: string | null;
  poolStatus?: string | null;
  scoreMomentum?: number | null;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

/** Returns the top 1-2 governance strengths (scores >= 60) as citizen-friendly labels. */
export function getPoolStrengths(pool: CivicaSPOData): string[] {
  const pillars: [string, number][] = [
    ['Active voter', pool.participationPct ?? 0],
    ['Thoughtful', pool.deliberationPct ?? 0],
    ['Reliable', pool.reliabilityPct ?? 0],
    ['Clear identity', pool.governanceIdentityPct ?? 0],
  ];
  return pillars
    .filter(([, v]) => v >= 60)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);
}

interface CivicaSPOCardProps {
  pool: CivicaSPOData;
  rank?: number;
}

export function CivicaSPOCard({ pool, rank }: CivicaSPOCardProps) {
  const score = pool.governanceScore ?? 0;
  const tier = tierKey(computeTier(score));
  const isProvisional = pool.confidence != null && pool.confidence < 60;
  const isRetired = pool.poolStatus === 'retired';
  const isRetiring = pool.poolStatus === 'retiring';
  const momentum = pool.scoreMomentum ?? null;
  const strengths = getPoolStrengths(pool);

  const displayName = pool.ticker
    ? pool.ticker
    : pool.poolName || `${pool.poolId.slice(0, 16)}\u2026`;

  const subtitle =
    pool.ticker && pool.poolName && pool.poolName !== pool.ticker ? pool.poolName : null;

  const statementPreview = pool.governanceStatement
    ? pool.governanceStatement.length > 100
      ? `${pool.governanceStatement.slice(0, 100)}\u2026`
      : pool.governanceStatement
    : null;

  return (
    <Link
      href={`/pool/${pool.poolId}`}
      aria-label={`${displayName}, governance score ${score}, ${tier} tier`}
      className={cn(
        'group relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 backdrop-blur-md',
        'hover:shadow-lg hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        TIER_BG[tier],
        TIER_BORDER[tier],
        TIER_GLOW[tier],
      )}
    >
      {/* ── Tier accent bar ──────────────────────────────────────── */}
      <div
        className={cn(
          'h-[2px]',
          tier === 'Emerging' && 'bg-border',
          tier === 'Bronze' && 'bg-gradient-to-r from-amber-500/60 to-amber-500/10',
          tier === 'Silver' && 'bg-gradient-to-r from-slate-400/60 to-slate-400/10',
          tier === 'Gold' && 'bg-gradient-to-r from-yellow-500/70 to-yellow-500/10',
          tier === 'Diamond' && 'bg-gradient-to-r from-cyan-500/70 to-cyan-500/10',
          tier === 'Legendary' && 'bg-gradient-to-r from-violet-500/70 to-violet-500/10',
        )}
      />

      {/* ── Card body ────────────────────────────────────────────── */}
      <div className="flex flex-col p-4 flex-1">
        {/* Header: name + score */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            {rank != null && (
              <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                #{rank}
              </span>
            )}
            <h3 className="font-semibold text-[15px] text-foreground truncate leading-tight group-hover:text-primary/90 transition-colors">
              {displayName}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-start gap-0.5 justify-end">
              <ScoreExplainer type="spo" className="mt-1" />
              <div
                className={cn(
                  'font-display text-2xl font-bold tabular-nums leading-none',
                  TIER_SCORE_COLOR[tier],
                )}
              >
                {score}
              </div>
            </div>
            <div className="flex items-center justify-end gap-1 mt-1">
              <TierBadge tier={tier} />
              {isProvisional && <AlertTriangle className="h-2.5 w-2.5 text-amber-500" />}
            </div>
          </div>
        </div>

        {/* Status badges */}
        {(isRetired || isRetiring) && (
          <div className="flex items-center gap-1.5 mb-2">
            {isRetired && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded-full">
                <Archive className="h-3 w-3" /> Retired
              </span>
            )}
            {isRetiring && (
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="h-3 w-3" /> Retiring
              </span>
            )}
          </div>
        )}

        {/* Strength labels */}
        {strengths.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {strengths.map((label) => (
              <span
                key={label}
                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Governance statement preview */}
        {statementPreview && (
          <p className="text-[11px] text-muted-foreground/80 italic leading-relaxed mb-2 line-clamp-2">
            &ldquo;{statementPreview}&rdquo;
          </p>
        )}

        {/* Key metrics row */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-2 flex-wrap">
          <span className="tabular-nums font-medium">
            {pool.voteCount} vote{pool.voteCount !== 1 ? 's' : ''}
          </span>
          {pool.participationPct != null && (
            <span className="tabular-nums">{Math.round(pool.participationPct)}% participation</span>
          )}
          {pool.delegatorCount > 0 && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Users className="h-3 w-3" />
              {pool.delegatorCount.toLocaleString()}
            </span>
          )}
          {pool.liveStakeAda > 0 && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Coins className="h-3 w-3" />₳{formatAda(pool.liveStakeAda)}
            </span>
          )}
        </div>

        {/* Footer: momentum + CTA */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              {momentum !== null && momentum > 0.5 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              ) : momentum !== null && momentum < -0.5 ? (
                <TrendingDown className="h-3 w-3 text-rose-400" aria-hidden="true" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground/40" aria-hidden="true" />
              )}
            </span>
            {isProvisional && <span className="text-amber-500/80">Provisional</span>}
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}
