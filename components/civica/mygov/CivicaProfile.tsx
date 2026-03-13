'use client';

import Link from 'next/link';
import { User, Shield, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet-context';
import { useUser } from '@/hooks/queries';
import {
  tierKey,
  TIER_SCORE_COLOR,
  TIER_BADGE_BG,
  TIER_BORDER,
} from '@/components/civica/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { EmailOptIn } from '@/components/notifications/EmailOptIn';
import { GovernanceTuner } from '@/components/civica/mygov/GovernanceTuner';

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CivicaProfile() {
  const { segment, stakeAddress, drepId, poolId, delegatedDrep } = useSegment();
  const { disconnect } = useWallet();
  const { data: rawUser, isLoading: userLoading } = useUser();

  const user = rawUser as Record<string, unknown> | undefined;
  const displayName: string = (user?.display_name as string) ?? '';

  // Tier / score from user data (if DRep or SPO)
  const score: number = (user?.drepScore as number) ?? (user?.spoScore as number) ?? 0;
  const tier = computeTier(score);
  const tKey = tierKey(tier);

  const segmentLabel =
    segment === 'drep'
      ? 'DRep'
      : segment === 'spo'
        ? 'SPO'
        : segment === 'citizen'
          ? 'Delegator'
          : 'Anonymous';

  const truncatedAddress = stakeAddress
    ? `${stakeAddress.slice(0, 12)}…${stakeAddress.slice(-8)}`
    : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Choose how closely you follow governance.
        </p>
      </div>

      {/* Identity card */}
      <div
        className={cn(
          'rounded-xl border p-5 space-y-4',
          segment === 'drep' || segment === 'spo' ? TIER_BORDER[tKey] : 'border-border',
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'h-12 w-12 rounded-full flex items-center justify-center shrink-0',
              segment === 'drep' || segment === 'spo' ? TIER_BADGE_BG[tKey] : 'bg-primary/10',
            )}
          >
            <User
              className={cn(
                'h-6 w-6',
                segment === 'drep' || segment === 'spo' ? TIER_SCORE_COLOR[tKey] : 'text-primary',
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            {userLoading ? (
              <Skeleton className="h-5 w-32 mb-1" />
            ) : (
              <p className="font-bold text-base leading-snug truncate">
                {displayName || truncatedAddress}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={cn(
                  'text-[11px] font-bold px-2 py-0.5 rounded-full',
                  segment === 'drep' || segment === 'spo'
                    ? cn(TIER_BADGE_BG[tKey], TIER_SCORE_COLOR[tKey])
                    : 'bg-primary/10 text-primary',
                )}
              >
                {segmentLabel}
              </span>
              {(segment === 'drep' || segment === 'spo') && score > 0 && (
                <span className="text-[11px] text-muted-foreground">{tier} tier</span>
              )}
            </div>
          </div>
          {(segment === 'drep' || segment === 'spo') && score > 0 && (
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  'font-display text-3xl font-bold tabular-nums',
                  TIER_SCORE_COLOR[tKey],
                )}
              >
                {score.toFixed(0)}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">score</p>
            </div>
          )}
        </div>

        {/* Wallet info */}
        <div className="rounded-lg bg-muted/30 px-4 py-3 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Stake address</span>
            <span className="font-mono text-foreground/80">{truncatedAddress}</span>
          </div>
          {segment === 'citizen' && delegatedDrep && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delegated to</span>
              <Link
                href={`/drep/${delegatedDrep}`}
                className="text-primary hover:underline truncate max-w-[160px]"
              >
                {delegatedDrep.slice(0, 16)}…
              </Link>
            </div>
          )}
          {segment === 'drep' && drepId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">DRep ID</span>
              <Link
                href={`/drep/${drepId}`}
                className="text-primary hover:underline truncate max-w-[160px] font-mono"
              >
                {drepId.slice(0, 16)}…
              </Link>
            </div>
          )}
          {segment === 'spo' && poolId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool ID</span>
              <Link
                href={`/pool/${poolId}`}
                className="text-primary hover:underline truncate max-w-[160px] font-mono"
              >
                {poolId.slice(0, 16)}…
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Governance Tuner — the dominant settings control */}
      <GovernanceTuner />

      {/* Email opt-in for governance briefings */}
      <EmailOptIn variant="inline" className="border border-border" />

      {/* Display preferences */}
      <Section icon={Settings} title="Display">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">
                Dark mode is the recommended experience for governance data.
              </p>
            </div>
            <Link href="/my-gov" className="text-xs text-muted-foreground">
              Use system toggle
            </Link>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section icon={Shield} title="Security">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Authentication</span>
            <span className="text-emerald-400 font-medium">Wallet connected</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Governada uses your Cardano wallet for authentication. No passwords or email required.
          </p>
        </div>
      </Section>

      {/* Danger zone */}
      <div className="rounded-xl border border-rose-900/30 bg-rose-950/5 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-rose-900/20">
          <LogOut className="h-4 w-4 text-rose-400" />
          <h3 className="text-sm font-semibold text-rose-300">Disconnect</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Disconnecting your wallet removes all session data from this device. Your on-chain
            governance record is permanent.
          </p>
          <button
            onClick={() => {
              disconnect();
              sessionStorage.removeItem('civica_segment');
              window.location.href = '/';
            }}
            className="flex items-center gap-2 text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Disconnect wallet
          </button>
        </div>
      </div>
    </div>
  );
}
