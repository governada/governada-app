import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ShareActions } from '@/components/ShareActions';
import { TreasuryHealthWidget } from '@/components/TreasuryHealthWidget';
import { GovernanceSubNav } from '@/components/GovernanceSubNav';
import { GovernanceHealthIndex } from '@/components/GovernanceHealthIndex';
import { NarrativeSummary } from '@/components/NarrativeSummary';
import { ActivityFeed } from '@/components/ActivityFeed';
import { CrossProposalInsights } from '@/components/CrossProposalInsights';
import { GovernanceObservatory } from '@/components/GovernanceObservatory';
import { PulseLeaderboardClient } from '@/components/PulseLeaderboardClient';
import { generatePulseNarrative } from '@/lib/narratives';
import { getFeatureFlag } from '@/lib/featureFlags';
import {
  Landmark,
  ScrollText,
  Users,
  Vote,
  TrendingUp,
  TrendingDown,
  Crown,
  ArrowRight,
  BarChart3,
} from 'lucide-react';
import { BASE_URL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

async function fetchPulseData() {
  const res = await fetch(`${BASE_URL}/api/governance/pulse`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

async function fetchLeaderboardData() {
  const res = await fetch(`${BASE_URL}/api/governance/leaderboard`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  return res.json();
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex flex-col items-center text-center gap-2">
        {icon}
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

function LeaderboardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </CardContent>
    </Card>
  );
}

async function LeaderboardSection() {
  const lb = await fetchLeaderboardData();
  if (!lb) return null;

  return (
    <>
      <section id="leaderboard">
        <PulseLeaderboardClient initialLeaderboard={lb.leaderboard} />
      </section>

      {/* Weekly Movers */}
      {(lb.weeklyMovers.gainers.length > 0 || lb.weeklyMovers.losers.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {lb.weeklyMovers.gainers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Biggest Gainers This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lb.weeklyMovers.gainers.map((m: any) => (
                  <Link key={m.drepId} href={`/drep/${encodeURIComponent(m.drepId)}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <span className="text-sm truncate flex-1">{m.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{m.currentScore}</span>
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-500/30">
                          +{m.delta}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {lb.weeklyMovers.losers.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  Biggest Drops This Week
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lb.weeklyMovers.losers.map((m: any) => (
                  <Link key={m.drepId} href={`/drep/${encodeURIComponent(m.drepId)}`} className="block">
                    <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 transition-colors">
                      <span className="text-sm truncate flex-1">{m.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold tabular-nums">{m.currentScore}</span>
                        <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">
                          {m.delta}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Hall of Fame */}
      {lb.hallOfFame.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Hall of Fame
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              DReps maintaining a Strong score (80+) for 90+ days
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {lb.hallOfFame.map((d: any) => (
                <Link key={d.drepId} href={`/drep/${encodeURIComponent(d.drepId)}`} className="block">
                  <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-center">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400 mt-1">{d.score}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{d.days}+ days at Strong</p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default async function PulsePage() {
  const [pulse, showCrossChain] = await Promise.all([
    fetchPulseData(),
    getFeatureFlag('cross_chain_observatory'),
  ]);

  const pulseNarrative = pulse ? generatePulseNarrative({
    votesThisWeek: pulse.votesThisWeek,
    activeProposals: pulse.activeProposals,
    activeDReps: pulse.activeDReps,
    totalAdaGoverned: pulse.totalAdaGoverned,
    avgParticipationRate: pulse.avgParticipationRate,
  }) : null;

  return (
    <div className="container mx-auto px-4 py-8 space-y-10 max-w-6xl">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Governance Pulse</h1>
        <p className="text-muted-foreground">
          Real-time health of Cardano&apos;s on-chain governance
        </p>
      </div>

      <GovernanceSubNav />

      {/* GHI Hero + Narrative */}
      <div className="flex flex-col md:flex-row items-center gap-8 py-4">
        <GovernanceHealthIndex size="hero" />
        <div className="flex-1 space-y-3">
          <h2 className="text-lg font-semibold">Governance Health Index</h2>
          <NarrativeSummary text={pulseNarrative} />
          <p className="text-xs text-muted-foreground">
            A composite score measuring participation, rationale quality, delegation spread, and DRep diversity.
          </p>
        </div>
      </div>

      {/* Latest Report Link */}
      <Link href="/pulse/report/latest" className="block">
        <Card className="border-primary/20 hover:border-primary/40 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">State of Governance Report</p>
                <p className="text-xs text-muted-foreground">Weekly intelligence report with AI analysis</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>

      <TreasuryHealthWidget />

      {pulse && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Landmark className="h-5 w-5 text-green-500" />} label="ADA Governed" value={pulse.totalAdaGoverned} />
          <StatCard icon={<ScrollText className="h-5 w-5 text-amber-500" />} label="Active Proposals" value={String(pulse.activeProposals)} />
          <StatCard icon={<Users className="h-5 w-5 text-blue-500" />} label="Active DReps" value={String(pulse.activeDReps)} />
          <StatCard icon={<Vote className="h-5 w-5 text-indigo-500" />} label="Votes This Week" value={String(pulse.votesThisWeek)} />
        </div>
      )}

      {pulse && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10">
                <BarChart3 className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{pulse.avgParticipationRate}%</p>
                <p className="text-sm text-muted-foreground">Avg DRep Participation Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10">
                <ScrollText className="h-6 w-6 text-indigo-500" />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums">{pulse.avgRationaleRate}%</p>
                <p className="text-sm text-muted-foreground">Avg DRep Rationale Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Activity Feed */}
      <ActivityFeed limit={10} />

      {/* Community Sentiment */}
      {pulse && pulse.communityGap.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Vote className="h-5 w-5" />
              Community Sentiment
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How delegators polled vs how proposals are trending
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pulse.communityGap.map((g: any) => {
                const yesPct = g.pollTotal > 0 ? Math.round((g.pollYes / g.pollTotal) * 100) : 0;
                const noPct = g.pollTotal > 0 ? Math.round((g.pollNo / g.pollTotal) * 100) : 0;
                return (
                  <Link key={`${g.txHash}:${g.index}`} href={`/proposals/${g.txHash}/${g.index}`} className="block">
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{g.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {g.pollTotal} community votes · {g.drepVotePct}% DReps voted
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">{yesPct}%</span>
                          <p className="text-[10px] text-muted-foreground">Yes</p>
                        </div>
                        <div className="w-24 h-3 bg-muted rounded-full overflow-hidden flex">
                          <div className="bg-green-500 h-full" style={{ width: `${yesPct}%` }} />
                          <div className="bg-red-500 h-full" style={{ width: `${noPct}%` }} />
                        </div>
                        <div className="text-center">
                          <span className="text-sm font-bold text-red-600 dark:text-red-400">{noPct}%</span>
                          <p className="text-[10px] text-muted-foreground">No</p>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cross-Proposal Insights */}
      <CrossProposalInsights />

      {/* Cross-Chain Governance Observatory (feature-flagged) */}
      {showCrossChain && <GovernanceObservatory />}

      {/* Leaderboard + Movers + Hall of Fame (with Suspense) */}
      <Suspense fallback={<LeaderboardSkeleton />}>
        <LeaderboardSection />
      </Suspense>

      {/* Share section */}
      <div className="flex items-center justify-center gap-4 py-4">
        <ShareActions
          url="https://drepscore.io/pulse"
          text="Check the health of Cardano governance in real-time on @drepscore:"
          imageUrl="/api/og/pulse"
          imageFilename="governance-pulse.png"
          surface="pulse_page"
          variant="buttons"
        />
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 py-6">
        <p className="text-lg font-semibold">Find the right DRep for you</p>
        <Link href="/discover">
          <Button size="lg" className="gap-2">
            Discover DReps <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
