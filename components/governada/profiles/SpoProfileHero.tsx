'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { AccentProvider } from '@/components/AccentProvider';
import { Badge } from '@/components/ui/badge';
import {
  type AlignmentScores,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
  getPersonalityLabel,
} from '@/lib/drepIdentity';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { Users, Award, Archive, ShieldCheck } from 'lucide-react';
import { tierKey, TIER_BADGE_BG, TIER_SCORE_COLOR } from '@/components/governada/cards/tierStyles';
import type { TierName } from '@/lib/scoring/tiers';

interface SpoProfileHeroProps {
  name: string;
  ticker: string | null;
  score: number;
  tier: TierName;
  rank: number | null;
  delegatorCount: number;
  participationRate: number;
  alignments: AlignmentScores;
  narrative: string | null;
  isRetired?: boolean;
  isRetiring?: boolean;
  isClaimed?: boolean;
  children?: React.ReactNode;
}

export function SpoProfileHero({
  name,
  ticker,
  score,
  tier,
  rank,
  delegatorCount,
  participationRate,
  alignments,
  narrative,
  isRetired,
  isRetiring,
  isClaimed,
  children,
}: SpoProfileHeroProps) {
  const hasAlignment =
    alignments.treasuryConservative != null ||
    alignments.treasuryGrowth != null ||
    alignments.decentralization != null ||
    alignments.security != null ||
    alignments.innovation != null ||
    alignments.transparency != null;

  const dominant = getDominantDimension(alignments);
  const identityColor = hasAlignment ? getIdentityColor(dominant) : null;
  const gradient = hasAlignment ? getIdentityGradient(dominant) : undefined;
  const personality = hasAlignment ? getPersonalityLabel(alignments) : null;
  const tk = tierKey(tier);

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  const inner = (
    <div ref={heroRef}>
      {/* Identity gradient background with parallax */}
      {gradient && (
        <motion.div
          className="absolute inset-0 -mx-4 sm:-mx-6 lg:-mx-8 pointer-events-none"
          style={{ background: gradient, y: bgY, willChange: 'transform' }}
          aria-hidden
        />
      )}

      <motion.div
        className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 py-8 lg:py-12"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Left: Identity + stats */}
        <motion.div className="space-y-4" variants={fadeInUp}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
                {name.length > 40 ? name.slice(0, 40) + '\u2026' : name}
              </h1>
              {ticker && (
                <Badge variant="outline" className="text-cyan-500 border-cyan-500/40 font-mono">
                  {ticker.toUpperCase()}
                </Badge>
              )}
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  TIER_BADGE_BG[tk],
                )}
              >
                {tier}
              </span>
              {isRetired && (
                <Badge
                  variant="outline"
                  className="text-muted-foreground border-muted-foreground/40 gap-1"
                >
                  <Archive className="h-3 w-3" />
                  Retired
                </Badge>
              )}
              {isRetiring && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/40 gap-1">
                  <Archive className="h-3 w-3" />
                  Retiring
                </Badge>
              )}
              {isClaimed && (
                <Badge variant="outline" className="text-primary border-primary/40 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Claimed
                </Badge>
              )}
            </div>

            {personality && (
              <p
                className="text-lg font-medium font-mono"
                style={{ color: identityColor?.hex ?? 'inherit' }}
              >
                {personality}
              </p>
            )}
          </div>

          {/* Narrative */}
          {narrative && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{narrative}</p>
          )}

          {/* Key stats — 3 only: rank, participation %, delegators */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2">
            {rank !== null && (
              <span className="flex items-center gap-1.5">
                <Award
                  className="h-4 w-4"
                  style={{ color: identityColor?.hex ?? 'currentColor' }}
                />
                <span className="font-mono font-medium text-foreground">Top {100 - rank}%</span>
                of SPOs
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span
                className="h-4 w-4 inline-flex items-center justify-center text-[11px] font-bold"
                style={{ color: identityColor?.hex ?? 'currentColor' }}
              >
                %
              </span>
              <span className="font-mono font-medium text-foreground">{participationRate}%</span>
              participation
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" style={{ color: identityColor?.hex ?? 'currentColor' }} />
              <span className="font-mono font-medium text-foreground">
                {delegatorCount.toLocaleString()}
              </span>
              delegators
            </span>
          </div>

          {/* Actions slot */}
          {children && <div className="pt-2 flex flex-wrap gap-2">{children}</div>}
        </motion.div>

        {/* Right: Signature visual — GovernanceRadar only */}
        {hasAlignment && (
          <motion.div
            className="flex items-center justify-center lg:justify-end"
            variants={fadeInUp}
          >
            <GovernanceRadar alignments={alignments} size="full" />
          </motion.div>
        )}

        {/* Fallback when no alignment: just the score */}
        {!hasAlignment && (
          <motion.div
            className="flex items-center justify-center lg:justify-end"
            variants={fadeInUp}
          >
            <div className="text-center space-y-1">
              <span
                className={cn('font-display text-5xl font-bold tabular-nums', TIER_SCORE_COLOR[tk])}
              >
                {score}
              </span>
              <p className="text-xs text-muted-foreground">governance score</p>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );

  if (hasAlignment) {
    return (
      <AccentProvider dimension={dominant} className="relative">
        {inner}
      </AccentProvider>
    );
  }

  return <div className="relative">{inner}</div>;
}
