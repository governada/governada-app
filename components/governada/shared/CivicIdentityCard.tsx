'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Flame, Vote, Coins, Share2, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CIVIC_IDENTITY_PATH } from '@/lib/navigation/civicIdentity';

/* ── Types ──────────────────────────────────────────────────────── */

interface CivicIdentityCardProps {
  wallet: string | null | undefined;
  className?: string;
}

/* ── Data hook ──────────────────────────────────────────────────── */

function useCivicIdentity(wallet: string | null | undefined) {
  return useQuery({
    queryKey: ['civic-identity', wallet],
    queryFn: async () => {
      const res = await fetch(`/api/governance/footprint?wallet=${encodeURIComponent(wallet!)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!wallet,
    staleTime: 5 * 60 * 1000,
  });
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatAdaGoverned(ada: number): string {
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(1)}B`;
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`;
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(0)}K`;
  return ada.toFixed(0);
}

/* ── Identity fact card ─────────────────────────────────────────── */

function IdentityFact({
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
    <div className="flex flex-col items-center gap-1 rounded-lg bg-muted/30 p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs font-medium text-foreground/80">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ── Loading skeleton ───────────────────────────────────────────── */

function IdentitySkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-lg bg-muted/30 p-3 space-y-2 flex flex-col items-center">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function CivicIdentityCard({ wallet, className }: CivicIdentityCardProps) {
  const { data, isLoading } = useCivicIdentity(wallet);

  if (!wallet) return null;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-muted-foreground" />
          Your Civic Identity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <IdentitySkeleton />
        ) : data ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <IdentityFact
                icon={Calendar}
                label="Citizen Since"
                value={data.citizenSinceEpoch != null ? `Epoch ${data.citizenSinceEpoch}` : '--'}
                sub={
                  data.epochsActive != null
                    ? `${data.epochsActive} epoch${data.epochsActive !== 1 ? 's' : ''} ago`
                    : undefined
                }
              />
              <IdentityFact
                icon={Flame}
                label="Delegation Streak"
                value={data.delegationStreak ?? 0}
                sub={`epoch${(data.delegationStreak ?? 0) !== 1 ? 's' : ''}`}
              />
              <IdentityFact
                icon={Vote}
                label="Proposals Influenced"
                value={data.proposalsInfluenced ?? 0}
              />
              <IdentityFact
                icon={Coins}
                label="ADA Governed"
                value={data.adaGoverned != null ? `${formatAdaGoverned(data.adaGoverned)}` : '--'}
              />
            </div>

            <div className="flex items-center justify-between">
              <Link
                href={CIVIC_IDENTITY_PATH}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View full identity
                <ArrowRight className="h-3 w-3" />
              </Link>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Share2 className="h-3.5 w-3.5" />
                Share
              </span>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
