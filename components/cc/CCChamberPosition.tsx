'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface PairwiseEntry {
  memberId: string;
  memberName?: string;
  voteAgreementPct: number;
  reasoningSimilarityPct: number;
  sharedProposals: number;
}

interface CCChamberPositionProps {
  pairwiseAlignment: PairwiseEntry[];
  allMembers: { ccHotId: string; name: string | null }[];
}

function barColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500/80';
  if (pct >= 60) return 'bg-sky-500/80';
  if (pct >= 40) return 'bg-amber-500/80';
  return 'bg-rose-500/80';
}

export function CCChamberPosition({ pairwiseAlignment, allMembers }: CCChamberPositionProps) {
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of allMembers) {
      if (m.name) map.set(m.ccHotId, m.name);
    }
    return map;
  }, [allMembers]);

  const resolveName = (id: string): string => memberNameMap.get(id) ?? `${id.slice(0, 12)}\u2026`;

  const sorted = useMemo(
    () =>
      [...pairwiseAlignment].sort((a, b) => b.reasoningSimilarityPct - a.reasoningSimilarityPct),
    [pairwiseAlignment],
  );

  if (sorted.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-6 text-center">
        No chamber alignment data available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Users className="h-4 w-4" />
        Chamber Alignment
      </h3>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {sorted.map((entry) => {
          const name = entry.memberName ?? resolveName(entry.memberId);
          return (
            <motion.div
              key={entry.memberId}
              variants={fadeInUp}
              className="rounded-xl border border-border/60 bg-card/30 px-4 py-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Link
                  href={`/governance/committee/${encodeURIComponent(entry.memberId)}`}
                  className="text-sm font-medium hover:text-primary transition-colors truncate"
                >
                  {name}
                </Link>
                <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                  {entry.sharedProposals} shared
                </span>
              </div>

              {/* Reasoning bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Reasoning</span>
                  <span className="font-mono tabular-nums">{entry.reasoningSimilarityPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      barColor(entry.reasoningSimilarityPct),
                    )}
                    style={{ width: `${entry.reasoningSimilarityPct}%` }}
                  />
                </div>
              </div>

              {/* Votes bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Votes</span>
                  <span className="font-mono tabular-nums">{entry.voteAgreementPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      barColor(entry.voteAgreementPct),
                    )}
                    style={{ width: `${entry.voteAgreementPct}%` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
