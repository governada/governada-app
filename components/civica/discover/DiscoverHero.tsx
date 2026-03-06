'use client';

import Link from 'next/link';
import { ChevronRight, Compass, Vote, Shield, Users } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet-context';

interface DiscoverHeroProps {
  totalDreps: number;
  proposalCount: number;
}

export function DiscoverHero({ totalDreps, proposalCount }: DiscoverHeroProps) {
  const { segment, delegatedDrep, isLoading } = useSegment();
  const { connected } = useWallet();

  if (isLoading) return null;

  // Anonymous — encourage connection
  if (!connected || segment === 'anonymous') {
    return (
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Compass className="h-5 w-5 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {totalDreps.toLocaleString()} DReps are shaping Cardano governance
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find a DRep aligned with your values — it takes 60 seconds to delegate.
          </p>
        </div>
        <Link
          href="/match"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          Quick Match <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  // Citizen — delegation context
  if (segment === 'citizen') {
    if (delegatedDrep) {
      return (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Vote className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              You&apos;re delegating — explore who else is governing
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Compare DReps, track proposals, and monitor committee members.
            </p>
          </div>
          <Link
            href="/my-gov"
            className="text-xs text-primary hover:underline shrink-0 flex items-center gap-0.5"
          >
            My Gov <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
          <Users className="h-4.5 w-4.5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">You&apos;re connected but not yet delegating</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find the DRep that represents your governance values.
          </p>
        </div>
        <Link
          href="/match"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          Match <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // DRep — peer context
  if (segment === 'drep') {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
          <Shield className="h-4.5 w-4.5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">See how you compare to other DReps</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse peers, track proposals requiring your vote, and monitor your standing.
          </p>
        </div>
        <Link
          href="/my-gov"
          className="text-xs text-primary hover:underline shrink-0 flex items-center gap-0.5"
        >
          Dashboard <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  // SPO
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
      <div className="w-9 h-9 rounded-full bg-sky-500/10 flex items-center justify-center shrink-0">
        <Shield className="h-4.5 w-4.5 text-sky-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">SPO governance view</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Track proposals requiring SPO votes and compare DRep alignment.
        </p>
      </div>
      <Link
        href="/my-gov"
        className="text-xs text-primary hover:underline shrink-0 flex items-center gap-0.5"
      >
        Dashboard <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
