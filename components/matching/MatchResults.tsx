'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { RotateCcw, ExternalLink, Vote, ChevronDown } from 'lucide-react';
import { posthog } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { GovernanceIdentityCard } from './GovernanceIdentityCard';
import { MatchResultCard } from './MatchResultCard';
import { generateMatchNarrative } from '@/lib/matching/matchNarrative';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { MatchResult, SpoMatchResult } from '@/lib/matching/conversationalMatch';
import type { ConstellationRef } from '@/lib/globe/types';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────── */

interface MatchResultsProps {
  personalityLabel: string;
  identityColor: string;
  userAlignments: AlignmentScores;
  matches: MatchResult[];
  spoMatches?: SpoMatchResult[];
  onReset: () => void;
  onDelegate?: (drepId: string) => void;
  globeRef?: React.RefObject<ConstellationRef | null>;
}

/* ─── Helpers ───────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function pickBridgeMatch(matches: MatchResult[]): MatchResult | null {
  if (matches.length < 4) return null;
  const candidates = matches.slice(3);
  const sorted = [...candidates].sort((a, b) => {
    const differDiff = b.differDimensions.length - a.differDimensions.length;
    if (differDiff !== 0) return differDiff;
    return a.score - b.score;
  });
  return sorted[0] ?? null;
}

/* ─── Hero Match Card — the #1 "found you" moment ──────── */

