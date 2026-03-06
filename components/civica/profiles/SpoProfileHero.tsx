'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { HexScore } from '@/components/HexScore';
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
import { Users, TrendingUp, Award, Server, Clock } from 'lucide-react';
import { tierKey, TIER_BADGE_BG, TIER_SCORE_COLOR } from '@/components/civica/cards/tierStyles';
import type { TierName } from '@/lib/scoring/tiers';

interface SpoProfileHeroProps {
  name: string;
  ticker: string | null;
  score: number;
  tier: TierName;
  rank: number | null;
  delegatorCount: number;
  liveStakeFormatted: string;
  voteCount: number;
  participationRate: number;
  alignments: AlignmentScores;
  narrative: string | null;
  scoreMomentum: number | null;
  lastVotedText: string | null;
  children?: React.ReactNode;
}

function formatMomentum(m: number): string {
  const prefix = m > 0 ? '+' : '';
  return `${prefix}${m.toFixed(1)} pts/epoch`;
}

export function SpoProfileHero({
  name,
  ticker,
  score,
  tier,
  rank,
  delegatorCount,
  liveStakeFormatted,
  voteCount,
  participationRate,
  alignments,
  narrative,
  scoreMomentum,
  lastVotedText,
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

          {/* Key stats */}
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
              <Users className="h-4 w-4" style={{ color: identityColor?.hex ?? 'currentColor' }} />
              <span className="font-mono font-medium text-foreground">
                {delegatorCount.toLocaleString()}
              </span>
              delegators
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp
                className="h-4 w-4"
                style={{ color: identityColor?.hex ?? 'currentColor' }}
              />
              <span className="font-mono font-medium text-foreground">{liveStakeFormatted}</span>
              ADA
            </span>
            <span className="flex items-center gap-1.5">
              <Server className="h-4 w-4" style={{ color: identityColor?.hex ?? 'currentColor' }} />
              <span className="font-mono font-medium text-foreground">{voteCount}</span>
              votes ({participationRate}%)
            </span>
            {scoreMomentum != null && scoreMomentum !== 0 && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium tabular-nums',
                  scoreMomentum > 0 ? 'text-emerald-400' : 'text-rose-400',
                )}
              >
                {formatMomentum(scoreMomentum)}
              </span>
            )}
            {lastVotedText && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs">{lastVotedText}</span>
              </span>
            )}
          </div>

          {/* Actions slot */}
          {children && <div className="pt-2 flex flex-wrap gap-2">{children}</div>}
        </motion.div>

        {/* Right: Signature visuals */}
        {hasAlignment && (
          <motion.div
            className="flex items-center gap-6 lg:gap-4 justify-center lg:justify-end"
            variants={fadeInUp}
          >
            <GovernanceRadar alignments={alignments} size="full" />
            <div className="hidden sm:block">
              <HexScore score={score} alignments={alignments} size="hero" />
            </div>
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
