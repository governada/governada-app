'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Compass,
  Vote,
  Shield,
  ShieldCheck,
  Users,
  FileText,
  Scale,
  Search,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useWallet } from '@/utils/wallet-context';
import { fadeInUp, staggerContainer } from '@/lib/animations';

interface DiscoverHeroProps {
  totalDreps: number;
  proposalCount: number;
  ccMemberCount?: number;
  spoCount?: number;
}

/* -- Stat pill shown in the hero -------------------------------- */
function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.FC<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 dark:border-white/10 border-primary/15 bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 text-primary dark:text-cyan-400 shrink-0" />
      <span className="text-xs font-bold tabular-nums text-foreground dark:text-white/90">
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground dark:text-white/50 uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}

/* -- Segment-aware contextual banner ----------------------------- */
function SegmentBanner({ totalDreps }: { totalDreps: number }) {
  const { segment, delegatedDrep, isLoading } = useSegment();
  const { connected } = useWallet();

  if (isLoading) return null;

  if (!connected || segment === 'anonymous') {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg border border-primary/20 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
            <Compass className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">
            {totalDreps.toLocaleString()} DReps are shaping Cardano governance
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find a DRep aligned with your values &mdash; it takes 60 seconds to delegate.
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

  if (segment === 'citizen') {
    if (delegatedDrep) {
      return (
        <div className="flex items-center gap-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4">
          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Vote className="h-4.5 w-4.5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              You&apos;re delegating &mdash; explore who else is governing
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
      <div className="flex items-center gap-4 rounded-lg border border-amber-500/20 bg-amber-500/5 backdrop-blur-sm p-4">
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

  if (segment === 'drep') {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4">
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

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-4">
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

/* -- Main hero component ----------------------------------------- */
export function DiscoverHero({
  totalDreps,
  proposalCount,
  ccMemberCount,
  spoCount,
}: DiscoverHeroProps) {
  const formattedDreps =
    totalDreps >= 1000 ? `${(totalDreps / 1000).toFixed(1)}k` : totalDreps.toLocaleString();

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      <motion.div variants={fadeInUp} className="relative overflow-hidden rounded-2xl">
        <div
          className="absolute inset-0 bg-gradient-to-br from-primary/8 via-secondary/6 to-primary/4 dark:from-cyan-950/80 dark:via-indigo-950/60 dark:to-violet-950/40"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
          aria-hidden="true"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/10 dark:bg-cyan-500/8 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-secondary/8 dark:bg-violet-500/6 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10">
          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-primary dark:text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary dark:text-cyan-400">
                Discover
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Explore Cardano&apos;s Governance Landscape
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground max-w-xl leading-relaxed">
              Browse DReps, stake pools, proposals, and Constitutional Committee members. Every
              participant scored on real voting behavior.
            </p>
          </div>

          {/* Live stat pills */}
          <TooltipProvider>
            <div className="flex flex-wrap gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <StatPill icon={Users} value={formattedDreps} label="DReps" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-56">
                  Delegated Representatives who vote on governance proposals on behalf of ADA
                  holders
                </TooltipContent>
              </Tooltip>
              {spoCount != null && spoCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <StatPill icon={ShieldCheck} value={spoCount.toString()} label="SPOs" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56">
                    Stake Pool Operators who secure the network and participate in protocol
                    governance
                  </TooltipContent>
                </Tooltip>
              )}
              {proposalCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <StatPill
                        icon={FileText}
                        value={proposalCount.toString()}
                        label="Proposals"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56">
                    Active governance proposals open for voting
                  </TooltipContent>
                </Tooltip>
              )}
              {ccMemberCount != null && ccMemberCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <StatPill icon={Scale} value={ccMemberCount.toString()} label="CC Members" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-56">
                    Constitutional Committee members who assess proposal constitutionality
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </TooltipProvider>
        </div>

        <div
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 dark:via-cyan-500/20 to-transparent"
          aria-hidden="true"
        />
      </motion.div>

      <motion.div variants={fadeInUp}>
        <SegmentBanner totalDreps={totalDreps} />
      </motion.div>
    </motion.div>
  );
}
