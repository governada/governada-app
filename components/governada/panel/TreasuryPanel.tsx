'use client';

/**
 * TreasuryPanel — Intelligence panel content for /governance/treasury.
 *
 * Shows treasury briefing, key signals, personal treasury stance, and suggested actions.
 * Fetches treasury data from client-side hooks and generates narrative locally.
 */

import { useSegment } from '@/components/providers/SegmentProvider';
import { CollapsibleSection } from './CollapsibleSection';
import { CitedClaim } from './CitedClaim';
import { PanelSkeleton } from './PanelSkeleton';
import { useTreasuryCurrent, useTreasuryNcl } from '@/hooks/queries';
import { useDRepTreasuryRecord } from '@/hooks/useDRepTreasuryRecord';
import {
  generateTreasuryNarrative,
  formatAda,
  calculateRunwayMonths,
  calculateBurnRate,
} from '@/lib/treasury';
import type { TreasuryNarrativeData, NclUtilization } from '@/lib/treasury';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ContextHighlight, SuggestedAction } from '@/lib/intelligence/context';

export function TreasuryPanel() {
  const { stakeAddress, drepId } = useSegment();

  const { data: currentData, isLoading: currentLoading } = useTreasuryCurrent();
  const { data: nclData, isLoading: nclLoading } = useTreasuryNcl();
  const { data: drepRecordData } = useDRepTreasuryRecord(drepId);

  const isLoading = currentLoading || nclLoading;

  if (isLoading) return <PanelSkeleton sections={3} />;

  // Extract treasury data
  const treasury = currentData as
    | {
        balance?: { balanceAda: number; epoch: number };
        trend?: {
          snapshots: Array<{
            epoch: number;
            balanceAda: number;
            withdrawalsAda: number;
            reservesIncomeAda: number;
            snapshotAt: string;
          }>;
        };
        pending?: {
          proposals: Array<{ withdrawalAda: number | null }>;
          totalAda: number;
          count: number;
        };
        effectiveness?: { rate: number | null };
      }
    | undefined;
  const ncl = (nclData?.ncl ?? null) as NclUtilization | null;

  const balanceAda = treasury?.balance?.balanceAda ?? 0;
  const pendingCount = treasury?.pending?.count ?? 0;
  const pendingTotalAda = treasury?.pending?.totalAda ?? 0;
  const effectivenessRate = treasury?.effectiveness?.rate ?? null;

  // Compute burn rate and runway from trend snapshots
  const snapshots = treasury?.trend?.snapshots ?? [];
  const burnRate = calculateBurnRate(snapshots);
  const runwayMonths = calculateRunwayMonths(balanceAda, burnRate);

  // Determine trend direction
  let trend: TreasuryNarrativeData['trend'] = 'stable';
  if (snapshots.length >= 3) {
    const recent = snapshots.slice(-3);
    const first = recent[0].balanceAda;
    const last = recent[recent.length - 1].balanceAda;
    if (last > first * 1.01) trend = 'growing';
    else if (last < first * 0.99) trend = 'shrinking';
  }

  // Generate narrative
  const narrativeData: TreasuryNarrativeData = {
    balanceAda,
    trend,
    effectivenessRate,
    pendingCount,
    pendingTotalAda,
    runwayMonths,
    ncl,
  };
  const briefing = balanceAda > 0 ? generateTreasuryNarrative(narrativeData) : '';

  // Build highlights
  const highlights: ContextHighlight[] = [];

  // Runway signal
  const runwayYears = runwayMonths / 12;
  highlights.push({
    label: 'Runway',
    value: runwayYears > 20 ? '10+ years' : `${Math.round(runwayMonths)}mo`,
    sentiment: runwayMonths > 24 ? 'positive' : runwayMonths > 12 ? 'neutral' : 'negative',
  });

  // NCL utilization signal
  if (ncl) {
    highlights.push({
      label: 'NCL Used',
      value: `${Math.round(ncl.utilizationPct)}%`,
      sentiment:
        ncl.utilizationPct > 75 ? 'negative' : ncl.utilizationPct > 50 ? 'neutral' : 'positive',
    });
  }

  // Effectiveness signal
  if (effectivenessRate !== null) {
    highlights.push({
      label: 'Effectiveness',
      value: `${effectivenessRate}%`,
      sentiment:
        effectivenessRate > 70 ? 'positive' : effectivenessRate > 50 ? 'neutral' : 'negative',
    });
  }

  // Pending proposals signal
  if (pendingCount > 0) {
    highlights.push({
      label: 'Pending',
      value: `${pendingCount} (${formatAda(pendingTotalAda)} ADA)`,
      sentiment: pendingTotalAda > 50_000_000 ? 'negative' : 'neutral',
    });
  }

  // Build suggested actions
  const suggestedActions: SuggestedAction[] = [];
  if (pendingCount > 0) {
    suggestedActions.push({
      label: `Review ${pendingCount} pending treasury proposal${pendingCount !== 1 ? 's' : ''}`,
      href: '/governance/proposals',
      priority: 'high',
    });
  }
  suggestedActions.push({
    label: 'Explore treasury details',
    href: '/governance/treasury',
    priority: 'low',
  });

  // DRep treasury record
  const drepRecord = drepRecordData?.record;

  return (
    <div>
      {/* Treasury Briefing */}
      {briefing && (
        <CollapsibleSection title="Treasury Briefing" defaultExpanded>
          <p className="text-xs text-muted-foreground/80 leading-relaxed">
            <CitedClaim
              citations={[
                { label: 'Treasury data', href: '/governance/treasury' },
                { label: 'On-chain snapshots' },
              ]}
            >
              {briefing}
            </CitedClaim>
          </p>
        </CollapsibleSection>
      )}

      {/* Key Signals */}
      {highlights.length > 0 && (
        <CollapsibleSection
          title="Key Signals"
          summary={highlights
            .map((h) => `${h.label}: ${h.value}`)
            .slice(0, 2)
            .join(' · ')}
        >
          <div className="space-y-1.5">
            {highlights.map((highlight, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">{highlight.label}</span>
                <span
                  className={cn(
                    'font-medium',
                    highlight.sentiment === 'positive' && 'text-emerald-400',
                    highlight.sentiment === 'negative' && 'text-red-400',
                    highlight.sentiment === 'neutral' && 'text-foreground/80',
                  )}
                >
                  {highlight.value}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Your Treasury Stance (connected only) */}
      {stakeAddress && drepRecord && (
        <CollapsibleSection
          title="Your Treasury Stance"
          summary={
            drepRecord.approvedAda > drepRecord.opposedAda
              ? 'Growth-leaning'
              : drepRecord.opposedAda > drepRecord.approvedAda
                ? 'Conservative-leaning'
                : 'Balanced'
          }
        >
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">Proposals Voted</span>
              <span className="font-medium text-foreground/80">{drepRecord.totalProposals}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">Approved</span>
              <span className="font-medium text-emerald-400">
                {drepRecord.approvedCount} ({formatAda(drepRecord.approvedAda)} ADA)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground/70">Opposed</span>
              <span className="font-medium text-red-400">
                {drepRecord.opposedCount} ({formatAda(drepRecord.opposedAda)} ADA)
              </span>
            </div>
            {drepRecord.judgmentScore !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground/70">Judgment Score</span>
                <span
                  className={cn(
                    'font-medium',
                    drepRecord.judgmentScore >= 70
                      ? 'text-emerald-400'
                      : drepRecord.judgmentScore >= 40
                        ? 'text-foreground/80'
                        : 'text-red-400',
                  )}
                >
                  {drepRecord.judgmentScore}/100
                </span>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Suggested Actions */}
      {suggestedActions.length > 0 && (
        <CollapsibleSection title="Suggested" summary={`${suggestedActions.length} actions`}>
          <div className="space-y-1">
            {suggestedActions.map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 rounded-md text-xs',
                  'hover:bg-accent/30 transition-colors group',
                  action.priority === 'high' && 'text-amber-300',
                  action.priority === 'medium' && 'text-foreground/80',
                  action.priority === 'low' && 'text-muted-foreground/70',
                )}
              >
                <span>{action.label}</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
