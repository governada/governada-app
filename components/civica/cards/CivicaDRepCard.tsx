'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BORDER, TIER_BG, TIER_GLOW, TIER_BADGE_BG, tierKey } from './tierStyles';
import type { EnrichedDRep } from '@/lib/koios';

const ALIGNMENT_LABELS: [keyof Pick<EnrichedDRep,
  'alignmentTreasuryConservative' | 'alignmentTreasuryGrowth' | 'alignmentDecentralization' |
  'alignmentSecurity' | 'alignmentInnovation' | 'alignmentTransparency'
>, string][] = [
  ['alignmentTreasuryConservative', 'Fiscal'],
  ['alignmentTreasuryGrowth', 'Growth'],
  ['alignmentDecentralization', 'Decent.'],
  ['alignmentSecurity', 'Security'],
  ['alignmentInnovation', 'Innov.'],
  ['alignmentTransparency', 'Transp.'],
];

interface CivicaDRepCardProps {
  drep: EnrichedDRep;
  rank?: number;
}

export function CivicaDRepCard({ drep, rank }: CivicaDRepCardProps) {
  const [hovered, setHovered] = useState(false);

  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const momentum = drep.scoreMomentum ?? null;
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 12)}…`;
  const hasAlignmentData = drep.alignmentDecentralization !== null;

  const allAlignmentNull =
    ALIGNMENT_LABELS.every(([key]) => (drep as any)[key] === null || (drep as any)[key] === undefined);

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      className={cn(
        'group relative flex flex-col rounded-xl border p-4 transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5',
        TIER_BG[tier],
        TIER_BORDER[tier],
        TIER_GLOW[tier],
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Header row ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          {rank && (
            <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums mb-0.5 block">
              #{rank}
            </span>
          )}
          <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
            {displayName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            {drep.isActive ? (
              <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Active
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <XCircle className="h-3 w-3" /> Inactive
              </span>
            )}
            {drep.delegatorCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                · {drep.delegatorCount.toLocaleString()} delegators
              </span>
            )}
          </div>
        </div>

        {/* Score + tier badge */}
        <div className="text-right shrink-0">
          <div className={cn('font-display text-3xl font-bold tabular-nums leading-none', TIER_SCORE_COLOR[tier])}>
            {score}
          </div>
          <span className={cn('text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-1 inline-block', TIER_BADGE_BG[tier])}>
            {tier}
          </span>
        </div>
      </div>

      {/* ── Alignment mini-bars ─────────────────────────────── */}
      {!allAlignmentNull && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 mb-3">
          {ALIGNMENT_LABELS.map(([key, label]) => {
            const v = (drep as any)[key] as number | null;
            if (v === null || v === undefined) return null;
            const pct = Math.round(v);
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex justify-between text-[9px] text-muted-foreground/70">
                  <span>{label}</span>
                  <span className="tabular-nums">{pct}</span>
                </div>
                <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/50"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Hover expansion: rationale + momentum ──────────── */}
      <div className={cn(
        'overflow-hidden transition-all duration-200',
        hovered ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0',
      )}>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40 mb-3">
          <span>
            Rationale rate:{' '}
            <span className="font-medium text-foreground">{Math.round(drep.rationaleRate ?? 0)}%</span>
          </span>
          <span className="flex items-center gap-1">
            Trend:{' '}
            {momentum !== null && momentum > 0.5 ? (
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            ) : momentum !== null && momentum < -0.5 ? (
              <TrendingDown className="h-3 w-3 text-rose-400" />
            ) : (
              <Minus className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
        </div>
      </div>

      {/* ── CTA ────────────────────────────────────────────── */}
      <div className="mt-auto pt-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/50">
          {drep.effectiveParticipation
            ? `${Math.round(drep.effectiveParticipation)}% participation`
            : 'No participation data'}
        </span>
        <span className={cn(
          'flex items-center gap-0.5 text-xs font-medium transition-colors',
          'text-muted-foreground group-hover:text-primary',
        )}>
          View <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
