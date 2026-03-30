'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronDown, ChevronUp, ExternalLink, Vote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import { RationaleQuote } from './RationaleQuote';
import { generateMatchNarrative } from '@/lib/matching/matchNarrative';
import { DIMENSION_LABELS } from '@/lib/matching/dimensionAgreement';
import type { AlignmentScores, AlignmentDimension } from '@/lib/drepIdentity';
import { getDimensionOrder } from '@/lib/drepIdentity';
import type { ConstellationRef } from '@/lib/globe/types';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface MatchResultCardProps {
  match: {
    drepId: string;
    drepName: string | null;
    score: number;
    alignments: AlignmentScores;
    agreeDimensions: string[];
    differDimensions: string[];
    identityColor: string;
    tier?: string | null;
    matchingRationales?: Array<{
      proposalTitle: string;
      excerpt: string;
      similarity: number;
    }>;
  };
  rank: number;
  isBridge?: boolean;
  userAlignments: AlignmentScores;
  expanded: boolean;
  onExpand: () => void;
  onDelegate?: (drepId: string) => void;
  globeRef?: React.RefObject<ConstellationRef | null>;
}

/* ─── Helpers ───────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function computePerDimensionAgreement(
  userAlignments: AlignmentScores,
  drepAlignments: AlignmentScores,
): Array<{
  dim: AlignmentDimension;
  label: string;
  agreement: number;
  status: 'agree' | 'neutral' | 'differ';
}> {
  const dims = getDimensionOrder();
  return dims.map((dim) => {
    const userVal = userAlignments[dim] ?? 50;
    const drepVal = drepAlignments[dim] ?? 50;
    const agreement = Math.round(100 - Math.abs(userVal - drepVal));
    const status = agreement >= 70 ? 'agree' : agreement < 40 ? 'differ' : 'neutral';
    return { dim, label: DIMENSION_LABELS[dim], agreement, status };
  });
}

/* ─── Component ─────────────────────────────────────────── */

