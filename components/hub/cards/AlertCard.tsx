'use client';

import { Bell, ShieldAlert, TrendingDown } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceHolder } from '@/hooks/queries';
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

  // No DRep = no alert (RepresentationCard handles the undelegated state)
  if (!delegatedDrep) return null;

  const holder = holderRaw as Record<string, unknown> | undefined;
  if (!holder) return null;

  const drep = holder.drep as Record<string, unknown> | undefined;
  if (!drep) return null;

  const isActive = (drep.isActive as boolean) ?? true;
  const participationRate = (drep.participationRate as number) ?? 100;
  const scoreChange = (drep.scoreChange as number) ?? 0;

  // Check for alert conditions
  type AlertInfo = { message: string; detail: string; urgency: CardUrgency; icon: typeof Bell };

  let alert: AlertInfo | null = null;

  if (!isActive) {
    alert = {
      message: 'Your DRep is no longer active',
      detail: 'Consider finding a new representative to keep your ADA voiced.',
      urgency: 'critical',
      icon: ShieldAlert,
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

  // Nothing needs attention — don't render
  if (!alert) return null;

  const AlertIcon = alert.icon;

  return (
    <HubCard href="/delegation" urgency={alert.urgency} label={alert.message}>
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
