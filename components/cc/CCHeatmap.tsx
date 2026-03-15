'use client';

import { Fragment, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { fadeInUp } from '@/lib/animations';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { CCAgreementMatrixEntry } from '@/hooks/queries';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CCHeatmapProps {
  agreementMatrix: CCAgreementMatrixEntry[];
  members: { ccHotId: string; name: string | null }[];
}

type MetricMode = 'reasoning' | 'vote';

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

function cellColorStyle(pct: number): { backgroundColor: string; opacity: number } {
  // Use inline styles for dynamic opacity values that Tailwind can't handle
  if (pct >= 80) {
    const opacity = 0.5 + ((pct - 80) / 20) * 0.4;
    return { backgroundColor: 'rgb(16 185 129)', opacity };
  }
  if (pct >= 60) {
    const opacity = 0.4 + ((pct - 60) / 20) * 0.4;
    return { backgroundColor: 'rgb(14 165 233)', opacity };
  }
  if (pct >= 40) {
    const opacity = 0.35 + ((pct - 40) / 20) * 0.4;
    return { backgroundColor: 'rgb(245 158 11)', opacity };
  }
  const opacity = 0.3 + (pct / 40) * 0.4;
  return { backgroundColor: 'rgb(244 63 94)', opacity };
}

function truncateName(name: string | null, ccHotId: string): string {
  if (name) {
    // Use first name only
    const first = name.split(/\s+/)[0];
    return first.length > 10 ? first.slice(0, 8) + '...' : first;
  }
  return ccHotId.slice(0, 8) + '...';
}

// ---------------------------------------------------------------------------
// Grid component (desktop)
// ---------------------------------------------------------------------------

function HeatmapGrid({
  members,
  lookup,
  mode,
  selectedPair,
  onSelectPair,
}: {
  members: { ccHotId: string; name: string | null }[];
  lookup: Map<string, CCAgreementMatrixEntry>;
  mode: MetricMode;
  selectedPair: [string, string] | null;
  onSelectPair: (pair: [string, string] | null) => void;
}) {
  return (
    <TooltipProvider>
      <div className="overflow-x-auto">
        <div
          className="inline-grid"
          style={{ gridTemplateColumns: `auto repeat(${members.length}, minmax(40px, 1fr))` }}
        >
          {/* Header row — empty corner + column headers */}
          <div />
          {members.map((m) => (
            <div key={`col-${m.ccHotId}`} className="px-1 py-2 text-center">
              <span className="block text-[10px] leading-tight text-muted-foreground truncate max-w-[56px]">
                {truncateName(m.name, m.ccHotId)}
              </span>
            </div>
          ))}

          {/* Data rows */}
          {members.map((rowMember, rowIdx) => (
            <Fragment key={`row-${rowMember.ccHotId}`}>
              {/* Row header */}
              <div className="flex items-center pr-2 py-0.5">
                <span className="text-[10px] leading-tight text-muted-foreground truncate max-w-[72px]">
                  {truncateName(rowMember.name, rowMember.ccHotId)}
                </span>
              </div>

              {/* Cells */}
              {members.map((colMember, colIdx) => {
                const isDiagonal = rowIdx === colIdx;
                const key = `${rowMember.ccHotId}-${colMember.ccHotId}`;
                const reverseKey = `${colMember.ccHotId}-${rowMember.ccHotId}`;
                const entry = lookup.get(key) || lookup.get(reverseKey);

                const pct = isDiagonal
                  ? 100
                  : entry
                    ? mode === 'reasoning'
                      ? entry.reasoningSimilarityPct
                      : entry.voteAgreementPct
                    : null;

                const isHighlighted =
                  selectedPair &&
                  ((selectedPair[0] === rowMember.ccHotId &&
                    selectedPair[1] === colMember.ccHotId) ||
                    (selectedPair[0] === colMember.ccHotId &&
                      selectedPair[1] === rowMember.ccHotId));

                const isInSelectedRowCol =
                  selectedPair &&
                  (selectedPair[0] === rowMember.ccHotId ||
                    selectedPair[1] === rowMember.ccHotId ||
                    selectedPair[0] === colMember.ccHotId ||
                    selectedPair[1] === colMember.ccHotId);

                const metricLabel =
                  mode === 'reasoning' ? 'reasoning similarity' : 'vote agreement';

                return (
                  <Tooltip key={`cell-${rowMember.ccHotId}-${colMember.ccHotId}`}>
                    <TooltipTrigger asChild>
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: (rowIdx * members.length + colIdx) * 0.008,
                          duration: 0.2,
                        }}
                        className={cn(
                          'relative h-10 w-10 rounded-md border border-border/20 transition-all duration-150',
                          isDiagonal && 'bg-muted/40',
                          isHighlighted && 'ring-2 ring-foreground/60 z-10',
                          selectedPair && !isInSelectedRowCol && 'opacity-30',
                        )}
                        style={!isDiagonal && pct != null ? cellColorStyle(pct) : undefined}
                        aria-label={
                          isDiagonal
                            ? `${truncateName(rowMember.name, rowMember.ccHotId)}: self`
                            : pct != null
                              ? `${truncateName(rowMember.name, rowMember.ccHotId)} and ${truncateName(colMember.name, colMember.ccHotId)}: ${pct}% ${metricLabel}`
                              : `${truncateName(rowMember.name, rowMember.ccHotId)} and ${truncateName(colMember.name, colMember.ccHotId)}: no data`
                        }
                        onClick={() => {
                          if (isDiagonal) return;
                          if (
                            selectedPair &&
                            selectedPair[0] === rowMember.ccHotId &&
                            selectedPair[1] === colMember.ccHotId
                          ) {
                            onSelectPair(null);
                          } else {
                            onSelectPair([rowMember.ccHotId, colMember.ccHotId]);
                          }
                        }}
                      >
                        {!isDiagonal && pct != null && (
                          <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] tabular-nums text-foreground/80 font-medium">
                            {pct}
                          </span>
                        )}
                        {isDiagonal && (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground">
                            --
                          </span>
                        )}
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {isDiagonal ? (
                        <span>{rowMember.name || rowMember.ccHotId.slice(0, 12)}</span>
                      ) : pct != null ? (
                        <span>
                          {rowMember.name || rowMember.ccHotId.slice(0, 12)} &harr;{' '}
                          {colMember.name || colMember.ccHotId.slice(0, 12)}:{' '}
                          <strong className="font-mono">{pct}%</strong> {metricLabel}
                          {entry && (
                            <span className="text-muted-foreground">
                              {' '}
                              ({entry.totalSharedProposals} shared)
                            </span>
                          )}
                        </span>
                      ) : (
                        <span>No shared data</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Mobile list view
// ---------------------------------------------------------------------------

function HeatmapMobileList({
  members,
  lookup,
  mode,
}: {
  members: { ccHotId: string; name: string | null }[];
  lookup: Map<string, CCAgreementMatrixEntry>;
  mode: MetricMode;
}) {
  // Collect all pairs with data
  const pairs = useMemo(() => {
    const result: { a: string; aName: string; b: string; bName: string; pct: number }[] = [];
    const memberMap = new Map(members.map((m) => [m.ccHotId, m]));

    lookup.forEach((entry) => {
      const memberA = memberMap.get(entry.memberA);
      const memberB = memberMap.get(entry.memberB);
      if (!memberA || !memberB) return;

      const pct = mode === 'reasoning' ? entry.reasoningSimilarityPct : entry.voteAgreementPct;
      result.push({
        a: entry.memberA,
        aName: memberA.name || entry.memberA.slice(0, 12),
        b: entry.memberB,
        bName: memberB.name || entry.memberB.slice(0, 12),
        pct,
      });
    });

    return result.sort((x, y) => y.pct - x.pct);
  }, [members, lookup, mode]);

  if (pairs.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No pairwise data available yet.</p>;
  }

  const top3 = pairs.slice(0, 3);
  const bottom3 = [...pairs].sort((x, y) => x.pct - y.pct).slice(0, 3);
  const metricLabel = mode === 'reasoning' ? 'reasoning similarity' : 'vote agreement';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Strongest {mode === 'reasoning' ? 'Reasoning' : 'Vote'} Alignment
        </h4>
        {top3.map((p) => (
          <div
            key={`top-${p.a}-${p.b}`}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-card/20 px-3 py-2"
          >
            <span className="text-sm">
              <Link
                href={`/governance/committee/${encodeURIComponent(p.a)}`}
                className="hover:text-primary transition-colors"
              >
                {p.aName}
              </Link>{' '}
              <span className="text-muted-foreground">&harr;</span>{' '}
              <Link
                href={`/governance/committee/${encodeURIComponent(p.b)}`}
                className="hover:text-primary transition-colors"
              >
                {p.bName}
              </Link>
            </span>
            <span className="font-mono text-xs tabular-nums text-emerald-500 font-medium">
              {p.pct}% {metricLabel}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Most Different {mode === 'reasoning' ? 'Reasoning' : 'Voting'}
        </h4>
        {bottom3.map((p) => (
          <div
            key={`bot-${p.a}-${p.b}`}
            className="flex items-center justify-between rounded-lg border border-border/40 bg-card/20 px-3 py-2"
          >
            <span className="text-sm">
              <Link
                href={`/governance/committee/${encodeURIComponent(p.a)}`}
                className="hover:text-primary transition-colors"
              >
                {p.aName}
              </Link>{' '}
              <span className="text-muted-foreground">&harr;</span>{' '}
              <Link
                href={`/governance/committee/${encodeURIComponent(p.b)}`}
                className="hover:text-primary transition-colors"
              >
                {p.bName}
              </Link>
            </span>
            <span className="font-mono text-xs tabular-nums text-rose-500 font-medium">
              {p.pct}% {metricLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function CCHeatmap({ agreementMatrix, members }: CCHeatmapProps) {
  const [mode, setMode] = useState<MetricMode>('reasoning');
  const [selectedPair, setSelectedPair] = useState<[string, string] | null>(null);

  // Sort members alphabetically by name (or id)
  const sortedMembers = useMemo(
    () =>
      [...members].sort((a, b) => {
        const nameA = (a.name || a.ccHotId).toLowerCase();
        const nameB = (b.name || b.ccHotId).toLowerCase();
        return nameA.localeCompare(nameB);
      }),
    [members],
  );

  // Build O(1) lookup map
  const lookup = useMemo(() => {
    const map = new Map<string, CCAgreementMatrixEntry>();
    for (const entry of agreementMatrix) {
      map.set(`${entry.memberA}-${entry.memberB}`, entry);
    }
    return map;
  }, [agreementMatrix]);

  const handleSelectPair = useCallback((pair: [string, string] | null) => {
    setSelectedPair(pair);
  }, []);

  if (!agreementMatrix.length || members.length < 2) {
    return null;
  }

  return (
    <motion.div variants={fadeInUp} className="space-y-3">
      {/* Header with toggle */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Constitutional Reasoning Heatmap</h2>
        <div className="flex rounded-lg border border-border/60 bg-card/30 p-0.5">
          <button
            onClick={() => {
              setMode('reasoning');
              setSelectedPair(null);
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'reasoning'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Reasoning
          </button>
          <button
            onClick={() => {
              setMode('vote');
              setSelectedPair(null);
            }}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              mode === 'vote'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Vote Agreement
          </button>
        </div>
      </div>

      {/* Desktop: full grid */}
      <div className="hidden sm:block rounded-xl border border-border/60 bg-card/30 p-4">
        <HeatmapGrid
          members={sortedMembers}
          lookup={lookup}
          mode={mode}
          selectedPair={selectedPair}
          onSelectPair={handleSelectPair}
        />
        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground">Similarity:</span>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-rose-500/50" />
            <span className="text-[10px] text-muted-foreground">&lt;40%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-amber-500/50" />
            <span className="text-[10px] text-muted-foreground">40-59%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-sky-500/50" />
            <span className="text-[10px] text-muted-foreground">60-79%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-emerald-500/50" />
            <span className="text-[10px] text-muted-foreground">&ge;80%</span>
          </div>
        </div>
      </div>

      {/* Mobile: simplified list */}
      <div className="sm:hidden rounded-xl border border-border/60 bg-card/30 p-4">
        <HeatmapMobileList members={sortedMembers} lookup={lookup} mode={mode} />
      </div>
    </motion.div>
  );
}
