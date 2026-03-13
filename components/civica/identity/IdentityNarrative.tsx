'use client';

/* ── Types ──────────────────────────────────────────────────────── */

interface IdentityNarrativeProps {
  participationTier: 'observer' | 'participant' | 'active' | 'champion';
  drepName: string | null;
  delegationAgeDays: number | null;
  proposalsInfluenced: number;
  pulse: number;
  pulseLabel: string;
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

/* ── Component ─────────────────────────────────────────────────── */

export function IdentityNarrative({
  participationTier,
  drepName,
  delegationAgeDays,
  proposalsInfluenced,
  pulseLabel,
}: IdentityNarrativeProps) {
  if (!drepName) {
    return (
      <p className="text-sm text-muted-foreground">
        Connect your delegation to start building your governance identity.
      </p>
    );
  }

  const duration = delegationAgeDays != null ? ` for ${formatDuration(delegationAgeDays)}` : '';

  return (
    <p className="text-sm text-muted-foreground">
      {TIER_ADJECTIVE[participationTier]} citizen. Delegating to {drepName}
      {duration}. {proposalsInfluenced} proposals influenced. Governance Pulse: {pulseLabel}.
    </p>
  );
}
