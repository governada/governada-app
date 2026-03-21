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

/** Map archetype labels to rich descriptions. Falls back to dimension-based. */
function getArchetypeDescription(personalityLabel: string, alignments: AlignmentScores): string {
  const archetypeDescriptions: Record<string, string> = {
    'Treasury Guardian':
      "You prioritize careful stewardship of Cardano's treasury and believe in sustainable growth over rapid spending.",
    'Growth Catalyst':
      "You champion strategic investment to accelerate Cardano's ecosystem, believing bold bets today create tomorrow's network effects.",
    'Innovation Champion':
      'You push for technical progress and believe Cardano should lead through bold protocol upgrades and experimentation.',
    'Security Sentinel':
      'You believe protocol safety and network resilience are non-negotiable foundations that everything else is built on.',
    'Transparency Advocate':
      'You demand openness in every governance decision and believe accountability is the bedrock of legitimate governance.',
    'Decentralization Purist':
      'You stand for distributed power and community autonomy, resisting any concentration of control.',
    'Balanced Governor':
      'You weigh multiple governance dimensions carefully, seeking pragmatic outcomes rather than ideological purity.',
    'Fiscal Conservative':
      'You believe the treasury should be preserved for only the most impactful investments, with rigorous oversight on spending.',
    'Community Builder':
      "You focus on growing Cardano's community and believe governance should empower participation from everyone.",
    'Protocol Pioneer':
      'You believe Cardano should be at the cutting edge, pushing boundaries on what blockchain governance can achieve.',
  };

  if (archetypeDescriptions[personalityLabel]) {
    return archetypeDescriptions[personalityLabel];
  }

  // Fallback: use dominant dimension
  const dominant = getDominantDimension(alignments);
  const fallbacks: Record<AlignmentDimension, string> = {
    treasuryConservative: 'You prioritize fiscal responsibility and careful treasury stewardship.',
    treasuryGrowth: 'You champion strategic investment and ecosystem growth.',
    decentralization: 'You stand for distributed power and community autonomy.',
    security: 'You value protocol safety and network resilience above all.',
    innovation: 'You push for progress, experimentation, and bold change.',
    transparency: 'You demand openness, accountability, and clear governance.',
  };
  return fallbacks[dominant];
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
  const description = getArchetypeDescription(personalityLabel, alignments);
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
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
          Your Governance Identity
        </p>

        {/* Archetype name */}
        <h2
          className="font-display text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
          style={{ color: identityColor }}
        >
          {personalityLabel}
        </h2>

        {/* Rich description */}
        <p className="text-sm md:text-base text-white/80 max-w-md leading-relaxed">{description}</p>

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
