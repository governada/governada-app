'use client';

import { useState } from 'react';
import { useWallet } from '@/utils/wallet';
import { resolveRewardAddress } from '@meshsdk/core';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

interface PoolClaimCardProps {
  poolId: string;
  poolName: string;
  claimedBy: string | null;
}

export function PoolClaimCard({ poolId, poolName, claimedBy }: PoolClaimCardProps) {
  const { connected, address, connecting, reconnecting } = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(!!claimedBy);
  const [error, setError] = useState<string | null>(null);

  // Already claimed by someone
  if (claimed && claimedBy) {
    // Check if this wallet is the claimer
    if (connected && address === claimedBy) {
      return (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="p-2 rounded-full bg-primary/10 shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">You have claimed this pool</p>
              <p className="text-xs text-muted-foreground">
                Your governance identity score reflects your ownership. Visit your{' '}
                <a href="/my-gov" className="text-primary hover:underline">
                  command center
                </a>{' '}
                to manage your profile.
              </p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-muted bg-muted/20">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-full bg-muted shrink-0">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">Claimed by operator</p>
              <Badge variant="outline" className="text-[10px]">
                Verified
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground/70">
              The pool operator has claimed this profile and verified ownership.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Just claimed successfully
  if (claimed && !claimedBy) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-4">
          <div className="p-2 rounded-full bg-emerald-500/10 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-300">Pool claimed successfully!</p>
            <p className="text-xs text-muted-foreground">
              {poolName} is now yours. Your governance identity score will update in the next
              scoring cycle.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  async function handleClaim() {
    if (!address) return;
    setClaiming(true);
    setError(null);

    try {
      const stakeAddress = resolveRewardAddress(address);
      if (!stakeAddress) {
        throw new Error('Could not derive stake address from your wallet');
      }

      const res = await fetch('/api/spo/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId,
          walletAddress: address,
          stakeAddress,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Claim failed');
      }

      setClaimed(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setClaiming(false);
    }
  }

  // Not connected — prompt to connect wallet
  if (!connected) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-full bg-primary/15 shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Are you this pool&apos;s operator?</p>
              <p className="text-xs text-muted-foreground">
                Connect your wallet to claim this pool and unlock your SPO command center.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Read-only verification via your stake key. We never request transactions.
              </p>
            </div>
          </div>
          <Button
            className="gap-2 shrink-0"
            onClick={() => window.dispatchEvent(new Event('openWalletConnect'))}
            disabled={connecting || reconnecting}
          >
            {connecting || reconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            Connect Wallet to Claim
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connected but not claiming — show claim button
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-full bg-primary/15 shrink-0">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">Claim this pool</p>
            <p className="text-xs text-muted-foreground">
              Verify you&apos;re the operator of{' '}
              <span className="font-medium text-foreground">{poolName}</span> to unlock your
              governance dashboard and manage your pool&apos;s identity.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button className="gap-2" onClick={handleClaim} disabled={claiming}>
            {claiming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shield className="h-4 w-4" />
            )}
            {claiming ? 'Verifying ownership...' : 'Claim This Pool'}
          </Button>
          {error && <p className="text-xs text-rose-400 max-w-[240px] text-right">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
