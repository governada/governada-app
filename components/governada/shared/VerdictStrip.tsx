'use client';

import { cn } from '@/lib/utils';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

interface VerdictStripProps {
  /** Proposal title */
  title: string;
  /** Yes/No/Abstain vote counts or percentages */
  yesPercent: number;
  noPercent: number;
  abstainPercent: number;
  /** Days/time remaining */
  timeRemaining?: string;
  /** Whether this has passed constitutional check */
  constitutionalStatus?: 'pass' | 'warning' | 'fail' | null;
  /** ADA amount at stake */
  adaAtStake?: string;
  className?: string;
}

function buildNarrative(yesPercent: number, timeRemaining?: string): string {
  const verb = yesPercent >= 50 ? 'Passing' : 'Trailing';
  const timePart = timeRemaining ? ` \u2014 ${timeRemaining} remain` : '';
  return `${verb} with ${Math.round(yesPercent)}% support${timePart}`;
}

function ConstitutionalBadge({ status }: { status: 'pass' | 'warning' | 'fail' }) {
  const config = {
    pass: {
      icon: ShieldCheck,
      label: 'Constitutional',
      className: 'text-emerald-500',
    },
    warning: {
      icon: ShieldAlert,
      label: 'Constitutional concern',
      className: 'text-amber-500',
    },
    fail: {
      icon: Shield,
      label: 'Unconstitutional',
      className: 'text-red-500',
    },
  } as const;

  const { icon: Icon, label, className } = config[status];

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={label}
      title={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

export function VerdictStrip({
  title,
  yesPercent,
  noPercent,
  abstainPercent,
  timeRemaining,
  constitutionalStatus,
  adaAtStake,
  className,
}: VerdictStripProps) {
  const total = yesPercent + noPercent + abstainPercent;
  const yesWidth = total > 0 ? (yesPercent / total) * 100 : 0;
  const noWidth = total > 0 ? (noPercent / total) * 100 : 0;
  const abstainWidth = total > 0 ? (abstainPercent / total) * 100 : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      {/* Title row with constitutional badge */}
      <div className="flex items-center gap-1.5">
        <span className="truncate text-sm font-medium">{title}</span>
        {constitutionalStatus && <ConstitutionalBadge status={constitutionalStatus} />}
      </div>

      {/* Vote bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-border">
        {yesWidth > 0 && (
          <div
            className="h-full bg-sky-600"
            style={{ width: `${yesWidth}%` }}
            aria-label={`Yes: ${Math.round(yesPercent)}%`}
          />
        )}
        {noWidth > 0 && (
          <div
            className="h-full bg-amber-700"
            style={{ width: `${noWidth}%` }}
            aria-label={`No: ${Math.round(noPercent)}%`}
          />
        )}
        {abstainWidth > 0 && (
          <div
            className="h-full bg-slate-500"
            style={{ width: `${abstainWidth}%` }}
            aria-label={`Abstain: ${Math.round(abstainPercent)}%`}
          />
        )}
      </div>

      {/* Narrative + ADA at stake */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{buildNarrative(yesPercent, timeRemaining)}</span>
        {adaAtStake && <span className="shrink-0">{adaAtStake} at stake</span>}
      </div>
    </div>
  );
}
