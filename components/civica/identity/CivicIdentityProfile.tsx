'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Flame,
  Vote,
  Coins,
  Share2,
  ArrowRight,
  Shield,
  Users,
  Landmark,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSegment } from '@/components/providers/SegmentProvider';
import { ShareModal } from '@/components/civica/shared/ShareModal';
import { AsyncContent } from '@/components/civica/shared/AsyncContent';
import { MilestoneGallery } from './MilestoneGallery';
import { CitizenMilestoneCelebration } from './CitizenMilestoneCelebration';
import { ImpactScoreCard } from './ImpactScoreCard';
import { GovernanceRings } from './GovernanceRings';
import { GovernancePulse } from './GovernancePulse';
import { IdentityNarrative } from './IdentityNarrative';
import { MilestoneStamps } from './MilestoneStamps';
import { PulseHistoryChart } from './PulseHistoryChart';
import { useCitizenImpactScore } from '@/hooks/queries';
import { computeGovernanceRings, RING_CONFIG } from '@/lib/governanceRings';
import { getCompoundArchetype, getDominantDimension, getIdentityColor } from '@/lib/drepIdentity';
import type { AlignmentScores } from '@/lib/drepIdentity';
import type { GovernanceFootprint } from '@/lib/governanceFootprint';

/* ── Data hooks (TanStack Query) ───────────────────────────────── */

