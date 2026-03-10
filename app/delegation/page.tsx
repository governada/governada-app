'use client';

import { useSegment } from '@/components/providers/SegmentProvider';
import { useQuery } from '@tanstack/react-query';
import { Shield, ShieldCheck, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface DelegationInfo {
  drepId: string | null;
  drepName: string | null;
  drepScore: number | null;
  poolId: string | null;
  poolTicker: string | null;
  poolScore: number | null;
}

function useDelegationInfo(stakeAddress: string | null) {
  return useQuery<DelegationInfo>({
    queryKey: ['delegation-info', stakeAddress],
    queryFn: async () => {
      if (!stakeAddress) throw new Error('No stake address');
      const res = await fetch(`/api/delegation?stakeAddress=${stakeAddress}`);
      if (!res.ok) throw new Error('Failed to fetch delegation info');
      return res.json();
    },
    enabled: !!stakeAddress,
    staleTime: 60_000,
  });
}

export default function DelegationPage() {
  const { stakeAddress, delegatedDrep, delegatedPool } = useSegment();
  const { data, isLoading } = useDelegationInfo(stakeAddress ?? null);

  const hasDrep = !!(delegatedDrep || data?.drepId);
  const hasPool = !!(delegatedPool || data?.poolId);
  const coverageItems = [hasDrep, hasPool];
  const coveragePercent = Math.round(
    (coverageItems.filter(Boolean).length / coverageItems.length) * 100,
  );

  return (
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Delegation</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Your governance representation — DRep and stake pool.
        </p>
      </div>

      {/* Coverage summary */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Governance Coverage</h2>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              coveragePercent === 100
                ? 'text-emerald-500'
                : coveragePercent >= 50
                  ? 'text-amber-500'
                  : 'text-rose-500',
            )}
          >
            {coveragePercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-border rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              coveragePercent === 100
                ? 'bg-emerald-500'
                : coveragePercent >= 50
                  ? 'bg-amber-500'
                  : 'bg-rose-500',
            )}
            style={{ width: `${coveragePercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {coveragePercent === 100
            ? 'You have both a DRep and a governance-active pool — full coverage.'
            : coveragePercent >= 50
              ? 'You have one representative. Add the other for full governance coverage.'
              : 'Delegate to a DRep and choose a governance-active pool to be represented.'}
        </p>
      </div>

      {/* DRep card */}
      <RepresentativeCard
        type="DRep"
        icon={Shield}
        name={data?.drepName ?? delegatedDrep ?? null}
        id={data?.drepId ?? delegatedDrep ?? null}
        score={data?.drepScore ?? null}
        isLoading={isLoading}
        hasDelegate={hasDrep}
        profileHref={
          hasDrep ? `/drep/${encodeURIComponent(data?.drepId ?? delegatedDrep ?? '')}` : null
        }
        findHref="/match"
        findLabel="Find a DRep"
        description="Your DRep votes on treasury, parameters, constitution, and committee actions."
      />

      {/* Pool card */}
      <RepresentativeCard
        type="Pool"
        icon={ShieldCheck}
        name={data?.poolTicker ?? delegatedPool ?? null}
        id={data?.poolId ?? delegatedPool ?? null}
        score={data?.poolScore ?? null}
        isLoading={isLoading}
        hasDelegate={hasPool}
        profileHref={
          hasPool ? `/pool/${encodeURIComponent(data?.poolId ?? delegatedPool ?? '')}` : null
        }
        findHref="/governance/pools"
        findLabel="Find a pool"
        description="Your pool votes on hard forks, certain parameter changes, and no-confidence motions."
      />

      {/* Gap alert */}
      {!hasDrep && !isLoading && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">No DRep delegation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Without a DRep, your ADA has no voice on most governance actions.{' '}
              <Link href="/match" className="text-primary hover:underline">
                Find your DRep
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function RepresentativeCard({
  type,
  icon: Icon,
  name,
  id,
  score,
  isLoading,
  hasDelegate,
  profileHref,
  findHref,
  findLabel,
  description,
}: {
  type: string;
  icon: typeof Shield;
  name: string | null;
  id: string | null;
  score: number | null;
  isLoading: boolean;
  hasDelegate: boolean;
  profileHref: string | null;
  findHref: string;
  findLabel: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{type}</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
      ) : hasDelegate ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium truncate">{name || id}</p>
            {score != null && (
              <span className="text-sm font-bold tabular-nums text-muted-foreground">
                {Math.round(score)}/100
              </span>
            )}
          </div>
          {profileHref && (
            <Link
              href={profileHref}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View profile <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Not delegated</p>
          <Link
            href={findHref}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {findLabel} &rarr;
          </Link>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
