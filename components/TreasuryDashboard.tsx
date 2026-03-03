'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  ArrowRight,
  Shield,
  Minus,
  BarChart3,
  Scale,
} from 'lucide-react';
import Link from 'next/link';
import { posthog } from '@/lib/posthog';
import { formatAda } from '@/lib/treasury';
import dynamic from 'next/dynamic';
import { TreasuryPendingProposals } from '@/components/TreasuryPendingProposals';

const TreasuryCharts = dynamic(
  () => import('@/components/TreasuryCharts').then((m) => m.TreasuryCharts),
  { ssr: false },
);
const TreasurySimulator = dynamic(
  () => import('@/components/TreasurySimulator').then((m) => m.TreasurySimulator),
  { ssr: false },
);
import { TreasuryAccountabilitySection } from '@/components/TreasuryAccountabilitySection';
import { TreasuryHistoryTimeline } from '@/components/TreasuryHistoryTimeline';
import { useFeatureFlag } from '@/components/FeatureGate';

interface TreasuryData {
  balance: number;
  epoch: number;
  snapshotAt: string;
  runwayMonths: number;
  burnRatePerEpoch: number;
  trend: 'growing' | 'shrinking' | 'stable';
  healthScore: number | null;
  healthComponents: Record<string, number> | null;
  pendingCount: number;
  pendingTotalAda: number;
}

export function TreasuryDashboard() {
  const treasuryIntelligenceEnabled = useFeatureFlag('treasury_intelligence');
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'simulator' | 'accountability'>(
    'overview',
  );

  useEffect(() => {
    posthog.capture('treasury_page_viewed');

    fetch('/api/treasury/current')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <TreasurySkeleton />;
  if (!data) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Landmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Treasury Data Unavailable</h2>
        <p className="text-muted-foreground">
          Treasury snapshots have not been synced yet. Data will appear after the first epoch sync.
        </p>
      </div>
    );
  }

  const trendIcon =
    data.trend === 'growing' ? (
      <TrendingUp className="h-5 w-5 text-green-500" />
    ) : data.trend === 'shrinking' ? (
      <TrendingDown className="h-5 w-5 text-red-500" />
    ) : (
      <Minus className="h-5 w-5 text-muted-foreground" />
    );

  const healthColor = !data.healthScore
    ? 'text-muted-foreground'
    : data.healthScore >= 75
      ? 'text-green-500'
      : data.healthScore >= 50
        ? 'text-amber-500'
        : 'text-red-500';

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Treasury Intelligence</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Real-time Cardano treasury health, spending analysis, and accountability tracking.
          <span className="text-xs ml-2 text-muted-foreground/60">As of epoch {data.epoch}</span>
        </p>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Treasury Balance</div>
            <div className="text-2xl font-bold tabular-nums">{formatAda(data.balance)}</div>
            <div className="flex items-center gap-1 mt-1">
              {trendIcon}
              <span className="text-xs text-muted-foreground">vs last epoch</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Runway</div>
            <div className="text-2xl font-bold tabular-nums">
              {data.runwayMonths >= 999 ? '∞' : `${data.runwayMonths}mo`}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">at current rate</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Health Score</div>
            <div className={`text-2xl font-bold tabular-nums ${healthColor}`}>
              {data.healthScore ?? '—'}
              <span className="text-sm font-normal text-muted-foreground">/100</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">composite score</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Burn Rate</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatAda(data.burnRatePerEpoch)}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">per epoch</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Pending</div>
            <div className="text-2xl font-bold tabular-nums">{data.pendingCount}</div>
            <div className="flex items-center gap-1 mt-1">
              {data.pendingTotalAda > 0 && (
                <>
                  <Scale className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatAda(data.pendingTotalAda)} ADA
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score Breakdown */}
      {data.healthComponents && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Health Score Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(data.healthComponents).map(([key, value]) => (
                <div key={key}>
                  <div className="text-xs text-muted-foreground capitalize mb-1">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums w-8 text-right">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b pb-px">
        <button
          onClick={() => {
            setActiveTab('overview');
            posthog.capture('treasury_tab_changed', { tab: 'overview' });
          }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        {treasuryIntelligenceEnabled && (
          <>
            <button
              onClick={() => {
                setActiveTab('simulator');
                posthog.capture('treasury_tab_changed', { tab: 'simulator' });
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'simulator'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              What-If Simulator
            </button>
            <button
              onClick={() => {
                setActiveTab('accountability');
                posthog.capture('treasury_tab_changed', { tab: 'accountability' });
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'accountability'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Accountability
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <TreasuryCharts />
          <TreasuryPendingProposals
            treasuryBalanceAda={data.balance}
            runwayMonths={data.runwayMonths}
          />
          <TreasuryHistoryTimeline />
        </div>
      )}

      {treasuryIntelligenceEnabled && activeTab === 'simulator' && (
        <TreasurySimulator
          currentBalance={data.balance}
          burnRate={data.burnRatePerEpoch}
          currentEpoch={data.epoch}
        />
      )}

      {treasuryIntelligenceEnabled && activeTab === 'accountability' && (
        <TreasuryAccountabilitySection />
      )}
    </div>
  );
}

function TreasurySkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-3 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
