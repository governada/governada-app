'use client';

/**
 * MatchResultOverlay — Celebratory overlay card for the #1 DRep match.
 *
 * Renders centered on the viewport over the globe, showing the match
 * result with delegate CTA. Clicking other matches in Seneca swaps
 * the focused DRep with a theatrical transition.
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ExternalLink, X, Sparkles, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DelegateButton } from '@/components/DelegateButton';
import type { MatchResult, QuickMatchResponse } from '@/hooks/useQuickMatch';
import type { AlignmentScores } from '@/lib/drepIdentity';

/* ─── Types ─── */

interface MatchResultOverlayProps {
  /** Full match response (identity + all matches) */
  result: QuickMatchResponse;
  /** Currently focused match (starts as #1) */
  focusedMatch: MatchResult;
  /** Rank of the focused match (1-indexed) */
  focusedRank: number;
  /** Whether this is the original #1 match or user navigated to another */
  isTopMatch: boolean;
  /** Called when user wants to go back to #1 match */
  onBackToTop: () => void;
  /** Called when user dismisses the overlay */
  onDismiss: () => void;
}

/* ─── Dimension labels ─── */

const DIMENSION_LABELS: Record<string, string> = {
  treasuryConservative: 'Fiscal',
  treasuryGrowth: 'Growth',
  decentralization: 'Decentralization',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_ORDER = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
] as const;

/* ─── Component ─── */

export function MatchResultOverlay({
  result,
  focusedMatch,
  focusedRank,
  isTopMatch,
  onBackToTop,
  onDismiss,
}: MatchResultOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const displayName = focusedMatch.drepName || focusedMatch.drepId.slice(0, 16) + '\u2026';
  const scorePercent = Math.round(focusedMatch.matchScore);

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={focusedMatch.drepId}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className={cn(
          // Desktop: centered card
          'fixed z-[45] w-full max-w-[420px]',
          'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          // Mobile: bottom sheet
          'max-lg:top-auto max-lg:bottom-0 max-lg:left-0 max-lg:right-0',
          'max-lg:max-w-none max-lg:translate-x-0 max-lg:translate-y-0',
          'max-lg:rounded-t-2xl max-lg:rounded-b-none',
          // Card styling
          'rounded-2xl border border-white/[0.1]',
          'bg-black/80 backdrop-blur-2xl',
          'shadow-2xl shadow-black/60',
          'p-5',
        )}
      >
        {/* Close + back controls */}
        <div className="flex items-center justify-between mb-3">
          {!isTopMatch ? (
            <button
              onClick={onBackToTop}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to #1 match
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                Your Governance Identity
              </span>
            </div>
          )}
          <button
            onClick={onDismiss}
            className="rounded-full p-1 text-muted-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Identity label (only on top match) */}
        {isTopMatch && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-center mb-4"
          >
            <p className="text-xl font-display font-bold" style={{ color: result.identityColor }}>
              {result.personalityLabel}
            </p>
          </motion.div>
        )}

        {/* Match rank label */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: focusedMatch.identityColor }}
          >
            {focusedRank}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            {isTopMatch ? 'Your Top Match' : `Match #${focusedRank}`}
          </span>
        </div>

        {/* DRep card */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            borderColor: `${focusedMatch.identityColor}30`,
            background: `linear-gradient(135deg, ${focusedMatch.identityColor}08, transparent)`,
          }}
        >
          {/* Name + score */}
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-foreground truncate">{displayName}</h3>
              {focusedMatch.tier && (
                <span className="text-xs text-muted-foreground">{focusedMatch.tier}</span>
              )}
            </div>
            <span
              className="font-display text-3xl font-bold tabular-nums shrink-0 ml-3"
              style={{ color: focusedMatch.identityColor }}
            >
              {scorePercent}%
            </span>
          </div>

          {/* Agreement badges */}
          {(focusedMatch.agreeDimensions.length > 0 ||
            focusedMatch.differDimensions.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {focusedMatch.agreeDimensions.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-green-500/10 text-green-400"
                >
                  {d} ✓
                </span>
              ))}
              {focusedMatch.differDimensions.slice(0, 2).map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted/30 text-muted-foreground"
                >
                  {d} ✗
                </span>
              ))}
            </div>
          )}

          {/* Dimension bars */}
          <DimensionBars
            userAlignments={result.userAlignments}
            matchAlignments={focusedMatch.alignments}
          />

          {/* Signature insight */}
          {focusedMatch.signatureInsight && (
            <p className="text-xs text-muted-foreground/80 italic leading-relaxed">
              {focusedMatch.signatureInsight}
            </p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex gap-2 mt-4">
          <DelegateButton drepId={focusedMatch.drepId} drepName={displayName} className="flex-1" />
          <Button variant="outline" size="default" asChild className="gap-1.5">
            <Link href={`/drep/${encodeURIComponent(focusedMatch.drepId)}`}>
              Profile
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {/* "See all matches in Seneca" hint (only on top match) */}
        {isTopMatch && result.matches.length > 1 && (
          <p className="text-center text-[10px] text-muted-foreground/60 mt-3">
            {result.matches.length - 1} more matches in the Seneca panel
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Dimension bars (reused from SenecaMatch) ─── */

function DimensionBars({
  userAlignments,
  matchAlignments,
}: {
  userAlignments: AlignmentScores;
  matchAlignments: AlignmentScores;
}) {
  return (
    <div className="space-y-1">
      {DIMENSION_ORDER.map((dim) => {
        const userVal = userAlignments[dim] ?? 50;
        const matchVal = matchAlignments[dim] ?? 50;
        const agreement = Math.round(100 - Math.abs(userVal - matchVal));
        const status = agreement >= 70 ? 'agree' : agreement < 40 ? 'differ' : 'neutral';

        return (
          <div key={dim} className="flex items-center gap-1.5 text-[10px]">
            <span
              className={cn(
                'w-[4.5rem] shrink-0 truncate',
                status === 'agree'
                  ? 'text-green-400'
                  : status === 'differ'
                    ? 'text-amber-400'
                    : 'text-muted-foreground',
              )}
            >
              {DIMENSION_LABELS[dim] ?? dim}
            </span>
            <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  status === 'agree'
                    ? 'bg-green-500'
                    : status === 'differ'
                      ? 'bg-amber-500'
                      : 'bg-muted-foreground/40',
                )}
                style={{ width: `${agreement}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-muted-foreground">{agreement}%</span>
          </div>
        );
      })}
    </div>
  );
}