function HeroMatchCard({
  match,
  identityColor,
  onDelegate,
}: {
  match: MatchResult;
  identityColor: string;
  onDelegate?: (drepId: string) => void;
}) {
  const [r, g, b] = hexToRgb(match.identityColor);
  const displayName = match.drepName || match.drepId.slice(0, 16) + '...';
  const narrative = generateMatchNarrative({
    agreeDimensions: match.agreeDimensions,
    differDimensions: match.differDimensions,
    isBridge: false,
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
      className="relative rounded-2xl border bg-black/70 backdrop-blur-xl overflow-hidden"
      style={{
        borderColor: `rgba(${r}, ${g}, ${b}, 0.5)`,
        boxShadow: `0 0 40px rgba(${r}, ${g}, ${b}, 0.25), 0 0 80px rgba(${r}, ${g}, ${b}, 0.1)`,
      }}
    >
      {/* Glow pulse on entrance */}
      <motion.div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 2, ease: 'easeOut' }}
        style={{ boxShadow: `inset 0 0 80px rgba(${r}, ${g}, ${b}, 0.3)` }}
      />

      <div className="relative z-10 p-6 text-center space-y-4">
        {/* "Match Found" preamble */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-[10px] uppercase tracking-[0.3em] text-white/50"
        >
          Match found
        </motion.p>

        {/* Giant score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.6 }}
          className="font-display text-6xl sm:text-7xl font-bold tabular-nums"
          style={{ color: match.identityColor }}
        >
          {Math.round(match.score)}%
        </motion.div>

        {/* DRep name */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white">{displayName}</h2>
          {match.tier && <span className="text-xs text-muted-foreground">{match.tier}</span>}
        </motion.div>

        {/* Narrative */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="text-sm text-white/70 max-w-sm mx-auto leading-relaxed"
        >
          {narrative}
        </motion.p>

        {/* Agree dimension pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex flex-wrap justify-center gap-2"
        >
          {match.agreeDimensions.slice(0, 3).map((dim) => (
            <span
              key={dim}
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-green-500/15 text-green-400"
            >
              {dim} &#x2713;
            </span>
          ))}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="flex flex-col sm:flex-row gap-2 pt-2"
        >
          {onDelegate && (
            <Button
              onClick={() => onDelegate(match.drepId)}
              className="gap-2 flex-1 min-h-[44px]"
              style={{ backgroundColor: match.identityColor, color: '#fff' }}
            >
              <Vote className="h-4 w-4" />
              Delegate to {displayName}
            </Button>
          )}
          <Button variant="outline" asChild className="gap-2 flex-1 min-h-[44px]">
            <a href={`/drep/${encodeURIComponent(match.drepId)}`}>
              View profile
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ─── SPO Match Card (compact) ──────────────────────────── */

function SpoMatchCard({ spo, rank }: { spo: SpoMatchResult; rank: number }) {
  const displayName = spo.ticker
    ? `[${spo.ticker}] ${spo.poolName ?? ''}`
    : (spo.poolName ?? spo.poolId.slice(0, 16) + '...');

  return (
    <a
      href={`/pool/${encodeURIComponent(spo.poolId)}`}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-white/[0.08] bg-card/40 backdrop-blur-sm',
        'px-4 py-3 transition-colors hover:border-violet-500/30',
      )}
    >
      <span
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
        style={{ backgroundColor: spo.identityColor }}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-sm text-foreground truncate block">{displayName}</span>
        {spo.voteCount > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {spo.voteCount} governance vote{spo.voteCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <span
        className="font-display text-lg font-bold tabular-nums shrink-0"
        style={{ color: spo.identityColor }}
      >
        {Math.round(spo.score)}%
      </span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

/* ─── Component ─────────────────────────────────────────── */

export function MatchResults({
  personalityLabel,
  identityColor,
  userAlignments,
  matches,
  spoMatches,
  onReset,
  onDelegate,
  globeRef,
}: MatchResultsProps) {
  const [showMore, setShowMore] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const topMatch = matches[0] ?? null;
  const runnerUps = useMemo(() => matches.slice(1, 3), [matches]);
  const bridgeMatch = useMemo(() => pickBridgeMatch(matches), [matches]);

  // Fire identity viewed event once on mount
  const identityTrackedRef = useRef(false);
  useEffect(() => {
    if (!identityTrackedRef.current) {
      identityTrackedRef.current = true;
      posthog.capture('match_identity_viewed', {
        personality: personalityLabel,
        identityColor,
        topMatchScore: topMatch?.score,
      });
    }
  }, [personalityLabel, identityColor, topMatch?.score]);

  const handleExpand = useCallback(
    (index: number, isBridge: boolean) => {
      const isExpanding = expandedIndex !== index;
      if (isExpanding) {
        posthog.capture('match_result_expanded', {
          rank: isBridge ? 'bridge' : index + 1,
          isBridge,
        });
      }
      setExpandedIndex((prev) => (prev === index ? null : index));
    },
    [expandedIndex],
  );

  const handleDelegate = useCallback(
    (drepId: string, rank: number) => {
      posthog.capture('match_delegate_clicked', { drepId, rank });
      onDelegate?.(drepId);
    },
    [onDelegate],
  );

  if (!topMatch) {
    return (
      <div className="w-full text-center space-y-4 py-8">
        <p className="text-sm text-muted-foreground">
          No strong matches found. Try again with different priorities.
        </p>
        <Button variant="outline" onClick={onReset} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* ── THE CEREBRO REVEAL ─────────────────────────── */}

      {/* Hero: #1 Match — the dramatic "found you" card */}
      <HeroMatchCard
        match={topMatch}
        identityColor={identityColor}
        onDelegate={onDelegate ? (id) => handleDelegate(id, 1) : undefined}
      />

      {/* Identity badge — compact inline, not a full card */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="text-center"
      >
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-1">
          Your governance identity
        </p>
        <p className="font-display text-lg font-bold" style={{ color: identityColor }}>
          {personalityLabel}
        </p>
      </motion.div>

      {/* ── MORE MATCHES (expandable) ─────────────────── */}

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="space-y-3"
      >
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center justify-center gap-1 w-full text-xs text-white/50 hover:text-white/80 transition-colors py-2"
        >
          {showMore
            ? 'Hide other matches'
            : `${runnerUps.length + (bridgeMatch ? 1 : 0)} more matches`}
          <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {showMore && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-3 overflow-hidden"
            >
              {/* Runner-up DRep matches */}
              {runnerUps.map((match, i) => (
                <MatchResultCard
                  key={match.drepId}
                  match={match}
                  rank={i + 2}
                  userAlignments={userAlignments}
                  expanded={expandedIndex === i + 1}
                  onExpand={() => handleExpand(i + 1, false)}
                  onDelegate={onDelegate ? (drepId) => handleDelegate(drepId, i + 2) : undefined}
                  globeRef={globeRef}
                />
              ))}

              {/* Bridge match */}
              {bridgeMatch && (
                <MatchResultCard
                  key={`bridge-${bridgeMatch.drepId}`}
                  match={bridgeMatch}
                  rank={4}
                  isBridge
                  userAlignments={userAlignments}
                  expanded={expandedIndex === 99}
                  onExpand={() => handleExpand(99, true)}
                  onDelegate={onDelegate ? (drepId) => handleDelegate(drepId, 4) : undefined}
                  globeRef={globeRef}
                />
              )}

              {/* SPO matches */}
              {spoMatches && spoMatches.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-medium text-muted-foreground">Stake pool matches</h4>
                  {spoMatches.map((spo, i) => (
                    <SpoMatchCard key={spo.poolId} spo={spo} rank={i + 1} />
                  ))}
                </div>
              )}

              {/* Full identity card */}
              <div className="pt-2">
                <GovernanceIdentityCard
                  personalityLabel={personalityLabel}
                  identityColor={identityColor}
                  alignments={userAlignments}
                  onShare={() => posthog.capture('match_identity_shared')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Bottom CTAs */}
      <div className="flex flex-col items-center gap-3 pt-2">
        <Button variant="outline" onClick={onReset} className="gap-2 min-h-[44px]">
          <RotateCcw className="h-4 w-4" />
          Continue refining
        </Button>
      </div>
    </div>
  );
}
