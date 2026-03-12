'use client';

import { Landmark } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useDRepNclImpact } from '@/hooks/queries';
import { getCitizenTreasuryImpact } from '@/lib/treasury';

interface DRepTreasuryStewardshipProps {
  drepId: string;
  citizenDelegatedAda?: number;
  drepVotingPower?: number;
}

function formatAda(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toLocaleString();
}

export function DRepTreasuryStewardship({
  drepId,
  citizenDelegatedAda,
  drepVotingPower,
}: DRepTreasuryStewardshipProps) {
  const { data: raw } = useDRepNclImpact(drepId);
  const impact =
    (
      raw as
        | {
            impact: {
              approvedAda: number;
              opposedAda: number;
              approvedPct: number;
              nclAda: number;
              judgmentScore: number | null;
            } | null;
          }
        | undefined
    )?.impact ?? null;

  if (!impact || (impact.approvedAda === 0 && impact.opposedAda === 0)) return null;

  const proportionalSpending =
    citizenDelegatedAda != null && drepVotingPower && drepVotingPower > 0
      ? getCitizenTreasuryImpact(impact.approvedAda, citizenDelegatedAda, drepVotingPower)
      : 0;

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Landmark className="h-3.5 w-3.5 text-amber-400" />
          Treasury Stewardship
        </div>
        <Link href="/governance/treasury" className="text-[10px] text-primary hover:underline">
          Full details
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="text-sm">
          <p className="text-muted-foreground text-xs">Approved</p>
          <p className="font-semibold tabular-nums text-foreground">
            ₳{formatAda(impact.approvedAda)}
          </p>
          <p
            className={cn(
              'text-[10px]',
              impact.approvedPct >= 40 ? 'text-amber-400' : 'text-muted-foreground/70',
            )}
          >
            {impact.approvedPct}% of budget
          </p>
        </div>
        {impact.judgmentScore != null && (
          <div className="text-sm">
            <p className="text-muted-foreground text-xs">Judgment</p>
            <p
              className={cn(
                'font-semibold tabular-nums',
                impact.judgmentScore >= 70
                  ? 'text-emerald-400'
                  : impact.judgmentScore >= 40
                    ? 'text-amber-400'
                    : 'text-rose-400',
              )}
            >
              {impact.judgmentScore}%
            </p>
            <p className="text-[10px] text-muted-foreground/70">of approved delivered</p>
          </div>
        )}
      </div>

      {proportionalSpending > 0 && (
        <p className="text-xs text-muted-foreground border-t border-border/30 pt-2">
          Your delegation represents{' '}
          <span className="font-medium text-foreground">₳{formatAda(proportionalSpending)}</span> of
          approved spending
        </p>
      )}
    </div>
  );
}
