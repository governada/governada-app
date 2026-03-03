'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2, Wallet } from 'lucide-react';
import { posthog } from '@/lib/posthog';

interface HealthData {
  drepId?: string;
  drepName?: string;
  drepScore?: number;
  participationRate?: number;
  votedOnOpen?: number;
  openProposalCount?: number;
  representationScore?: number;
}

interface ActiveProposal {
  txHash: string;
  proposalIndex: number;
  title: string;
  proposalType: string;
  priority: string;
  epochsRemaining?: number;
  drepVote?: string;
}

export interface GovernanceRiskSignalsProps {
  health: HealthData | null;
  activeProposals: ActiveProposal[];
}

type RiskLevel = 'red' | 'amber' | 'green';

interface Signal {
  level: RiskLevel;
  message: string;
}

function computeSignals(health: HealthData, proposals: ActiveProposal[]): Signal[] {
  const signals: Signal[] = [];
  const { drepScore, votedOnOpen, openProposalCount, representationScore } = health;

  // RED signals
  if (drepScore != null && drepScore < 50) {
    signals.push({
      level: 'red',
      message: `DRep score is ${drepScore}/100 — below acceptable threshold`,
    });
  }

  if (openProposalCount != null && openProposalCount > 0 && (votedOnOpen ?? 0) === 0) {
    signals.push({
      level: 'red',
      message: `DRep has not voted on any of ${openProposalCount} open proposals`,
    });
  }

  const criticalUnvoted = proposals.filter(
    (p) => p.epochsRemaining != null && p.epochsRemaining <= 1 && !p.drepVote,
  );
  for (const p of criticalUnvoted) {
    signals.push({
      level: 'red',
      message: `Critical: "${p.title || p.txHash.slice(0, 12)}" expiring without DRep vote`,
    });
  }

  // AMBER signals (only if not already covered by red)
  if (drepScore != null && drepScore >= 50 && drepScore < 65) {
    signals.push({
      level: 'amber',
      message: `DRep score is ${drepScore}/100 — below recommended level`,
    });
  }

  if (
    openProposalCount != null &&
    openProposalCount > 0 &&
    votedOnOpen != null &&
    votedOnOpen > 0 &&
    votedOnOpen < openProposalCount / 2
  ) {
    signals.push({
      level: 'amber',
      message: `DRep has only voted on ${votedOnOpen} of ${openProposalCount} open proposals`,
    });
  }

  if (representationScore != null && representationScore < 50) {
    signals.push({
      level: 'amber',
      message: `Representation score is ${representationScore}% — your DRep often votes differently from you`,
    });
  }

  return signals;
}

function overallLevel(signals: Signal[]): RiskLevel {
  if (signals.some((s) => s.level === 'red')) return 'red';
  if (signals.some((s) => s.level === 'amber')) return 'amber';
  return 'green';
}

const LEVEL_STYLES = {
  red: {
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50/50 dark:bg-red-950/20',
    title: 'text-red-800 dark:text-red-300',
    icon: AlertOctagon,
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50/50 dark:bg-amber-950/20',
    title: 'text-amber-800 dark:text-amber-300',
    icon: AlertTriangle,
  },
  green: {
    border: 'border-green-300 dark:border-green-700',
    bg: 'bg-green-50/50 dark:bg-green-950/20',
    title: 'text-green-800 dark:text-green-300',
    icon: CheckCircle2,
  },
} as const;

export function GovernanceRiskSignals({ health, activeProposals }: GovernanceRiskSignalsProps) {
  const tracked = useRef(false);

  const { signals, level } = useMemo(() => {
    if (!health) return { signals: [] as Signal[], level: 'green' as RiskLevel };
    const s = computeSignals(health, activeProposals);
    return { signals: s, level: overallLevel(s) };
  }, [health, activeProposals]);

  useEffect(() => {
    if (tracked.current || !health) return;
    tracked.current = true;
    posthog.capture('risk_signals_viewed', { level });
  }, [health, level]);

  if (!health) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Governance Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0" />
            Connect wallet and delegate to see governance health
          </p>
        </CardContent>
      </Card>
    );
  }

  const style = LEVEL_STYLES[level];
  const SignalIcon = style.icon;

  return (
    <Card className={`${style.border} ${style.bg}`}>
      <CardHeader className="pb-3">
        <CardTitle className={`text-base flex items-center gap-2 ${style.title}`}>
          <ShieldCheck className="h-4 w-4" />
          Governance Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {level === 'green' ? (
          <p className="text-sm flex items-center gap-2 text-green-800 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            All clear — your DRep is active and aligned
          </p>
        ) : (
          <ul className="space-y-2">
            {signals.map((s, i) => {
              const BulletIcon = s.level === 'red' ? AlertOctagon : AlertTriangle;
              const bulletColor =
                s.level === 'red'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400';
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <BulletIcon className={`h-4 w-4 shrink-0 mt-0.5 ${bulletColor}`} />
                  <span>{s.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
