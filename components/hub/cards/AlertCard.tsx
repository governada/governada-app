'use client';

import { Bell, ShieldAlert, ShieldCheck, TrendingDown, GitCompareArrows } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder, useAlignmentDrift } from '@/hooks/queries';
import { useFeatureFlag } from '@/components/FeatureGate';
import { HubCard, type CardUrgency } from './HubCard';

/**
 * AlertCard — Conditional card for citizens.
 *
 * Only renders when something about the citizen's delegation needs attention:
 * - DRep went inactive
 * - DRep score dropped significantly
 * - DRep missed recent votes
 *
 * When everything is fine, this card doesn't render.
 * Smart alerts default to quiet.
 *
 * JTBD: "Does anything need my attention?"
 */
export function AlertCard() {
  const { stakeAddress, delegatedDrep } = useSegment();
  const { data: holderRaw } = useGovernanceHolder(stakeAddress);
  const { data: driftData } = useAlignmentDrift(delegatedDrep ? stakeAddress : null);
  const driftFlagEnabled = useFeatureFlag('alignment_drift');

  // No DRep = no alert (RepresentationCard handles the undelegated state)
  if (!delegatedDrep) return null;

  const holder = holderRaw as Record<string, unknown> | undefined;
  if (!holder) return null;

  const drep = holder.drep as Record<string, unknown> | undefined;
  if (!drep) return null;

  const isActive = (drep.isActive as boolean) ?? true;
  const participationRate = (drep.participationRate as number) ?? 100;
  const scoreChange = (drep.scoreChange as number) ?? 0;

  // Check for alert conditions (priority order: inactive > drift > participation > score drop)
  type AlertInfo = { message: string; detail: string; urgency: CardUrgency; icon: typeof Bell };

  let alert: AlertInfo | null = null;

  if (!isActive) {
    alert = {
      message: 'Your DRep is no longer active',
      detail: 'Consider finding a new representative to keep your ADA voiced.',
      urgency: 'critical',
      icon: ShieldAlert,
    };
  } else if (driftFlagEnabled && driftData?.drift?.classification === 'high') {
    alert = {
      message: 'Your values are misaligned with your DRep',
      detail:
        'Based on your governance profile, your priorities have diverged. Consider reviewing your delegation.',
      urgency: 'warning',
      icon: GitCompareArrows,
    };
  } else if (participationRate < 30) {
    alert = {
      message: 'Your DRep has low participation',
      detail: `Only ${Math.round(participationRate)}% of proposals voted on. Your voice may not be heard.`,
      urgency: 'warning',
      icon: TrendingDown,
    };
  } else if (scoreChange < -15) {
    alert = {
      message: 'Your DRep score dropped significantly',
      detail: 'Review their recent activity to decide if they still represent you well.',
      urgency: 'warning',
      icon: TrendingDown,
    };
  }

  // Nothing needs attention — show positive ambient insight instead of hiding
  if (!alert) {
    // Build a positive insight from available DRep data
    const drepName = (drep.name as string) || (drep.ticker as string) || 'Your DRep';
    const rationaleRate = drep.rationaleRate as number | undefined;
    const score = (drep.score as number) ?? 0;

    let insightMessage = `${drepName} is representing you well`;
    let insightDetail = 'No issues detected with your delegation.';

    if (rationaleRate != null && rationaleRate >= 70) {
      insightMessage = `${drepName} explains ${Math.round(rationaleRate)}% of their votes`;
      insightDetail = 'Strong transparency — you can see the reasoning behind your representation.';
    } else if (participationRate >= 80) {
      insightMessage = `${drepName} has voted on ${Math.round(participationRate)}% of proposals`;
      insightDetail = 'High participation — your ADA is consistently represented in decisions.';
    } else if (score >= 70) {
      insightMessage = `${drepName} has a strong governance score of ${Math.round(score)}`;
      insightDetail = 'Your representative is among the more effective DReps in the ecosystem.';
    }

    return (
      <HubCard href="/" urgency="success" label={insightMessage}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              All Good
            </span>
          </div>
          <p className="text-base font-semibold text-foreground">{insightMessage}</p>
          <p className="text-sm text-muted-foreground">{insightDetail}</p>
        </div>
      </HubCard>
    );
  }

  const AlertIcon = alert.icon;

  return (
    <HubCard href="/" urgency={alert.urgency} label={alert.message}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <AlertIcon
            className={`h-4 w-4 ${
              alert.urgency === 'critical' ? 'text-red-500' : 'text-amber-500'
            }`}
          />
          <span
            className={`text-xs font-medium uppercase tracking-wider ${
              alert.urgency === 'critical'
                ? 'text-red-600 dark:text-red-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            Needs Attention
          </span>
        </div>
        <p className="text-base font-semibold text-foreground">{alert.message}</p>
        <p className="text-sm text-muted-foreground">{alert.detail}</p>
      </div>
    </HubCard>
  );
}