function useCivicFootprint(stakeAddress: string | null) {
  return useQuery<GovernanceFootprint>({
    queryKey: ['civic-identity-footprint', stakeAddress],
    queryFn: async () => {
      const res = await fetch(
        `/api/governance/footprint${stakeAddress ? `?stakeAddress=${encodeURIComponent(stakeAddress)}` : ''}`,
      );
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

interface EarnedMilestone {
  key: string;
  label: string;
  earnedAt: string;
}

function useCitizenMilestones() {
  return useQuery<{ milestones: EarnedMilestone[] }>({
    queryKey: ['citizen-milestones'],
    queryFn: async () => {
      const res = await fetch('/api/citizen/milestones');
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatAdaCompact(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

/* ── Section components ────────────────────────────────────────── */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Calendar;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-card p-4 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
      {title}
    </p>
  );
}

/* ── Empty-state CTAs ─────────────────────────────────────────── */

function UndelegatedCTA() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 text-center space-y-3">
      <Users className="h-6 w-6 text-primary mx-auto" />
      <p className="text-sm font-semibold text-foreground">
        Delegate to a DRep to start building your civic identity
      </p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
        Your governance footprint begins when you delegate. Find a DRep whose values match yours and
        your votes will count toward on-chain proposals.
      </p>
      <Button size="sm" asChild>
        <Link href="/match">
          Find Your DRep
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}

function UnstakedCTA() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/70 p-5 text-center space-y-3">
      <Landmark className="h-6 w-6 text-muted-foreground mx-auto" />
      <p className="text-sm font-semibold text-foreground">
        Stake with a pool to complete your governance coverage
      </p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
        Staking secures the network and earns rewards while your delegation shapes governance.
        Together they make your civic identity complete.
      </p>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────── */

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-48" />
      <div className="flex justify-center">
        <Skeleton className="h-[200px] w-[200px] rounded-full" />
      </div>
      <Skeleton className="h-4 w-64 mx-auto" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────── */

export function CivicIdentityProfile() {
  const { segment, stakeAddress, delegatedDrep, isLoading: segmentLoading } = useSegment();
  const {
    data: footprint,
    isLoading: footprintLoading,
    isError: footprintError,
  } = useCivicFootprint(stakeAddress);
  const {
    data: milestonesData,
    isLoading: milestonesLoading,
    isError: milestonesError,
  } = useCitizenMilestones();
  const { data: impactScoreData, isLoading: impactScoreLoading } = useCitizenImpactScore(
    segment !== 'anonymous',
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isLoading = segmentLoading || footprintLoading || impactScoreLoading;
  const earned = milestonesData?.milestones ?? [];

  // Detect recent milestones (earned in last 10 days)
  // eslint-disable-next-line react-hooks/purity -- Date.now() for milestone cutoff is acceptable; only affects display freshness
  const recentCutoff = Date.now() - 10 * 24 * 60 * 60 * 1000;
  const recentKeys = new Set(
    earned.filter((m) => new Date(m.earnedAt).getTime() > recentCutoff).map((m) => m.key),
  );

  // Compute governance rings from existing data
  const ringsData = computeGovernanceRings(footprint, impactScoreData);

  if (segment === 'anonymous' && !segmentLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/70 backdrop-blur-md p-8 text-center space-y-4">
        <Shield className="h-8 w-8 text-primary mx-auto" />
        <p className="text-lg font-bold">Your Civic Identity</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Connect your Cardano wallet to see your civic identity — delegation history, governance
          footprint, and earned milestones.
        </p>
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent('openWalletConnect', { detail: {} }))}
        >
          Connect Wallet
        </Button>
      </div>
    );
  }

  if (isLoading) return <ProfileSkeleton />;

  const isUndelegated = !footprint?.identity.delegatedDRep;
  const isUnstaked = !footprint?.identity.delegatedPool;

  const shareUrl = stakeAddress
    ? `https://governada.io/my-gov/identity`
    : 'https://governada.io/my-gov/identity';
  const shareOgUrl = stakeAddress
    ? `/api/og/civic-identity/${encodeURIComponent(stakeAddress)}`
    : '';
  const shareText = `Check out my Civic Identity on Cardano! Governance Pulse: ${ringsData.pulse}/100. ${earned.length} milestones earned. @GovernadaIO`;

  return (
    <div className="space-y-8" data-discovery="you-card">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Civic Identity</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your governance presence on Cardano.
          </p>
        </div>
        {stakeAddress && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </Button>
        )}
      </div>

      {/* ── Hero: Governance Rings + Pulse ───────────────────────── */}
      <AsyncContent
        isLoading={footprintLoading || impactScoreLoading}
        isError={footprintError}
        data={footprint}
        errorMessage="Unable to load your governance footprint."
        skeleton={
          <div className="flex justify-center">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
          </div>
        }
      >
        {footprint && (
          <>
            {isUndelegated ? (
              <UndelegatedCTA />
            ) : (
              <div className="flex flex-col items-center gap-5">
                {/* Rings with Pulse centered inside */}
                <div className="relative">
                  <GovernanceRings rings={ringsData.rings} size={200} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <GovernancePulse
                      pulse={ringsData.pulse}
                      pulseColor={ringsData.pulseColor}
                      pulseLabel={ringsData.pulseLabel}
                    />
                  </div>
                </div>

                {/* Ring legend */}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
                  {RING_CONFIG.map((config) => (
                    <div key={config.key} className="flex items-center gap-1.5">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: config.color }}
                      />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                  ))}
                </div>

                {/* Governance archetype (from delegated DRep's alignment) */}
                {footprint.delegationRecord.drepAlignment &&
                  (() => {
                    const alignment = footprint.delegationRecord.drepAlignment as AlignmentScores;
                    const archetype = getCompoundArchetype(alignment);
                    const dominant = getDominantDimension(alignment);
                    const color = getIdentityColor(dominant);
                    return (
                      <div className="text-center">
                        <p
                          className="text-lg font-bold tracking-tight"
                          style={{ color: color.hex }}
                        >
                          {archetype}
                        </p>
                        <p className="text-xs text-muted-foreground">Your governance archetype</p>
                      </div>
                    );
                  })()}

                {/* Identity narrative */}
                <IdentityNarrative
                  participationTier={footprint.identity.participationTier}
                  drepName={footprint.delegationRecord.drepName}
                  delegationAgeDays={footprint.identity.delegationAgeDays}
                  proposalsInfluenced={footprint.impact.proposalsInfluenced}
                  pulse={ringsData.pulse}
                  pulseLabel={ringsData.pulseLabel}
                  rings={ringsData.rings}
                  archetype={
                    footprint.delegationRecord.drepAlignment
                      ? getCompoundArchetype(
                          footprint.delegationRecord.drepAlignment as AlignmentScores,
                        )
                      : null
                  }
                  milestonesEarned={earned.length}
                />

                {/* Pulse history sparkline (only renders if snapshots exist) */}
                <PulseHistoryChart className="justify-center" />
              </div>
            )}

            {isUnstaked && <UnstakedCTA />}
          </>
        )}
      </AsyncContent>

      {/* ── Milestone Stamps ─────────────────────────────────────── */}
      <div data-discovery="you-milestones">
        <SectionHeader title="Milestones" />
        <AsyncContent
          isLoading={milestonesLoading}
          isError={milestonesError}
          data={milestonesData}
          errorMessage="Unable to load milestones."
          skeleton={
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-16 rounded-lg" />
              ))}
            </div>
          }
        >
          <MilestoneStamps earned={earned} recentKeys={recentKeys} stakeAddress={stakeAddress} />
        </AsyncContent>
      </div>

      {/* ── Alignment Quick Match ────────────────────────────────── */}
      {footprint && (
        <div>
          <SectionHeader title="Alignment" />
          <div className="rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Quick Match</p>
              <p className="text-xs text-muted-foreground">
                {isUndelegated
                  ? 'Find a DRep who shares your governance values.'
                  : 'See how your values align with DReps across the network.'}
              </p>
            </div>
            <Button variant={isUndelegated ? 'default' : 'outline'} size="sm" asChild>
              <Link href="/match">
                {isUndelegated ? 'Find Your DRep' : 'Take Quiz'}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* ── Collapsible Details ───────────────────────────────────── */}
      {footprint && !isUndelegated && (
        <div>
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', detailsOpen && 'rotate-180')}
            />
            Detailed Breakdown
          </button>

          {detailsOpen && (
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  icon={Calendar}
                  label="Citizen Since"
                  value={
                    footprint.identity.delegationAgeDays != null
                      ? `${Math.floor(footprint.identity.delegationAgeDays / 5)} epochs`
                      : '--'
                  }
                  sub={
                    footprint.identity.delegationAgeDays != null
                      ? `${footprint.identity.delegationAgeDays} days`
                      : undefined
                  }
                />
                <StatCard
                  icon={Flame}
                  label="Delegation Streak"
                  value={footprint.citizenActivity.epochsActive}
                  sub={`epoch${footprint.citizenActivity.epochsActive !== 1 ? 's' : ''} active`}
                />
                <StatCard
                  icon={Vote}
                  label="Proposals Influenced"
                  value={footprint.impact.proposalsInfluenced}
                />
                <StatCard
                  icon={Coins}
                  label="ADA Governed"
                  value={
                    footprint.impact.adaGoverned > 0
                      ? formatAdaCompact(footprint.impact.adaGoverned)
                      : '--'
                  }
                  sub={footprint.impact.delegationWeight}
                />
              </div>

              {/* Governance Footprint */}
              <div data-discovery="you-history">
                <SectionHeader title="Governance Footprint" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">DRep Score</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {footprint.delegationRecord.drepScore ?? '--'}
                      <span className="text-sm font-normal text-muted-foreground">/100</span>
                    </p>
                    {footprint.delegationRecord.drepRank && (
                      <p className="text-xs text-muted-foreground">
                        Rank #{footprint.delegationRecord.drepRank}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">DRep Votes Cast</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {footprint.delegationRecord.keyVotes}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {footprint.delegationRecord.delegationChanges} delegation change
                      {footprint.delegationRecord.delegationChanges !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                {delegatedDrep && (
                  <div className="mt-3">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/drep/${delegatedDrep}`}>
                        View your DRep
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {/* Engagement Stats */}
              <div>
                <SectionHeader title="Engagement Stats" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
                    <p className="text-xl font-bold tabular-nums">
                      {footprint.citizenActivity.pollsTaken}
                    </p>
                    <p className="text-xs text-muted-foreground">Polls Taken</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
                    <p className="text-xl font-bold tabular-nums">
                      {footprint.citizenActivity.pollStreak}
                    </p>
                    <p className="text-xs text-muted-foreground">Poll Streak</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-card p-4 text-center">
                    <p className="text-xl font-bold tabular-nums">
                      {footprint.citizenActivity.consistency != null
                        ? `${footprint.citizenActivity.consistency}%`
                        : '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Consistency</p>
                  </div>
                </div>
              </div>

              {/* Impact Score */}
              <div>
                <SectionHeader title="Governance Impact" />
                {impactScoreLoading ? (
                  <Skeleton className="h-64 w-full rounded-2xl" />
                ) : impactScoreData ? (
                  <ImpactScoreCard data={impactScoreData} />
                ) : (
                  <div className="rounded-2xl border border-white/[0.08] bg-card/15 backdrop-blur-md p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Impact score will be calculated on the next sync cycle.
                    </p>
                  </div>
                )}
              </div>

              {/* Full Milestone Gallery */}
              <div>
                <SectionHeader title="All Milestones" />
                <AsyncContent
                  isLoading={milestonesLoading}
                  isError={milestonesError}
                  data={milestonesData}
                  errorMessage="Unable to load milestones."
                  skeleton={
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                      ))}
                    </div>
                  }
                >
                  <MilestoneGallery earned={earned} recentKeys={recentKeys} />
                </AsyncContent>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Milestone celebration (for newly earned milestones) */}
      {recentKeys.size > 0 && (
        <CitizenMilestoneCelebration milestoneKeys={[...recentKeys]} stakeAddress={stakeAddress} />
      )}

      {/* Share modal */}
      {shareOgUrl && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          ogImageUrl={shareOgUrl}
          shareText={shareText}
          shareUrl={shareUrl}
          title="Share your Civic Identity"
        />
      )}
    </div>
  );
}
