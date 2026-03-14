'use client';

import { useProposalPower } from '@/hooks/queries';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PowerData {
  yesPower: number;
  noPower: number;
  abstainPower: number;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  totalActivePower: number;
  threshold: number | null;
  thresholdLabel: string | null;
}

interface OutcomeExplainerProps {
  txHash: string;
  proposalIndex: number;
  proposalType: string;
  status: string;
  yesCount?: number;
  noCount?: number;
  abstainCount?: number;
  totalVotes?: number;
}

export function OutcomeExplainer({
  txHash,
  proposalIndex,
  proposalType,
  status,
  yesCount = 0,
  noCount: _noCount = 0,
  totalVotes = 0,
}: OutcomeExplainerProps) {
  const isOpen = !['enacted', 'ratified', 'dropped', 'expired'].includes(status);
  const { data: powerData } = useProposalPower(txHash, proposalIndex, proposalType);
  const power = (powerData as PowerData) ?? null;

  if (isOpen) return null;

  const isInfoAction = proposalType === 'InfoAction';
  const thresholdPct = power?.threshold ? Math.round(power.threshold * 100) : null;
  const yesPowerPct =
    power && power.totalActivePower > 0
      ? ((power.yesPower / power.totalActivePower) * 100).toFixed(1)
      : null;

  let text: string;
  let icon: typeof CheckCircle2;
  let colorClass: string;

  if (status === 'enacted' || status === 'ratified') {
    icon = CheckCircle2;
    colorClass = 'text-emerald-600 dark:text-emerald-400';
    if (yesPowerPct && thresholdPct) {
      text = `Passed with ${yesPowerPct}% of voting power, exceeding the ${thresholdPct}% threshold.`;
    } else if (isInfoAction) {
      const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
      text = `This advisory proposal passed. ${yesPct}% of DReps voted Yes (${yesCount} of ${totalVotes}).`;
    } else {
      text = `This proposal was ${status}.`;
    }
  } else if (status === 'expired') {
    icon = Clock;
    colorClass = 'text-muted-foreground';
    if (isInfoAction) {
      const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
      text = `This advisory proposal expired after its voting period ended. ${yesPct}% of DReps voted Yes (${yesCount} of ${totalVotes}).`;
    } else if (yesPowerPct && thresholdPct) {
      const deficit = Number(yesPowerPct) < thresholdPct;
      text = deficit
        ? `Did not reach the ${thresholdPct}% voting power threshold \u2014 ${yesPowerPct}% of active DRep stake voted Yes.`
        : `Expired despite reaching ${yesPowerPct}% voting power (${thresholdPct}% needed). The proposal ran out of time before ratification.`;
    } else {
      text = `This proposal expired without reaching the required voting threshold.`;
    }
  } else if (status === 'dropped') {
    icon = XCircle;
    colorClass = 'text-red-500 dark:text-red-400';
    text = 'This proposal was dropped by governance action.';
    if (yesPowerPct && thresholdPct) {
      text += ` ${yesPowerPct}% of voting power voted Yes (${thresholdPct}% needed).`;
    }
  } else {
    return null;
  }

  const Icon = icon;

  return (
    <div className={cn('flex items-start gap-2 text-sm mt-2', colorClass)}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}
