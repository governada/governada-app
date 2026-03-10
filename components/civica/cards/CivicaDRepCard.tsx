'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeTier } from '@/lib/scoring/tiers';
import { getScoreNarrative } from '@/lib/scoring/scoreNarratives';
import { TIER_SCORE_COLOR, TIER_BORDER, TIER_BG, TIER_GLOW, tierKey } from './tierStyles';
import { TierBadge } from './TierBadge';
import type { EnrichedDRep } from '@/lib/koios';
import { ScoreExplainer } from '@/components/ui/ScoreExplainer';
import { getDRepTraitTags } from '@/lib/alignment';
import {
  extractAlignments,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
} from '@/lib/drepIdentity';

function formatRecency(lastVoteTime: number | null): string | null {
  if (!lastVoteTime) return null;
  const now = Date.now() / 1000;
  const diff = now - lastVoteTime;
  if (diff < 0) return null;
  const days = Math.floor(diff / 86400);
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

interface CivicaDRepCardProps {
  drep: EnrichedDRep;
  rank?: number;
  matchScore?: number | null;
}

export function CivicaDRepCard({ drep, rank, matchScore }: CivicaDRepCardProps) {
  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const momentum = drep.scoreMomentum ?? null;
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 12)}…`;

  const alignments = extractAlignments(drep);
  const hasAlignment = drep.alignmentDecentralization !== null;
  const personalityLabel = hasAlignment ? getPersonalityLabel(alignments) : null;
  const dominantDim = hasAlignment ? getDominantDimension(alignments) : null;
  const identityColor = dominantDim ? getIdentityColor(dominantDim) : null;
  const traitTags = getDRepTraitTags(drep);

  const recency = formatRecency(drep.lastVoteTime);
  const rationaleRate = Math.round(drep.rationaleRate ?? 0);
  const scoreNarrative = getScoreNarrative({ score, percentile: 0 });

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      aria-label={`${displayName}, DRep score ${score}, ${tier} tier${matchScore != null ? `, ${matchScore}% match` : ''}`}
      className={cn(
        'group relative flex flex-col rounded-xl border p-4 transition-all duration-200',
        'hover:shadow-lg hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        TIER_BG[tier],
        TIER_BORDER[tier],
        TIER_GLOW[tier],
      )}
    >
      {/* ── Header row ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          {rank && (
            <span className="text-[10px] text-muted-foreground/60 font-medium tabular-nums mb-0.5 block">
              #{rank}
            </span>
          )}
          <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
            {displayName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
            {recency && (
              <span className="text-[10px] text-muted-foreground">· Voted {recency}</span>
            )}
          </div>
        </div>

        {/* Score + tier badge */}
        <div className="text-right shrink-0">
          <div className="flex items-start gap-0.5 justify-end">
            <ScoreExplainer type="drep" className="mt-1" />
            <div
              className={cn(
                'font-display text-3xl font-bold tabular-nums leading-none',
                TIER_SCORE_COLOR[tier],
              )}
            >
              {score}
            </div>
          </div>
          <TierBadge tier={tier} className="mt-1" />
          {matchScore != null && (
            <span
              className={cn(
                'text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full mt-1 ml-1 inline-block',
                matchScore >= 70
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : matchScore >= 50
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {matchScore}% match
            </span>
          )}
        </div>
      </div>

      {/* ── Score narrative ──────────────────────────────────── */}
      <p className="text-xs text-muted-foreground mb-2">{scoreNarrative}</p>

      {/* ── Governance identity ───────────────────────────────── */}
      {(personalityLabel || traitTags.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          {personalityLabel && identityColor && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
              style={{
                borderColor: `${identityColor.hex}40`,
                backgroundColor: `${identityColor.hex}10`,
                color: identityColor.hex,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: identityColor.hex }}
              />
              {personalityLabel}
            </span>
          )}
          {traitTags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── Key stats (always visible) ────────────────────────── */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2 mb-2">
        <span>
          Rationale{' '}
          <span
            className={cn(
              'font-medium tabular-nums',
              rationaleRate >= 70
                ? 'text-emerald-400'
                : rationaleRate >= 40
                  ? 'text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {rationaleRate}%
          </span>
        </span>
        <span>
          Participation{' '}
          <span className="font-medium text-foreground tabular-nums">
            {drep.effectiveParticipation != null
              ? `${Math.round(drep.effectiveParticipation)}%`
              : '—'}
          </span>
        </span>
        <span className="flex items-center gap-0.5">
          {momentum !== null && momentum > 0.5 ? (
            <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
          ) : momentum !== null && momentum < -0.5 ? (
            <TrendingDown className="h-3 w-3 text-rose-400" aria-hidden="true" />
          ) : (
            <Minus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="sr-only">
            {momentum !== null && momentum > 0.5
              ? 'Trending up'
              : momentum !== null && momentum < -0.5
                ? 'Trending down'
                : 'Stable'}
          </span>
        </span>
      </div>

      {/* ── CTA ────────────────────────────────────────────── */}
      <div className="mt-auto flex items-center justify-end">
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