export function MatchResultCard({
  match,
  rank,
  isBridge = false,
  userAlignments,
  expanded,
  onExpand,
  onDelegate,
  globeRef,
}: MatchResultCardProps) {
  const hasPulsed = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const displayName = match.drepName || match.drepId.slice(0, 16) + '...';
  const scorePercent = Math.round(match.score);
  const [r, g, b] = hexToRgb(match.identityColor);

  const narrative = generateMatchNarrative({
    agreeDimensions: match.agreeDimensions,
    differDimensions: match.differDimensions,
    isBridge,
  });

  // Compute signature: the dimension where this DRep's score most exceeds the user's
  // This highlights what makes them uniquely strong for this citizen
  const perDimFull = computePerDimensionAgreement(userAlignments, match.alignments);
  const strongestDim = perDimFull.reduce((best, cur) => {
    const curStrength = match.alignments[cur.dim] ?? 50;
    const bestStrength = match.alignments[best.dim] ?? 50;
    // Prefer dimensions where DRep has a strong stance AND agrees with user
    const curScore = cur.status === 'agree' ? curStrength : curStrength * 0.5;
    const bestScore = best.status === 'agree' ? bestStrength : bestStrength * 0.5;
    return curScore > bestScore ? cur : best;
  });
  const signatureLabel = isBridge
    ? null
    : rank === 1
      ? `Top match — strongest on ${strongestDim.label}`
      : `Stands out on ${strongestDim.label}`;

  // Pulse globe node when card first appears
  useEffect(() => {
    if (!hasPulsed.current && globeRef?.current) {
      globeRef.current.pulseNode(match.drepId);
      hasPulsed.current = true;
    }
  }, [globeRef, match.drepId]);

  // Show differentiating dimensions: prioritize differ, then unique agree
  // If this DRep differs on something, show that — it's what makes them distinctive
  const collapsedBadges = [
    ...match.differDimensions.slice(0, 2).map((d) => ({ label: d, type: 'differ' as const })),
    ...(match.differDimensions.length < 2
      ? match.agreeDimensions.slice(0, 2 - match.differDimensions.length).map((d) => ({
          label: d,
          type: 'agree' as const,
        }))
      : []),
  ];

  const perDimension = computePerDimensionAgreement(userAlignments, match.alignments);

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { delay: rank * 0.2, type: 'spring', stiffness: 300, damping: 28 }
      }
      className={cn(
        'rounded-xl border bg-card/40 backdrop-blur-sm overflow-hidden transition-colors',
        isBridge ? 'border-violet-500/30' : 'border-white/[0.08]',
      )}
      style={expanded ? { boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, 0.3)` } : undefined}
    >
      {/* Bridge header */}
      {isBridge && (
        <div className="px-4 py-1.5 bg-violet-500/10 text-violet-400 text-xs font-medium">
          {match.differDimensions.length > 0
            ? `A different perspective on ${match.differDimensions[0]}`
            : 'A different perspective'}
        </div>
      )}

      {/* Collapsed view */}
      <button
        onClick={onExpand}
        className="w-full text-left px-4 py-3 min-h-[44px]"
        aria-expanded={expanded}
        aria-controls={`match-detail-${match.drepId}`}
      >
        <div className="flex items-center gap-3">
          {/* Rank badge */}
          <span
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0',
              isBridge && 'bg-violet-500',
            )}
            style={!isBridge ? { backgroundColor: match.identityColor } : undefined}
            aria-label={isBridge ? 'Bridge match' : `Match rank ${rank}`}
          >
            {isBridge ? '?' : rank}
          </span>

          {/* Name + tier */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-foreground truncate">{displayName}</span>
              {match.tier && (
                <span className="text-[10px] text-muted-foreground shrink-0">{match.tier}</span>
              )}
            </div>
          </div>

          {/* Score */}
          <span
            className="font-display text-2xl font-bold tabular-nums shrink-0"
            style={{ color: match.identityColor }}
          >
            {scorePercent}%
          </span>

          {/* Expand chevron */}
          <span className="text-muted-foreground shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>

        {/* Dimension badges */}
        {collapsedBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 ml-10">
            {collapsedBadges.map((badge) => (
              <span
                key={badge.label}
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                  badge.type === 'agree'
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-muted/30 text-muted-foreground',
                )}
              >
                {badge.label} {badge.type === 'agree' ? '\u2713' : '\u2717'}
              </span>
            ))}
          </div>
        )}

        {/* Signature — what makes this DRep uniquely relevant */}
        {signatureLabel && (
          <p
            className="text-[10px] font-medium mt-1.5 ml-10"
            style={{ color: match.identityColor }}
          >
            {signatureLabel}
          </p>
        )}

        {/* One-sentence narrative */}
        <p className="text-xs text-muted-foreground mt-1 ml-10 line-clamp-2">{narrative}</p>

        {/* Semantic match indicator */}
        {match.matchingRationales && match.matchingRationales.length > 0 && (
          <p className="text-xs text-primary mt-1 ml-10">Matched on your values</p>
        )}
      </button>

      {/* Expanded view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`match-detail-${match.drepId}`}
            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: 'easeInOut' }
            }
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/[0.06] pt-4">
              {/* Radar comparison: user vs DRep */}
              <div className="flex justify-center">
                <GovernanceRadar
                  alignments={userAlignments}
                  compareAlignments={match.alignments}
                  size="full"
                  animate
                />
              </div>

              {/* Per-dimension agreement bars */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Dimension agreement
                </p>
                {perDimension.map((d) => (
                  <div key={d.dim} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        'w-16 shrink-0 font-medium truncate',
                        d.status === 'agree'
                          ? 'text-green-400'
                          : d.status === 'differ'
                            ? 'text-amber-400'
                            : 'text-muted-foreground',
                      )}
                    >
                      {d.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          d.status === 'agree'
                            ? 'bg-green-500'
                            : d.status === 'differ'
                              ? 'bg-amber-500'
                              : 'bg-muted-foreground/40',
                        )}
                        style={{ width: `${d.agreement}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-muted-foreground">
                      {d.agreement}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Matching rationales from semantic search */}
              {match.matchingRationales && match.matchingRationales.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground/90">Why this match resonates</p>
                  {match.matchingRationales
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 2)
                    .map((rationale, i) => (
                      <RationaleQuote
                        key={i}
                        excerpt={rationale.excerpt}
                        proposalTitle={rationale.proposalTitle}
                        similarity={rationale.similarity}
                      />
                    ))}
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {onDelegate && (
                  <Button
                    onClick={() => onDelegate(match.drepId)}
                    className="gap-2 min-h-[44px] flex-1"
                    style={{
                      backgroundColor: match.identityColor,
                      color: '#fff',
                    }}
                  >
                    <Vote className="h-4 w-4" />
                    Delegate to this DRep
                  </Button>
                )}
                <Button variant="outline" asChild className="gap-2 min-h-[44px] flex-1">
                  <a href={`/drep/${encodeURIComponent(match.drepId)}`}>
                    View profile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
