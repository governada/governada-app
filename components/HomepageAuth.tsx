'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/utils/wallet';
import { getStoredSession } from '@/lib/supabaseAuth';
import { SinceLastVisit } from '@/components/SinceLastVisit';
import {
  DelegationHealthCard,
  RepresentationScoreCard,
  ActiveProposalsSection,
  type DashboardData,
} from '@/components/governance-cards';
import { GovernanceCalendar } from '@/components/GovernanceCalendar';
import { GovernanceBriefCard } from '@/components/GovernanceBriefCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Compass, ArrowRight } from 'lucide-react';
import { GovernanceRiskSignals } from '@/components/GovernanceRiskSignals';
import { DelegationIntelligence } from '@/components/DelegationIntelligence';

interface HomepageAuthProps {
  previousVisitAt: string | null;
}

export function HomepageAuth({ previousVisitAt }: HomepageAuthProps) {
  const { delegatedDrepId, isAuthenticated } = useWallet();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }

    const token = getStoredSession();
    if (!token) { setLoading(false); return; }

    const params = new URLSearchParams();
    if (delegatedDrepId) params.set('drepId', delegatedDrepId);

    fetch(`/api/governance/holder?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, delegatedDrepId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {previousVisitAt && (
        <SinceLastVisit
          previousVisitAt={previousVisitAt}
          delegatedDrepId={delegatedDrepId}
        />
      )}

      <GovernanceBriefCard />

      {data ? (
        <>
          <GovernanceRiskSignals
            health={data.delegationHealth as never}
            activeProposals={data.activeProposals as never}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <DelegationHealthCard health={data.delegationHealth} scoreDelta={data.repScoreDelta} />
            <RepresentationScoreCard rep={data.representationScore} />
          </div>

          <GovernanceCalendar />

          <DelegationIntelligence
            currentDrepName={data.delegationHealth?.drepName}
            currentMatchScore={data.representationScore.score}
            suggestions={data.redelegationSuggestions.map(s => ({ ...s, drepName: s.drepName ?? '' }))}
            totalPollVotes={data.pollHistory?.length ?? 0}
          />
        </>
      ) : (
        <>
          <GovernanceRiskSignals health={null} activeProposals={[]} />
          <DelegationHealthCard health={null} />
        </>
      )}

      <Link
        href="/discover"
        className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:shadow-md transition-all group"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 shrink-0">
          <Compass className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium group-hover:text-primary transition-colors">Explore DReps</p>
          <p className="text-xs text-muted-foreground">
            Discover and compare governance representatives
          </p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </Link>
    </div>
  );
}
