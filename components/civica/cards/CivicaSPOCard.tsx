'use client';

import Link from 'next/link';
import { ShieldCheck, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeTier } from '@/lib/scoring/tiers';
import {
  TIER_SCORE_COLOR,
  TIER_BORDER,
  TIER_BG,
  TIER_GLOW,
  TIER_BADGE_BG,
  tierKey,
} from './tierStyles';
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
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${Math.round(ada / 1_000)}K`;
  return String(ada);
}

interface CivicaSPOCardProps {
  pool: CivicaSPOData;
  rank?: number;
}

export function CivicaSPOCard({ pool, rank }: CivicaSPOCardProps) {
  const score = pool.governanceScore ?? 0;
  const tier = tierKey(computeTier(score));
  const isClaimed = !!pool.claimedBy;
  const isProvisional = pool.confidence != null && pool.confidence < 60;

  const pillars: { label: string; value: number | null | undefined; weight: string }[] = [
    { label: 'Participation', value: pool.participationPct, weight: '35%' },
    { label: 'Deliberation', value: pool.deliberationPct, weight: '25%' },
    { label: 'Reliability', value: pool.reliabilityPct, weight: '25%' },
    { label: 'Identity', value: pool.governanceIdentityPct, weight: '15%' },
  ];

  const statementPreview = pool.governanceStatement
    ? pool.governanceStatement.length > 80
      ? `${pool.governanceStatement.slice(0, 80)}…`
      : pool.governanceStatement
    : null;

  return (
    <Link
      href={`/pool/${pool.poolId}`}
      aria-label={`${pool.ticker || pool.poolName || pool.poolId.slice(0, 16)}, governance score ${score}, ${tier} tier`}
      className={cn(
        'group relative flex flex-col rounded-xl border p-4 transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        TIER_BG[tier],
        TIER_BORDER[tier],
        TIER_GLOW[tier],
      )}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {rank && (
            <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums mb-0.5 block">
              #{rank}
            </span>
          )}
          <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
            {pool.ticker ? (
              <>
                <span className="font-bold">{pool.ticker}</span>
                {pool.poolName && pool.poolName !== pool.ticker && (
                  <span className="text-muted-foreground font-normal ml-1 text-xs">
                    {pool.poolName}
                  </span>
                )}
              </>
            ) : (
              pool.poolName || pool.poolId.slice(0, 16)
            )}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {isClaimed && (
              <span className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
                <ShieldCheck className="h-3 w-3" /> Claimed
              </span>
            )}
            {pool.delegatorCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {isClaimed ? '· ' : ''}
                {pool.delegatorCount.toLocaleString()} delegators
              </span>
            )}
            {pool.liveStakeAda > 0 && (
              <span className="text-[10px] text-muted-foreground">
                · ₳{formatAda(pool.liveStakeAda)}
              </span>
            )}
          </div>
        </div>

        {/* Score + tier */}
        <div className="text-right shrink-0">
          <div className="flex items-start gap-0.5 justify-end">
            <ScoreExplainer type="spo" className="mt-1" />
            <div
              className={cn(
                'font-display text-3xl font-bold tabular-nums leading-none',
                TIER_SCORE_COLOR[tier],
              )}
            >
              {score}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-block',
                TIER_BADGE_BG[tier],
              )}
            >
              {tier}
            </span>
            {isProvisional && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-500 font-medium">
                <AlertTriangle className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Governance statement preview ────────────────────── */}
      {statementPreview && (
        <p className="text-[10px] text-muted-foreground/80 italic leading-relaxed mb-2 line-clamp-2">
          &ldquo;{statementPreview}&rdquo;
        </p>
      )}

      {/* ── 4-Pillar bars ──────────────────────────────────────── */}
      {pillars.some((p) => p.value != null) && (
        <div className="space-y-1.5 mb-2">
          {pillars.map(({ label, value, weight }) => {
            if (value == null) return null;
            const pct = Math.round(value);
            return (
              <div key={label} className="space-y-0.5">
                <div className="flex justify-between text-[10px] text-muted-foreground/70">
                  <span>
                    {label} <span className="opacity-50">({weight})</span>
                  </span>
                  <span className="tabular-nums">{pct}%</span>
                </div>
                <div
                  className="h-0.5 rounded-full bg-muted overflow-hidden"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${pct}%`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: `hsl(var(--primary) / ${0.4 + pct / 250})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
          {pool.voteCount} governance votes
          {isProvisional && <span className="text-amber-500/80 ml-1">· Provisional</span>}
        </span>
        <span
          className={cn(
            'flex items-center gap-0.5 text-xs font-medium transition-colors',
            'text-muted-foreground group-hover:text-primary',
          )}
        >
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
