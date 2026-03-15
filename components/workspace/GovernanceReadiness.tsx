'use client';

import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CockpitData } from '@/hooks/queries';
import { ScoreImpactPreview } from './ScoreImpactPreview';

type Status = 'clear' | 'action' | 'urgent';

interface ReadinessItem {
  label: string;
  status: Status;
  detail: string;
}

function getReadinessItems(data: CockpitData): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const { actionFeed } = data;

  // Pending votes
  const urgentCount = actionFeed.pendingProposals.filter((p) => p.isUrgent).length;
  const pendingCount = actionFeed.pendingCount;

  if (urgentCount > 0) {
    items.push({
      label: 'Votes',
      status: 'urgent',
      detail: `${urgentCount} expiring soon`,
    });
  } else if (pendingCount > 0) {
    items.push({
      label: 'Votes',
      status: 'action',
      detail: `${pendingCount} pending`,
    });
  } else {
    items.push({ label: 'Votes', status: 'clear', detail: 'All caught up' });
  }

  // Rationales
  if (actionFeed.unexplainedVotes.length > 0) {
    items.push({
      label: 'Rationales',
      status: 'action',
      detail: `${actionFeed.unexplainedVotes.length} unexplained`,
    });
  } else {
    items.push({ label: 'Rationales', status: 'clear', detail: 'All explained' });
  }

  // Questions
  if (actionFeed.unansweredQuestions > 0) {
    items.push({
      label: 'Questions',
      status: 'action',
      detail: `${actionFeed.unansweredQuestions} unanswered`,
    });
  } else {
    items.push({ label: 'Questions', status: 'clear', detail: 'None pending' });
  }

  // Score health
  if (actionFeed.scoreAlerts.delta < -3) {
    items.push({
      label: 'Score',
      status: 'urgent',
      detail: `Down ${Math.abs(actionFeed.scoreAlerts.delta)} pts`,
    });
  } else if (actionFeed.scoreAlerts.delta < 0) {
    items.push({
      label: 'Score',
      status: 'action',
      detail: `Down ${Math.abs(actionFeed.scoreAlerts.delta)} pts`,
    });
  } else {
    items.push({
      label: 'Score',
      status: 'clear',
      detail: actionFeed.scoreAlerts.delta > 0 ? `Up ${actionFeed.scoreAlerts.delta}` : 'Stable',
    });
  }

  return items;
}

const STATUS_CONFIG: Record<Status, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  clear: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  action: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  urgent: {
    icon: AlertCircle,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
};

export function GovernanceReadiness({ data }: { data: CockpitData }) {
  const items = getReadinessItems(data);
  const allClear = items.every((i) => i.status === 'clear');

  const { actionFeed, score } = data;
  const pendingCount = actionFeed.pendingCount;
  // Total eligible = pending + already voted (use pending + all proposals we know about)
  const totalEligible = pendingCount + actionFeed.unexplainedVotes.length + pendingCount;
  const currentParticipation = score.pillars.effectiveParticipation;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 space-y-3',
        allClear ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Governance Readiness</h3>
        {allClear && <span className="text-xs font-medium text-emerald-500">All clear</span>}
      </div>

      {/* Score impact preview — show potential gain from voting */}
      {pendingCount > 0 && (
        <ScoreImpactPreview
          pendingCount={pendingCount}
          currentParticipationRate={currentParticipation}
          totalEligibleProposals={Math.max(totalEligible, pendingCount)}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const Icon = config.icon;

          return (
            <div
              key={item.label}
              className={cn('flex items-center gap-2 rounded-lg px-3 py-2', config.bg)}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', config.color)} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{item.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
