'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Network, ChevronDown, ChevronUp } from 'lucide-react';
import { GovernanceRadar } from '@/components/GovernanceRadar';
import type { AlignmentScores } from '@/lib/drepIdentity';
import { spring } from '@/lib/animations';

interface DivergenceVote {
  proposalTxHash: string;
  proposalIndex: number;
  title: string;
  spoVote: string;
  drepMajority: string;
  ccMajority: string;
}

interface InterBodyDynamicsCardProps {
  drepAlignPct: number | null;
  ccAlignPct: number | null;
  totalVotes: number;
  alignments: AlignmentScores;
  divergences?: DivergenceVote[];
}

function getAlignmentHeadline(
  drepPct: number | null,
  ccPct: number | null,
): { headline: string; subtext: string } {
  if (drepPct == null && ccPct == null) {
    return {
      headline: 'Alignment Pending',
      subtext: 'Needs more overlapping votes with DReps and CC to calculate alignment.',
    };
  }

  const avgAlign = ((drepPct ?? 50) + (ccPct ?? 50)) / 2;

  if (avgAlign >= 80) {
    return {
      headline: 'Consensus Builder',
      subtext:
        'This pool consistently votes with both DRep and CC majorities, reinforcing governance consensus.',
    };
  }
  if (avgAlign >= 60) {
    return {
      headline: 'Moderate Voice',
      subtext:
        'This pool generally aligns with governance bodies but takes independent positions on select issues.',
    };
  }
  if (avgAlign >= 40) {
    return {
      headline: 'Independent Voice',
      subtext:
        'This pool frequently diverges from majority positions, bringing distinct perspective to governance.',
    };
  }
  return {
    headline: 'Contrarian Force',
    subtext:
      'This pool consistently votes against both DRep and CC majorities — a deliberate check on consensus.',
  };
}

function AlignmentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono tabular-nums font-bold ${color}`}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color.replace('text-', 'bg-').replace('-400', '-500/80')}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ ...spring.smooth, delay: 0.2 }}
        />
      </div>
    </div>
  );
}

export function InterBodyDynamicsCard({
  drepAlignPct,
  ccAlignPct,
  totalVotes,
  alignments,
  divergences,
}: InterBodyDynamicsCardProps) {
  const [showDivergences, setShowDivergences] = useState(false);
  const { headline, subtext } = getAlignmentHeadline(drepAlignPct, ccAlignPct);
  const hasAlignment =
    alignments.treasuryConservative != null || alignments.decentralization != null;
  const hasDivergences = divergences && divergences.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-5 py-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Inter-Body Dynamics
        </span>
      </div>

      {/* Headline */}
      <div className="space-y-1">
        <h3 className="text-lg font-bold">{headline}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{subtext}</p>
      </div>

      {/* Alignment bars */}
      <div className="space-y-3">
        {drepAlignPct != null && (
          <AlignmentBar
            label="Agrees with DRep majority"
            pct={drepAlignPct}
            color="text-cyan-400"
          />
        )}
        {ccAlignPct != null && (
          <AlignmentBar label="Agrees with CC majority" pct={ccAlignPct} color="text-violet-400" />
        )}
      </div>

      {/* Interpretive narrative */}
      {totalVotes < 5 && (drepAlignPct != null || ccAlignPct != null) && (
        <p className="text-xs text-muted-foreground/80 italic">
          Early data \u2014 {totalVotes} vote{totalVotes !== 1 ? 's' : ''} recorded. Alignment
          becomes more reliable with 5+ overlapping votes.
        </p>
      )}

      {/* Divergence explorer */}
      {hasDivergences && (
        <div className="space-y-2 border-t border-border/30 pt-3">
          <button
            onClick={() => setShowDivergences(!showDivergences)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {showDivergences ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {divergences.length} vote{divergences.length !== 1 ? 's' : ''} diverging from majority
          </button>

          {showDivergences && (
            <div className="space-y-1.5">
              {divergences.map((d) => (
                <Link
                  key={`${d.proposalTxHash}:${d.proposalIndex}`}
                  href={`/proposals/${d.proposalTxHash}-${d.proposalIndex}`}
                  className="block rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/30 transition-colors"
                >
                  <p className="text-xs font-medium text-foreground truncate">{d.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    SPO voted <span className="font-medium">{d.spoVote}</span>
                    {d.drepMajority !== d.spoVote && (
                      <span>
                        {' \u00B7 '}DRep majority:{' '}
                        <span className="font-medium">{d.drepMajority}</span>
                      </span>
                    )}
                    {d.ccMajority !== d.spoVote && (
                      <span>
                        {' \u00B7 '}CC majority: <span className="font-medium">{d.ccMajority}</span>
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Radar visualization */}
      {hasAlignment && (
        <div className="border-t border-border/30 pt-4">
          <p className="text-xs text-muted-foreground mb-3">Governance Alignment Profile</p>
          <div className="flex justify-center">
            <GovernanceRadar alignments={alignments} size="full" />
          </div>
        </div>
      )}
    </motion.div>
  );
}
