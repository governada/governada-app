'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Share2, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import {
  getDominantDimension,
  getDimensionLabel,
  getDimensionOrder,
  alignmentsToArray,
} from '@/lib/drepIdentity';
import { cn } from '@/lib/utils';
import { loadAlignmentHistory } from '@/lib/matchStore';
import { AlignmentEvolution } from '@/components/intelligence/AlignmentEvolution';

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

/* ─── Where You Fit — community centroid comparison ───── */

interface PulseResponse {
  totalSessions: number;
  communityCentroid: number[];
}

function WhereYouFit({
  alignments,
  identityColor,
}: {
  alignments: AlignmentScores;
  identityColor: string;
}) {
  const { data } = useQuery<PulseResponse>({
    queryKey: ['community-pulse-lite'],
    queryFn: async () => {
      const res = await fetch('/api/community/pulse');
      if (!res.ok) throw new Error('Pulse fetch failed');
      return res.json();
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Only show when we have community data
  if (!data || data.totalSessions < 3) return null;

  const userVector = alignmentsToArray(alignments);
  const centroid = data.communityCentroid;
  const dimensions = getDimensionOrder();

  // Find the user's most distinctive dimension (largest positive deviation from centroid)
  let topDim: AlignmentDimension = dimensions[0];
  let topDeviation = 0;
  for (let i = 0; i < 6; i++) {
    const dev = Math.abs(userVector[i] - centroid[i]);
    if (dev > topDeviation) {
      topDeviation = dev;
      topDim = dimensions[i];
    }
  }

  // Compute percentile approximation: what % of the centroid is below this user's score
  const userScore = userVector[dimensions.indexOf(topDim)];
  const centroidScore = centroid[dimensions.indexOf(topDim)];
  const isAbove = userScore > centroidScore;
  // Simple approximation: distance from centroid mapped to a percentile
  const pctDev = Math.min(99, Math.max(1, Math.round(50 + topDeviation / 2)));
  const percentile = isAbove ? pctDev : 100 - pctDev;

  return (
    <div className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-center space-y-2">
      <p className="text-xs text-white/60">Where you fit</p>
      <p className="text-sm text-white/90">
        You&apos;re in the{' '}
        <span className="font-semibold" style={{ color: identityColor }}>
          top {100 - percentile}%
        </span>{' '}
        of citizens who prioritize <span className="font-medium">{getDimensionLabel(topDim)}</span>
      </p>
      {/* Mini centroid comparison bars */}
      <div className="flex gap-1 justify-center mt-1">
        {dimensions.map((dim, i) => {
          const userVal = userVector[i];
          const centroidVal = centroid[i];
          return (
            <div key={dim} className="flex flex-col items-center gap-0.5 w-8">
              <div className="w-full h-12 bg-white/[0.06] rounded-sm relative overflow-hidden">
                {/* Centroid bar */}
                <div
                  className="absolute bottom-0 left-0 w-1/2 bg-white/20 rounded-sm"
                  style={{ height: `${centroidVal}%` }}
                />
                {/* User bar */}
                <div
                  className="absolute bottom-0 right-0 w-1/2 rounded-sm"
                  style={{
                    height: `${userVal}%`,
                    backgroundColor: identityColor,
                    opacity: 0.7,
                  }}
                />
              </div>
              <span className="text-[8px] text-white/40 leading-none">
                {getDimensionLabel(dim).slice(0, 3)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-3 text-[9px] text-white/40">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-sm bg-white/20" /> Community
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-2 h-2 rounded-sm"
            style={{ backgroundColor: identityColor, opacity: 0.7 }}
          />{' '}
          You
        </span>
      </div>
    </div>
  );
}

/* ─── Alignment Evolution Section ───────────────────────── */

function AlignmentEvolutionSection() {
  const history = loadAlignmentHistory();
  const { data: pulse } = useQuery<PulseResponse>({
    queryKey: ['community-pulse-lite'],
    queryFn: async () => {
      const res = await fetch('/api/community/pulse');
      if (!res.ok) throw new Error('Pulse fetch failed');
      return res.json();
    },
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  if (history.length === 0) return null;

  return (
    <div className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] p-3">
      <AlignmentEvolution
        history={history.map((h) => ({
          alignments: h.alignments as unknown as Record<string, number>,
          archetype: h.archetype,
          epoch: h.epoch,
        }))}
        communityCentroid={pulse?.communityCentroid}
      />
    </div>
  );
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

        {/* Where you fit — community context */}
        <WhereYouFit alignments={alignments} identityColor={identityColor} />

        {/* Alignment evolution — shown when user has history */}
        <AlignmentEvolutionSection />

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
