'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeTier } from '@/lib/scoring/tiers';
import { TIER_SCORE_COLOR, TIER_BORDER, TIER_BG, TIER_GLOW, tierKey } from './tierStyles';
import { TierBadge } from './TierBadge';
import type { EnrichedDRep } from '@/lib/koios';
import { ScoreExplainer } from '@/components/ui/ScoreExplainer';
import {
  extractAlignments,
  getPersonalityLabel,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
} from '@/lib/drepIdentity';

/** Returns the top 1-2 pillar strengths (scores >= 65) as citizen-friendly labels. */
function getPillarStrengths(drep: EnrichedDRep): string[] {
  const pillars: [string, number][] = [
    ['Explains votes', drep.engagementQuality ?? 0],
    ['Active voter', drep.effectiveParticipationV3 ?? 0],
    ['Reliable', drep.reliabilityV3 ?? 0],
    ['Clear identity', drep.governanceIdentity ?? 0],
  ];
  return pillars
    .filter(([, v]) => v >= 65)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);
}

interface GovernadaDRepCardProps {
  drep: EnrichedDRep;
  rank?: number;
  matchScore?: number | null;
  endorsementCount?: number;
}

export function GovernadaDRepCard({
  drep,
  rank,
  matchScore,
  endorsementCount,
}: GovernadaDRepCardProps) {
  const score = drep.drepScore ?? 0;
  const tier = tierKey(computeTier(score));
  const momentum = drep.scoreMomentum ?? null;
  const displayName = drep.name || drep.ticker || drep.handle || `${drep.drepId.slice(0, 12)}…`;

  const alignments = extractAlignments(drep);
  const hasAlignment = drep.alignmentDecentralization !== null;
  const personalityLabel = hasAlignment ? getPersonalityLabel(alignments) : null;
  const dominantDim = hasAlignment ? getDominantDimension(alignments) : null;
  const identityColor = dominantDim ? getIdentityColor(dominantDim) : null;
  const identityGradient = dominantDim ? getIdentityGradient(dominantDim) : undefined;
  const pillarStrengths = getPillarStrengths(drep);

  return (
    <Link
      href={`/drep/${drep.drepId}`}
      aria-label={`${displayName}, DRep score ${score}, ${tier} tier${matchScore != null ? `, ${matchScore}% match` : ''}`}
      className={cn(
        'group relative flex flex-col rounded-xl border overflow-hidden transition-all duration-200 backdrop-blur-md',
        'hover:shadow-lg hover:-translate-y-0.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        TIER_BG[tier],
        TIER_BORDER[tier],
        TIER_GLOW[tier],
      )}
    >
      {/* ── Identity accent bar ──────────────────────────────────── */}
      <div
        className="h-[2px]"
        style={{
          background: identityColor
            ? `linear-gradient(90deg, ${identityColor.hex}80 0%, ${identityColor.hex}20 100%)`
            : undefined,
        }}
      />

      {/* ── Card body ────────────────────────────────────────────── */}
      <div className="flex flex-col p-4 flex-1" style={{ backgroundImage: identityGradient }}>
        {/* Top: rank + score + tier */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            {rank && (
              <span className="text-[10px] text-muted-foreground/50 font-medium tabular-nums">
                #{rank}
              </span>
            )}
            <h3 className="font-semibold text-[15px] text-foreground truncate leading-tight">
              {displayName}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-start gap-0.5 justify-end">
              <ScoreExplainer type="drep" className="mt-1" />
              <div
                className={cn(
                  'font-display text-2xl font-bold tabular-nums leading-none',
                  TIER_SCORE_COLOR[tier],
                )}
              >
                {score}
              </div>
            </div>
            <TierBadge tier={tier} className="mt-1" />
          </div>
        </div>

        {/* ── Personality archetype — the hero element ────────────── */}
        {personalityLabel && identityColor && (
          <div className="mb-3">
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border"
              style={{
                borderColor: `${identityColor.hex}30`,
                backgroundColor: `${identityColor.hex}08`,
                color: identityColor.hex,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: identityColor.hex,
                  boxShadow: `0 0 6px ${identityColor.hex}40`,
                }}
              />
              {personalityLabel}
            </span>
          </div>
        )}

        {/* ── Pillar strengths ─────────────────────────────────────── */}
        {pillarStrengths.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-3">
            {pillarStrengths.map((label) => (
              <span
                key={label}
                className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full"
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* ── Match score (only when sorting by match) ────────────── */}
        {matchScore != null && (
          <div className="mb-3">
            <span
              className={cn(
                'text-xs font-bold tabular-nums px-2 py-0.5 rounded-full',
                matchScore >= 70
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : matchScore >= 50
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {matchScore}% match
            </span>
          </div>
        )}

        {/* ── Footer stats + CTA ──────────────────────────────────── */}
        <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
            {drep.delegatorCount > 0 && (
              <span className="tabular-nums">
                {drep.delegatorCount.toLocaleString()} delegators
              </span>
            )}
            {endorsementCount != null && endorsementCount > 0 && (
              <span className="inline-flex items-center gap-0.5 tabular-nums">
                <Heart className="h-2.5 w-2.5 text-primary" aria-hidden="true" />
                {endorsementCount}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              {momentum !== null && momentum > 0.5 ? (
                <TrendingUp className="h-3 w-3 text-emerald-400" aria-hidden="true" />
              ) : momentum !== null && momentum < -0.5 ? (
                <TrendingDown className="h-3 w-3 text-rose-400" aria-hidden="true" />
              ) : (
                <Minus className="h-3 w-3 text-muted-foreground/40" aria-hidden="true" />
              )}
            </span>
          </div>
          <span
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium transition-colors',
              'text-muted-foreground group-hover:text-primary',
            )}
          >
            View <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
