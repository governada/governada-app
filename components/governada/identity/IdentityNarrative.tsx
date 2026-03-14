'use client';

import { useQuery } from '@tanstack/react-query';
import type { RingValues } from '@/lib/governanceRings';

/* ── Types ──────────────────────────────────────────────────────── */

interface IdentityNarrativeProps {
  participationTier: 'observer' | 'participant' | 'active' | 'champion';
  drepName: string | null;
  delegationAgeDays: number | null;
  proposalsInfluenced: number;
  pulse: number;
  pulseLabel: string;
  /** Ring fill values for AI narrative context */
  rings?: RingValues;
  /** Archetype label for AI narrative context */
  archetype?: string | null;
  /** Number of milestones earned for AI narrative context */
  milestonesEarned?: number;
}

/* ── Tier adjectives ───────────────────────────────────────────── */

const TIER_ADJECTIVE: Record<IdentityNarrativeProps['participationTier'], string> = {
  observer: 'Observing',
  participant: 'Participating',
  active: 'Active',
  champion: 'Champion',
};

/* ── Helpers ────────────────────────────────────────────────────── */

function formatDuration(days: number): string {
  if (days < 1) return 'less than a day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const epochs = Math.floor(days / 5);
  return `${epochs} epochs`;
}

/* ── AI narrative fetcher ──────────────────────────────────────── */

function useAINarrative(props: IdentityNarrativeProps) {
  const hasRings = props.rings && props.drepName;

  return useQuery<{ narrative: string | null }>({
    queryKey: ['identity-narrative', props.pulse],
    queryFn: async () => {
      const res = await fetch('/api/you/identity-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetype: props.archetype ?? null,
          drepName: props.drepName,
          delegationAgeDays: props.delegationAgeDays,
          participationTier: props.participationTier,
          pulse: props.pulse,
          pulseLabel: props.pulseLabel,
          delegationRing: props.rings?.delegation ?? 0,
          coverageRing: props.rings?.coverage ?? 0,
          engagementRing: props.rings?.engagement ?? 0,
          milestonesEarned: props.milestonesEarned ?? 0,
          proposalsInfluenced: props.proposalsInfluenced,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!hasRings,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

/* ── Component ─────────────────────────────────────────────────── */

export function IdentityNarrative(props: IdentityNarrativeProps) {
  const { participationTier, drepName, delegationAgeDays, proposalsInfluenced, pulseLabel } = props;
  const { data: aiData } = useAINarrative(props);

  if (!drepName) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your delegation to start building your governance identity.
      </p>
    );
  }

  // Use AI narrative when available, fall back to template
  if (aiData?.narrative) {
    return <p className="text-sm text-muted-foreground italic">{aiData.narrative}</p>;
  }

  // Template fallback
  const duration = delegationAgeDays != null ? ` for ${formatDuration(delegationAgeDays)}` : '';

  return (
    <p className="text-sm text-muted-foreground">
      {TIER_ADJECTIVE[participationTier]} citizen. Delegating to {drepName}
      {duration}. {proposalsInfluenced} proposals influenced. Governance Pulse: {pulseLabel}.
    </p>
  );
}
