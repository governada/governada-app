'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Share2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { getDominantDimension, getDimensionLabel } from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface GovernanceIdentityCardProps {
  personalityLabel: string;
  identityColor: string;
  alignments: AlignmentScores;
  onShare?: () => void;
  onContinue?: () => void;
}

/* ─── Helpers ───────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getShortDescription(alignments: AlignmentScores): string {
  const dominant = getDominantDimension(alignments);
  const descriptions: Record<AlignmentDimension, string> = {
    treasuryConservative: 'You prioritize fiscal responsibility and careful treasury stewardship.',
    treasuryGrowth: 'You champion strategic investment and ecosystem growth.',
    decentralization: 'You stand for distributed power and community autonomy.',
    security: 'You value protocol safety and network resilience above all.',
    innovation: 'You push for progress, experimentation, and bold change.',
    transparency: 'You demand openness, accountability, and clear governance.',
  };
  return descriptions[dominant];
}

/* ─── Component ─────────────────────────────────────────── */

export function GovernanceIdentityCard({
  personalityLabel,
  identityColor,
  alignments,
  onShare,
  onContinue,
}: GovernanceIdentityCardProps) {
  const [r, g, b] = hexToRgb(identityColor);
  const description = getShortDescription(alignments);
  const dominantLabel = getDimensionLabel(getDominantDimension(alignments));
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 28 }
      }
      className={cn(
        'relative w-full rounded-2xl border bg-black/60 backdrop-blur-xl',
        'p-6 md:p-8 overflow-hidden',
      )}
      style={{
        borderColor: `rgba(${r}, ${g}, ${b}, 0.4)`,
        boxShadow: `0 0 30px rgba(${r}, ${g}, ${b}, 0.3)`,
      }}
    >
      {/* Entrance glow pulse */}
      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-2xl"
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            boxShadow: `inset 0 0 60px rgba(${r}, ${g}, ${b}, 0.25)`,
          }}
        />
      )}

      <div
        className="relative z-10 flex flex-col items-center text-center gap-4"
        aria-live="assertive"
      >
        {/* Preamble */}
        <p className="text-sm text-muted-foreground uppercase tracking-widest">You&apos;re a</p>

        {/* Archetype name */}
        <h2
          className="font-display text-2xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-tight"
          style={{ color: identityColor }}
        >
          {personalityLabel}
        </h2>

        {/* Short description */}
        <p className="text-sm md:text-base text-muted-foreground max-w-md">{description}</p>

        {/* Dominant dimension badge */}
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
            color: identityColor,
          }}
        >
          Strongest dimension: {dominantLabel}
        </span>

        {/* Mini radar */}
        <div className="my-2">
          <GovernanceRadar alignments={alignments} size="medium" animate={false} />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
          {onShare && (
            <Button
              variant="outline"
              onClick={onShare}
              aria-label="Share your governance identity"
              className="gap-2 min-h-[44px] w-full sm:w-auto"
            >
              <Share2 className="h-4 w-4" />
              Share your governance identity
            </Button>
          )}
          {onContinue && (
            <Button
              onClick={onContinue}
              className="gap-2 min-h-[44px] w-full sm:w-auto"
              style={{
                backgroundColor: identityColor,
                color: '#fff',
              }}
            >
              See your matches
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
