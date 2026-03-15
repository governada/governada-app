'use client';

import { cn } from '@/lib/utils';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { TierBadge } from '@/components/governada/cards/TierBadge';
import { tierKey, type TierKey } from '@/components/governada/cards/tierStyles';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { CheckCircle2, MinusCircle, AlertCircle, Info } from 'lucide-react';

/* ─── Types ───────────────────────────────────────────── */

export interface TrustSignal {
  key: 'participation' | 'rationale' | 'reliability' | 'delegation_trend' | 'profile_quality';
  label: string;
  value: number;
  status: 'strong' | 'moderate' | 'weak';
  detail?: string;
}

interface TrustSignalsProps {
  tier: string;
  tierColor?: string;
  signals: TrustSignal[];
  className?: string;
}

/* ─── Status styling ──────────────────────────────────── */

const STATUS_CONFIG: Record<
  TrustSignal['status'],
  { icon: typeof CheckCircle2; colorClass: string }
> = {
  strong: {
    icon: CheckCircle2,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
  },
  moderate: {
    icon: MinusCircle,
    colorClass: 'text-amber-600 dark:text-amber-400',
  },
  weak: {
    icon: AlertCircle,
    colorClass: 'text-rose-600 dark:text-rose-400',
  },
};

/* ─── Methodology descriptions ────────────────────────── */

const METHODOLOGY: Record<TrustSignal['key'], string> = {
  participation:
    'Based on importance-weighted voting coverage. Proposals affecting protocol security or treasury are weighted higher.',
  rationale: 'Percentage of votes accompanied by a written explanation.',
  reliability: 'Consecutive epochs with at least one vote. Gaps reduce this signal.',
  delegation_trend: 'Change in delegated voting power compared to previous epoch.',
  profile_quality: 'Completeness of CIP-100 metadata profile and on-chain verification.',
};

const SIGNAL_LABEL: Record<TrustSignal['key'], string> = {
  participation: 'Participation',
  rationale: 'Rationale',
  reliability: 'Reliability',
  delegation_trend: 'Delegation Trend',
  profile_quality: 'Profile Quality',
};

/* ─── Signal row component ────────────────────────────── */

