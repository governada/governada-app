'use client';

import { useState } from 'react';
import Link from 'next/link';
import { User, LogOut, Wallet } from 'lucide-react';
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
} from '@/components/governada/cards/tierStyles';
import { computeTier } from '@/lib/scoring/tiers';
import { EmailOptIn } from '@/components/notifications/EmailOptIn';
import { GovernanceTuner } from '@/components/governada/mygov/GovernanceTuner';
import { BYOKSettings } from '@/components/settings/BYOKSettings';
import { FeatureGate } from '@/components/FeatureGate';

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GovernadaProfile() {
  const { segment, stakeAddress, drepId, poolId, delegatedDrep } = useSegment();
  const { disconnect } = useWallet();
  const { data: rawUser, isLoading: userLoading } = useUser();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

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

  // A8: Anonymous full-page state
  if (segment === 'anonymous') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold">Your Governance Experience</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Control how Governada serves you.</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-12 text-center space-y-3">
          <Wallet className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-base font-semibold">Connect your wallet to get started</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Personalize your governance depth, get epoch briefings, and tailor your entire Governada
            experience.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* A3: Identity-forward header */}
      <div>
        <h2 className="font-display text-xl font-bold">Your Governance Experience</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Control how Governada serves you.</p>
      </div>

      {/* Identity card — A6: Security folded in */}
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

        {/* Wallet info — A6: includes auth status */}
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
              <span className="text-muted-foreground">DRep</span>
              <Link
                href={`/drep/${drepId}`}
                className="text-primary hover:underline truncate max-w-[200px]"
              >
                {displayName || drepId.slice(0, 16) + '…'}
              </Link>
            </div>
          )}
          {segment === 'drep' && drepId && displayName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">DRep ID</span>
              <span className="truncate max-w-[160px] font-mono text-foreground/80">
                {drepId.slice(0, 16)}…
              </span>
            </div>
          )}
          {segment === 'spo' && poolId && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool</span>
              <Link
                href={`/pool/${poolId}`}
                className="text-primary hover:underline truncate max-w-[200px]"
              >
                {displayName || poolId.slice(0, 16) + '…'}
              </Link>
            </div>
          )}
          {segment === 'spo' && poolId && displayName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pool ID</span>
              <span className="truncate max-w-[160px] font-mono text-foreground/80">
                {poolId.slice(0, 16)}…
              </span>
            </div>
          )}
          {/* A6: Auth status folded into wallet info */}
          <div className="flex justify-between pt-1 border-t border-border/30">
            <span className="text-muted-foreground">Authentication</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              Wallet connected
            </span>
          </div>
        </div>
      </div>

      {/* A13: Tighter identity→tuner gap */}
      <div className="-mt-3">
        <GovernanceTuner />
      </div>

      {/* Email opt-in for governance briefings */}
      <EmailOptIn variant="inline" className="border border-border" />

      {/* A13: Advanced group label */}
      <div className="space-y-4 pt-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Advanced
        </p>

        {/* BYOK API Keys */}
        <FeatureGate flag="byok_api_keys">
          <BYOKSettings />
        </FeatureGate>

        {/* A12: Danger zone with confirmation */}
        <div className="rounded-xl border border-rose-900/30 bg-rose-950/5 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-rose-900/20">
            <LogOut className="h-4 w-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-rose-300">End Session</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              This removes all session data from this device. Your on-chain governance record is
              permanent.
            </p>
            {!confirmDisconnect ? (
              <button
                onClick={() => setConfirmDisconnect(true)}
                className="flex items-center gap-2 text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Disconnect wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    disconnect();
                    sessionStorage.removeItem('governada_segment');
                    window.location.href = '/';
                  }}
                  className="text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Yes, disconnect
                </button>
                <button
                  onClick={() => setConfirmDisconnect(false)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
