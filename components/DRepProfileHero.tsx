'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { HexScore } from '@/components/HexScore';
import { AccentProvider } from '@/components/AccentProvider';
import { Badge } from '@/components/ui/badge';
import {
  type AlignmentScores,
  type AlignmentDimension,
  getDominantDimension,
  getIdentityColor,
  getIdentityGradient,
  getPersonalityLabel,
} from '@/lib/drepIdentity';
import { fadeInUp, staggerContainer } from '@/lib/animations';
import { cn } from '@/lib/utils';
import { Users, TrendingUp, Award } from 'lucide-react';

interface DRepProfileHeroProps {
  name: string;
  score: number;
  rank: number | null;
  delegatorCount: number;
  votingPowerFormatted: string;
  alignments: AlignmentScores;
  traitTags: string[];
  isActive: boolean;
  matchScore?: number | null;
  children?: React.ReactNode;
}

export function DRepProfileHero({
  name,
  score,
  rank,
  delegatorCount,
  votingPowerFormatted,
  alignments,
  traitTags,
  isActive,
  matchScore,
  children,
}: DRepProfileHeroProps) {
  const dominant = getDominantDimension(alignments);
  const identityColor = getIdentityColor(dominant);
  const gradient = getIdentityGradient(dominant);
  const personality = getPersonalityLabel(alignments);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <AccentProvider dimension={dominant} className="relative">
      <div ref={heroRef}>
        {/* Identity gradient background with parallax */}
        <motion.div
          className="absolute inset-0 -mx-4 sm:-mx-6 lg:-mx-8 pointer-events-none"
          style={{ background: gradient, y: bgY, willChange: 'transform' }}
          aria-hidden
        />

        <motion.div
          className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 lg:gap-12 py-8 lg:py-12"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Left: Identity + stats */}
          <motion.div className="space-y-4" variants={fadeInUp}>
            <div className="space-y-2">
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">{name}</h1>
              <p className="text-lg font-medium font-mono" style={{ color: identityColor.hex }}>
                {personality}
              </p>
              {matchScore != null && matchScore > 0 && (
                <p className="text-sm font-medium" style={{ color: identityColor.hex }}>
                  {matchScore}% match with your governance preferences
                </p>
              )}
            </div>

            {/* Trait tags */}
            {traitTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {traitTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn('text-xs', 'dark:border-border/60 dark:bg-card/50')}
                  >
                    {tag}
                  </Badge>
                ))}
                {!isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
              </div>
            )}

            {/* Key stats */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2">
              {rank !== null && (
                <span className="flex items-center gap-1.5">
                  <Award className="h-4 w-4" style={{ color: identityColor.hex }} />
                  <span className="font-mono font-medium text-foreground">#{rank}</span>
                  rank
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Users className="h-4 w-4" style={{ color: identityColor.hex }} />
                <span className="font-mono font-medium text-foreground">
                  {delegatorCount.toLocaleString()}
                </span>
                delegators
              </span>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" style={{ color: identityColor.hex }} />
                <span className="font-mono font-medium text-foreground">
                  {votingPowerFormatted}
                </span>
                ADA
              </span>
            </div>

            {/* Actions slot (delegation CTA, compare, etc.) */}
            {children && <div className="pt-2 flex flex-wrap gap-2">{children}</div>}
          </motion.div>

          {/* Right: Signature visuals */}
          <motion.div
            className="flex items-center gap-6 lg:gap-4 justify-center lg:justify-end"
            variants={fadeInUp}
          >
            <GovernanceRadar alignments={alignments} size="full" />
            <div className="hidden sm:block">
              <HexScore score={score} alignments={alignments} size="hero" />
            </div>
            <div className="block sm:hidden">
              <HexScore score={score} alignments={alignments} size="card" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AccentProvider>
  );
}