function SignalRow({ signal }: { signal: TrustSignal }) {
  const config = STATUS_CONFIG[signal.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className={cn('h-4 w-4 shrink-0', config.colorClass)} />
      <span className="text-sm text-foreground truncate">{signal.label}</span>
      {signal.detail && (
        <span className="text-xs text-muted-foreground hidden sm:inline">{signal.detail}</span>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────── */

export function TrustSignals({ tier, signals, className }: TrustSignalsProps) {
  const { isAtLeast } = useGovernanceDepth();
  const safeTier: TierKey = tierKey(tier);

  // Determine which signals to show based on depth
  const visibleSignals = getVisibleSignals(signals, isAtLeast);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Tier badge — always visible */}
      <div className="flex items-center gap-3 flex-wrap">
        <TierBadge tier={safeTier} />

        {/* Signal indicators — inline for compact hero layout */}
        {visibleSignals.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {visibleSignals.map((signal) => (
              <SignalRow key={signal.key} signal={signal} />
            ))}
          </div>
        )}
      </div>

      {/* Methodology accordion — deep depth only */}
      {isAtLeast('deep') && visibleSignals.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="methodology" className="border-border/30">
            <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                How this is calculated
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <dl className="space-y-2">
                {visibleSignals.map((signal) => (
                  <div key={signal.key}>
                    <dt className="text-xs font-medium text-foreground">
                      {SIGNAL_LABEL[signal.key]}
                    </dt>
                    <dd className="text-xs text-muted-foreground leading-relaxed">
                      {METHODOLOGY[signal.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

/* ─── Depth-based signal filtering ────────────────────── */

function getVisibleSignals(
  signals: TrustSignal[],
  isAtLeast: (threshold: 'hands_off' | 'informed' | 'engaged' | 'deep') => boolean,
): TrustSignal[] {
  // hands_off: no signals, tier badge only
  if (!isAtLeast('informed')) return [];

  // informed: participation + reliability (first 2 key signals)
  if (!isAtLeast('engaged')) {
    return signals.filter((s) => s.key === 'participation' || s.key === 'reliability');
  }

  // engaged + deep: all signals
  return signals;
}

/* ─── Server-side helper ──────────────────────────────── */

/**
 * Compute TrustSignals from raw DRep data without calling the API.
 * Mirrors the logic in `app/api/drep/[drepId]/alignment/route.ts`.
 */
export function computeTrustSignals(drep: {
  effectiveParticipation?: number | null;
  rationaleRate?: number | null;
  reliabilityStreak?: number | null;
  reliabilityRecency?: number | null;
  delegatorCount?: number | null;
  previousDelegatorCount?: number | null;
  profileCompleteness?: number | null;
  metadataHashVerified?: boolean | null;
}): TrustSignal[] {
  const signals: TrustSignal[] = [];

  // Participation
  const participation = drep.effectiveParticipation ?? 0;
  signals.push({
    key: 'participation',
    label:
      participation >= 70
        ? `Votes on ${Math.round(participation)}% of proposals`
        : participation >= 40
          ? `Votes on ${Math.round(participation)}% of proposals`
          : `Limited voting (${Math.round(participation)}%)`,
    value: participation,
    status: participation >= 70 ? 'strong' : participation >= 40 ? 'moderate' : 'weak',
  });

  // Rationale
  const rationaleRate = drep.rationaleRate ?? 0;
  signals.push({
    key: 'rationale',
    label:
      rationaleRate >= 60
        ? 'Writes rationale on most votes'
        : rationaleRate >= 30
          ? 'Sometimes provides rationale'
          : 'Rarely provides rationale',
    value: rationaleRate,
    status: rationaleRate >= 60 ? 'strong' : rationaleRate >= 30 ? 'moderate' : 'weak',
  });

  // Reliability
  const reliabilityStreak = drep.reliabilityStreak ?? 0;
  const reliabilityRecency = drep.reliabilityRecency ?? 999;
  const reliabilityStatus: TrustSignal['status'] =
    reliabilityStreak >= 10 ? 'strong' : reliabilityRecency <= 2 ? 'moderate' : 'weak';

  signals.push({
    key: 'reliability',
    label:
      reliabilityStreak >= 10
        ? `Active ${reliabilityStreak} consecutive epochs`
        : reliabilityRecency <= 2
          ? 'Voted recently'
          : reliabilityRecency < 999
            ? `Inactive for ${reliabilityRecency} epochs`
            : 'No voting history yet',
    value: reliabilityStreak,
    status: reliabilityStatus,
  });

  // Delegation trend
  const current = drep.delegatorCount ?? 0;
  const previous = drep.previousDelegatorCount ?? null;

  if (previous !== null && previous > 0) {
    const change = ((current - previous) / previous) * 100;
    const trendStatus: TrustSignal['status'] =
      change > 5 ? 'strong' : change > -5 ? 'moderate' : 'weak';

    signals.push({
      key: 'delegation_trend',
      label:
        change > 5
          ? `Growing delegation (+${Math.round(change)}%)`
          : change > -5
            ? 'Stable delegation'
            : `Declining delegation (${Math.round(change)}%)`,
      value: Math.round(change),
      status: trendStatus,
      detail: `${current.toLocaleString()} delegators`,
    });
  } else {
    signals.push({
      key: 'delegation_trend',
      label: 'Delegation trend unavailable',
      value: 0,
      status: 'weak',
    });
  }

  // Profile quality
  const profileCompleteness = drep.profileCompleteness ?? 0;
  const metadataHashVerified = drep.metadataHashVerified ?? false;
  const profileStatus: TrustSignal['status'] =
    profileCompleteness >= 80 && metadataHashVerified
      ? 'strong'
      : profileCompleteness >= 50
        ? 'moderate'
        : 'weak';

  signals.push({
    key: 'profile_quality',
    label:
      profileCompleteness >= 80 && metadataHashVerified
        ? 'Complete, verified profile'
        : profileCompleteness >= 50
          ? 'Partial profile'
          : 'Minimal profile',
    value: profileCompleteness,
    status: profileStatus,
    detail: metadataHashVerified ? 'Verified metadata' : undefined,
  });

  return signals;
}
