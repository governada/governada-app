'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { CommunityGapItem, LeaderboardEntry } from '@/types/api';

interface GovernanceAlertsProps {
  communityGap?: CommunityGapItem[];
  spotlightProposal?: {
    txHash: string;
    index: number;
    title: string;
    proposalType?: string;
    voteCoverage?: number;
  } | null;
  gainers?: LeaderboardEntry[];
  losers?: LeaderboardEntry[];
  criticalProposals?: number;
  loading?: boolean;
}

interface Alert {
  priority: number;
  icon: React.ReactNode;
  headline: string;
  detail: string;
  href: string;
}

function buildAlerts(props: GovernanceAlertsProps): Alert[] {
  const { communityGap, spotlightProposal, gainers, losers, criticalProposals } = props;

  const alerts: Alert[] = [];

  // --- Critical proposals alert (priority 0) ---
  if (criticalProposals && criticalProposals > 0) {
    alerts.push({
      priority: 0,
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />,
      headline: `${criticalProposals} critical proposal${criticalProposals > 1 ? 's' : ''} need${criticalProposals === 1 ? 's' : ''} DRep attention`,
      detail: spotlightProposal
        ? `${spotlightProposal.title} has ${spotlightProposal.voteCoverage ?? 0}% DRep coverage`
        : 'Review active proposals before the voting deadline',
      href: '/governance/proposals',
    });
  } else if (spotlightProposal?.voteCoverage != null) {
    const coverage = spotlightProposal.voteCoverage;
    if (coverage < 30) {
      alerts.push({
        priority: 0,
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />,
        headline: 'Low engagement on active proposal',
        detail: `${spotlightProposal.title} has only ${coverage}% DRep coverage`,
        href: `/proposal/${spotlightProposal.txHash}/${spotlightProposal.index}`,
      });
    } else if (coverage > 80) {
      alerts.push({
        priority: 0,
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />,
        headline: 'High engagement on active proposal',
        detail: `${spotlightProposal.title} has ${coverage}% DRep coverage`,
        href: `/proposal/${spotlightProposal.txHash}/${spotlightProposal.index}`,
      });
    }
  }

  // --- Sentiment divergence alert (priority 1) ---
  if (communityGap?.length) {
    for (const g of communityGap) {
      const yesPct = Math.round(((g.pollYes ?? 0) / (g.pollTotal || 1)) * 100);
      const drepPct = g.drepVotePct ?? 0;
      const diff = Math.abs(yesPct - drepPct);

      if (diff > 20) {
        alerts.push({
          priority: 1,
          icon: <Users className="h-4 w-4 text-blue-500" aria-hidden />,
          headline: `Sentiment divergence on "${g.title}"`,
          detail: `Community polls ${yesPct}% in favor vs ${drepPct}% DRep support — ${diff}pp gap`,
          href: `/proposal/${g.txHash}/${g.index}`,
        });
      }
    }
  }

  // --- DRep movement alerts (priority 2) ---
  if (gainers?.length) {
    for (const g of gainers) {
      if (g.delta != null && Math.abs(g.delta) >= 5) {
        alerts.push({
          priority: 2,
          icon: <TrendingUp className="h-4 w-4 text-emerald-500" aria-hidden />,
          headline: `${g.name ?? g.drepId ?? 'A DRep'} surged +${g.delta.toFixed(1)} points`,
          detail:
            g.currentScore != null
              ? `Now at ${g.currentScore.toFixed(1)} — one of this epoch's biggest movers`
              : "One of this epoch's biggest movers",
          href: g.drepId ? `/drep/${g.drepId}` : '/governance/representatives',
        });
      }
    }
  }

  if (losers?.length) {
    for (const l of losers) {
      if (l.delta != null && Math.abs(l.delta) >= 5) {
        alerts.push({
          priority: 2,
          icon: <TrendingDown className="h-4 w-4 text-rose-500" aria-hidden />,
          headline: `${l.name ?? l.drepId ?? 'A DRep'} dropped ${l.delta.toFixed(1)} points`,
          detail:
            l.currentScore != null
              ? `Now at ${l.currentScore.toFixed(1)} — significant score decline this epoch`
              : 'Significant score decline this epoch',
          href: l.drepId ? `/drep/${l.drepId}` : '/governance/representatives',
        });
      }
    }
  }

  // Sort by priority, then take at most 4
  alerts.sort((a, b) => a.priority - b.priority);
  return alerts.slice(0, 4);
}

export function GovernanceAlerts(props: GovernanceAlertsProps) {
  const { loading } = props;

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const alerts = buildAlerts(props);

  return (
    <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-4 space-y-3">
      {alerts.length === 0 ? (
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">No governance alerts this epoch</p>
            <p className="text-xs text-muted-foreground">
              Participation, proposals, and representation all look healthy.
            </p>
          </div>
        </div>
      ) : (
        alerts.map((alert, i) => (
          <Link
            key={i}
            href={alert.href}
            className={cn(
              'flex items-start gap-3 py-2 border-b border-border/30 last:border-0',
              'group hover:bg-muted/30 rounded-md -mx-1 px-1 transition-colors',
            )}
          >
            <span className="shrink-0 mt-0.5">{alert.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{alert.headline}</p>
              <p className="text-xs text-muted-foreground truncate">{alert.detail}</p>
            </div>
            <ChevronRight
              className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-hidden
            />
          </Link>
        ))
      )}
    </div>
  );
}
