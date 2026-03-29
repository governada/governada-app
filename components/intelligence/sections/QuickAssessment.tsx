'use client';

/**
 * QuickAssessment — at-a-glance signal summary for review brief.
 *
 * Shows key signals: treasury impact, urgency, voting body consensus direction.
 */

import { cn } from '@/lib/utils';
import { Coins, Clock, BarChart3 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuickAssessmentProps {
  withdrawalAmount?: number | null;
  treasuryTier?: string | null;
  epochsRemaining?: number | null;
  isUrgent?: boolean;
  interBodyVotes?: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConsensusDirection(votes: QuickAssessmentProps['interBodyVotes']) {
  if (!votes) return null;
  let yesTotal = 0;
  let noTotal = 0;
  for (const body of [votes.drep, votes.spo, votes.cc]) {
    yesTotal += body.yes;
    noTotal += body.no;
  }
  const total = yesTotal + noTotal;
  if (total === 0) return null;
  const yesPct = (yesTotal / total) * 100;
  if (yesPct >= 67) return { label: 'Strong Yes', color: 'text-emerald-400' };
  if (yesPct >= 50) return { label: 'Leaning Yes', color: 'text-emerald-400/70' };
  if (yesPct >= 40) return { label: 'Contested', color: 'text-amber-400' };
  return { label: 'Leaning No', color: 'text-red-400' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickAssessment({
  withdrawalAmount,
  treasuryTier,
  epochsRemaining,
  isUrgent,
  interBodyVotes,
}: QuickAssessmentProps) {
  const consensus = getConsensusDirection(interBodyVotes);
  const ada = withdrawalAmount ? withdrawalAmount / 1_000_000 : null;

  const signals: Array<{ icon: typeof Coins; label: string; value: string; color: string }> = [];

  if (ada && ada > 0) {
    signals.push({
      icon: Coins,
      label: 'Treasury',
      value: `₳${ada >= 1_000_000 ? `${(ada / 1_000_000).toFixed(1)}M` : ada.toLocaleString()}${treasuryTier ? ` ${treasuryTier}` : ''}`,
      color: 'text-amber-400',
    });
  }

  if (epochsRemaining != null) {
    signals.push({
      icon: Clock,
      label: 'Time',
      value: `${epochsRemaining} epoch${epochsRemaining !== 1 ? 's' : ''} left`,
      color:
        isUrgent || epochsRemaining <= 1
          ? 'text-red-400'
          : epochsRemaining <= 3
            ? 'text-amber-400'
            : 'text-muted-foreground',
    });
  }

  if (consensus) {
    signals.push({
      icon: BarChart3,
      label: 'Direction',
      value: consensus.label,
      color: consensus.color,
    });
  }

  if (signals.length === 0) {
    return <p className="text-xs text-muted-foreground/60 py-1">No key signals available yet</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-2 text-xs">
      {signals.map((signal) => (
        <div key={signal.label} className="flex items-center gap-2">
          <signal.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{signal.label}</span>
          <span className={cn('font-medium ml-auto', signal.color)}>{signal.value}</span>
        </div>
      ))}
    </div>
  );
}
