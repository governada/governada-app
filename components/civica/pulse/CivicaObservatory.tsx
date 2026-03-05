'use client';

import { Globe, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useGovernanceBenchmarks,
  useGovernanceHealthIndex,
  useGovernanceDecentralization,
} from '@/hooks/queries';
import { getChainMetrics, GOVERNANCE_MODELS } from '@/lib/crossChain/chainMetrics';
import type { ChainBenchmark } from '@/lib/crossChain';

interface EDIMetric {
  key: string;
  label: string;
  value: number | string | null;
  description: string;
  trend?: 'up' | 'down' | 'stable';
}

function buildEDIMetrics(ghi: any, decentralization: any): EDIMetric[] {
  const components: any[] = ghi?.components ?? [];
  const powerDist = components.find((c: any) => c.name === 'Power Distribution');
  const participation = components.find((c: any) => c.name === 'DRep Participation');
  const deliberation = components.find((c: any) => c.name === 'Deliberation Quality');
  const effectiveness = components.find((c: any) => c.name === 'Governance Effectiveness');
  const stability = components.find((c: any) => c.name === 'System Stability');

  const edi = ghi?.edi;

  return [
    {
      key: 'voting-power',
      label: 'Voting Power Distribution',
      value: edi?.nakamotoCoefficient ?? powerDist?.value ?? null,
      description:
        'Nakamoto coefficient for DRep voting power — minimum DReps needed to control majority',
    },
    {
      key: 'participation-breadth',
      label: 'Participation Breadth',
      value: participation?.value != null ? `${participation.value}%` : null,
      description: '% of registered DReps who voted on recent proposals',
    },
    {
      key: 'delegation-concentration',
      label: 'Delegation Concentration',
      value:
        edi?.giniCoefficient != null
          ? edi.giniCoefficient.toFixed(2)
          : decentralization?.giniCoefficient != null
            ? decentralization.giniCoefficient.toFixed(2)
            : null,
      description: 'Gini coefficient of delegation distribution (0 = equal, 1 = concentrated)',
    },
    {
      key: 'body-independence',
      label: 'Body Independence',
      value: effectiveness?.value != null ? `${effectiveness.value}%` : null,
      description: 'How independently do DReps, SPOs, and CC vote on proposals',
    },
    {
      key: 'deliberation-quality',
      label: 'Deliberation Quality',
      value: deliberation?.value != null ? `${deliberation.value}%` : null,
      description:
        'Quality of governance discourse: rationale provision, dissent breadth, engagement depth',
    },
    {
      key: 'proposal-diversity',
      label: 'Proposal Origin Diversity',
      value: decentralization?.uniqueProposers ?? null,
      description: 'Number of unique proposers submitting governance actions',
    },
    {
      key: 'system-stability',
      label: 'System Stability',
      value: stability?.value != null ? `${stability.value}%` : null,
      description:
        'Governance infrastructure health: uptime, parameter consistency, constitutional compliance',
    },
  ];
}

function EDICard({ metric }: { metric: EDIMetric }) {
  const TrendIcon =
    metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    metric.trend === 'up'
      ? 'text-emerald-400'
      : metric.trend === 'down'
        ? 'text-rose-400'
        : 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 group relative">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
          {metric.label}
        </p>
        <div className="relative">
          <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
          <div className="absolute bottom-full right-0 mb-2 w-56 p-2 rounded-lg border border-border bg-popover text-xs text-muted-foreground shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10">
            {metric.description}
          </div>
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="font-display text-2xl font-bold tabular-nums text-foreground leading-none">
          {metric.value ?? '—'}
        </p>
        {metric.trend && <TrendIcon className={cn('h-4 w-4 mb-0.5', trendColor)} />}
      </div>
    </div>
  );
}

function ChainComparisonBar({ chain, benchmark }: { chain: string; benchmark: ChainBenchmark }) {
  const model = GOVERNANCE_MODELS[chain as keyof typeof GOVERNANCE_MODELS];
  const metrics = getChainMetrics(benchmark);

  const chainColors: Record<string, string> = {
    cardano: 'bg-primary',
    ethereum: 'bg-indigo-500',
    polkadot: 'bg-pink-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium capitalize">{chain}</p>
          <p className="text-[11px] text-muted-foreground">{model?.tagline ?? ''}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">{model?.source ?? ''}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.slice(0, 4).map((m) => (
          <div key={m.key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground truncate mr-2">{m.label}</span>
            <span className="font-medium tabular-nums shrink-0">{m.value ?? '—'}</span>
          </div>
        ))}
      </div>
      {benchmark.participationRate != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Participation</span>
            <span className="font-medium tabular-nums">{benchmark.participationRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-border overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                chainColors[chain] ?? 'bg-primary',
              )}
              style={{
                width: `${Math.min(100, benchmark.participationRate)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function CivicaObservatory() {
  const { data: rawGHI, isLoading: ghiLoading } = useGovernanceHealthIndex(1);
  const { data: rawBenchmarks, isLoading: benchLoading } = useGovernanceBenchmarks();
  const { data: rawDecentralization } = useGovernanceDecentralization();

  const ghi = (rawGHI as any)?.current ?? rawGHI;
  const benchmarks: ChainBenchmark[] = Array.isArray(rawBenchmarks)
    ? rawBenchmarks
    : ((rawBenchmarks as any)?.benchmarks ?? []);
  const decentralization = rawDecentralization as any;

  const ediMetrics = buildEDIMetrics(ghi, decentralization);
  const loading = ghiLoading || benchLoading;

  const cardanoBench = benchmarks.find((b) => b.chain === 'cardano');
  const otherBenchmarks = benchmarks.filter((b) => b.chain !== 'cardano');

  return (
    <div className="space-y-6">
      {/* EDI hero */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Decentralization Index</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          7 metrics measuring how decentralized Cardano&apos;s governance is right now.
        </p>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-7 w-14" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ediMetrics.map((m) => (
              <EDICard key={m.key} metric={m} />
            ))}
          </div>
        )}
      </div>

      {/* Cross-chain comparison */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-1">Cross-Chain Comparison</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Chain-native metrics — no scores or grades, raw participation and decentralization data.
        </p>

        {benchLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {cardanoBench && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <ChainComparisonBar chain="cardano" benchmark={cardanoBench} />
              </div>
            )}
            {otherBenchmarks.map((b) => (
              <div key={b.chain} className="rounded-xl border border-border bg-card p-4">
                <ChainComparisonBar chain={b.chain} benchmark={b} />
              </div>
            ))}
          </div>
        )}

        {/* AI insight */}
        {cardanoBench && otherBenchmarks.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-primary font-medium">
              {generateInsight(cardanoBench, otherBenchmarks)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function generateInsight(cardano: ChainBenchmark, others: ChainBenchmark[]): string {
  const eth = others.find((b) => b.chain === 'ethereum');
  if (cardano.delegateCount && eth?.delegateCount && cardano.delegateCount > eth.delegateCount) {
    const ratio = (cardano.delegateCount / eth.delegateCount).toFixed(1);
    return `Cardano has ${ratio}x more active governance delegates than Ethereum's combined DAO delegate pool, with on-chain rationale requirements driving higher accountability.`;
  }
  if (cardano.participationRate && eth?.participationRate) {
    const diff = cardano.participationRate - eth.participationRate;
    if (diff > 0) {
      return `Cardano's DRep participation rate is ${diff} percentage points higher than Ethereum's average voter turnout, reflecting broader governance engagement.`;
    }
  }
  return 'Cardano operates one of the most active on-chain governance systems in crypto, with delegated representatives, mandatory voting windows, and on-chain rationale support.';
}
