'use client';

import { Globe, TrendingUp, TrendingDown, Minus, Info, GitBranch } from 'lucide-react';
import { scaleLinear } from 'd3-scale';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/ErrorCard';
import {
  useGovernanceBenchmarks,
  useGovernanceHealthIndex,
  useGovernanceDecentralization,
  useGovernanceInterBody,
} from '@/hooks/queries';
import { getChainMetrics, GOVERNANCE_MODELS } from '@/lib/crossChain/chainMetrics';
import type { Chain, ChainBenchmark } from '@/lib/crossChain';
import { CrossChainRadar } from '@/components/civica/charts/CrossChainRadar';
import { VotingPowerTreemap } from '@/components/civica/charts/VotingPowerTreemap';

interface EDIMetric {
  key: string;
  label: string;
  value: number | string | null;
  description: string;
  trend?: 'up' | 'down' | 'stable';
}

interface GHIComponent {
  name: string;
  value?: number;
  [key: string]: unknown;
}

interface GHIRecord {
  edi?: {
    breakdown?: { nakamotoCoefficient?: number; gini?: number };
    nakamotoCoefficient?: number;
    giniCoefficient?: number;
  };
  components?: GHIComponent[];
  current?: unknown;
  [key: string]: unknown;
}

interface DecentralizationRecord {
  giniCoefficient?: number;
  uniqueProposers?: number;
  history?: Record<string, unknown>[];
  topDRepsByPower?: { drepId: string; name: string; votingPower: number }[];
  [key: string]: unknown;
}

interface InterBodyRecord {
  drepSpoAgreement?: number;
  drepCcAgreement?: number;
  spoCcAgreement?: number;
  proposalCount?: number;
  [key: string]: unknown;
}

function buildEDIMetrics(
  ghi: GHIRecord | undefined,
  decentralization: DecentralizationRecord | undefined,
): EDIMetric[] {
  const components: GHIComponent[] = ghi?.components ?? [];
  const powerDist = components.find((c) => c.name === 'Power Distribution');
  const participation = components.find((c) => c.name === 'DRep Participation');
  const deliberation = components.find((c) => c.name === 'Deliberation Quality');
  const effectiveness = components.find((c) => c.name === 'Governance Effectiveness');
  const stability = components.find((c) => c.name === 'System Stability');

  const edi = ghi?.edi;

  return [
    {
      key: 'voting-power',
      label: 'Voting Power Distribution',
      value: edi?.breakdown?.nakamotoCoefficient ?? powerDist?.value ?? null,
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
        edi?.breakdown?.gini != null
          ? edi.breakdown.gini.toFixed(2)
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
          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
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

function MiniSparkline({
  data,
  color,
  height = 40,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  if (data.length < 2) return null;
  const W = 200;
  const PAD = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xScale = scaleLinear()
    .domain([0, data.length - 1])
    .range([PAD, W - PAD]);
  const yScale = scaleLinear()
    .domain([min - range * 0.1, max + range * 0.1])
    .range([height - PAD, PAD]);
  const pts = data.map((v, i) => `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

const DECENTRALIZATION_METRICS = [
  {
    key: 'nakamoto_coefficient',
    label: 'Nakamoto Coefficient',
    color: '#818cf8',
    format: (v: number) => String(v),
  },
  { key: 'gini', label: 'Gini Coefficient', color: '#f472b6', format: (v: number) => v.toFixed(3) },
  {
    key: 'composite_score',
    label: 'Composite Score',
    color: '#34d399',
    format: (v: number) => v.toFixed(1),
  },
  { key: 'hhi', label: 'HHI', color: '#fbbf24', format: (v: number) => v.toFixed(4) },
] as const;

function DecentralizationTrends({ history }: { history: Record<string, unknown>[] }) {
  if (history.length < 3) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {DECENTRALIZATION_METRICS.map((m) => {
        const values = history.map((h) => h[m.key]).filter((v) => v != null) as number[];
        if (values.length < 2) return null;
        const latest = values[values.length - 1];
        const prev = values[values.length - 2];
        const delta = latest - prev;
        return (
          <div key={m.key} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {m.label}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {m.format(latest)}
                </span>
                {delta !== 0 && (
                  <span
                    className={cn(
                      'text-[10px] font-medium tabular-nums',
                      delta > 0 ? 'text-emerald-400' : 'text-rose-400',
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {m.format(delta)}
                  </span>
                )}
              </div>
            </div>
            <MiniSparkline data={values} color={m.color} />
          </div>
        );
      })}
    </div>
  );
}

function InterBodySummary({ interBody }: { interBody: InterBodyRecord }) {
  const pairs = [
    { label: 'DRep ↔ SPO', value: interBody.drepSpoAgreement },
    { label: 'DRep ↔ CC', value: interBody.drepCcAgreement },
    { label: 'SPO ↔ CC', value: interBody.spoCcAgreement },
  ].filter((p) => p.value != null && p.value > 0);

  if (pairs.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <GitBranch className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Inter-Body Alignment</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        How often DReps, SPOs, and the Constitutional Committee vote the same way.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {pairs.map((p) => {
          const pct = Math.round(p.value!);

          return (
            <div key={p.label} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {p.label}
              </p>
              <p
                className={cn(
                  'font-display text-2xl font-bold tabular-nums',
                  pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-rose-400',
                )}
              >
                {pct}%
              </p>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500',
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {(interBody.proposalCount ?? 0) > 0 && (
        <p className="text-[10px] text-muted-foreground mt-2">
          Based on {interBody.proposalCount} proposal
          {(interBody.proposalCount ?? 0) !== 1 ? 's' : ''} with multi-body votes
        </p>
      )}
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
  const {
    data: rawGHI,
    isLoading: ghiLoading,
    isError: ghiError,
    refetch: refetchGhi,
  } = useGovernanceHealthIndex(1);
  const {
    data: rawBenchmarks,
    isLoading: benchLoading,
    isError: benchError,
    refetch: refetchBench,
  } = useGovernanceBenchmarks();
  const { data: rawDecentralization } = useGovernanceDecentralization();
  const { data: rawInterBody } = useGovernanceInterBody();

  const ghiData = rawGHI as GHIRecord | undefined;
  const ghi = (ghiData?.current ?? rawGHI) as GHIRecord | undefined;
  const benchmarksRaw = rawBenchmarks as Record<string, unknown> | undefined;
  const benchmarksObj = (benchmarksRaw?.benchmarks ?? {}) as Record<string, unknown>;
  const benchmarks = Object.values(benchmarksObj)
    .filter(Boolean)
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        chain: r.chain as Chain,
        periodLabel: (r.period_label ?? r.periodLabel ?? '') as string,
        participationRate: (r.participation_rate ?? r.participationRate ?? null) as number | null,
        delegateCount: (r.delegate_count ?? r.delegateCount ?? null) as number | null,
        proposalCount: (r.proposal_count ?? r.proposalCount ?? null) as number | null,
        proposalThroughput: (r.proposal_throughput ?? r.proposalThroughput ?? null) as
          | number
          | null,
        avgRationaleRate: (r.avg_rationale_rate ?? r.avgRationaleRate ?? null) as number | null,
        rawData: (r.raw_data ?? r.rawData ?? {}) as Record<string, unknown>,
        fetchedAt: (r.fetched_at ?? r.fetchedAt ?? '') as string,
      } satisfies ChainBenchmark;
    });
  const decentralization = rawDecentralization as DecentralizationRecord | undefined;
  const interBody = rawInterBody as InterBodyRecord | undefined;

  const ediMetrics = buildEDIMetrics(ghi, decentralization);
  const decHistory: Record<string, unknown>[] = decentralization?.history ?? [];
  const topDRepsByPower = (decentralization?.topDRepsByPower ?? []) as {
    drepId: string;
    name: string;
    votingPower: number;
  }[];
  const loading = ghiLoading || benchLoading;
  const hasError = ghiError || benchError;

  const cardanoBench = benchmarks.find((b) => b.chain === 'cardano');
  const otherBenchmarks = benchmarks.filter((b) => b.chain !== 'cardano');

  if (hasError) {
    return (
      <ErrorCard
        message="Unable to load observatory data."
        onRetry={() => {
          refetchGhi();
          refetchBench();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Observatory intro */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <p className="text-sm text-foreground/90">
          The Observatory tracks Cardano&apos;s governance health in real time — how decentralized
          power is, how engaged representatives are, and how Cardano compares to other chains.
        </p>
      </div>

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

      {/* Decentralization trends */}
      <DecentralizationTrends history={decHistory} />

      {/* Inter-body alignment */}
      {interBody && (interBody.proposalCount ?? 0) > 0 && (
        <InterBodySummary interBody={interBody} />
      )}

      {/* Voting power treemap */}
      {topDRepsByPower.length > 0 && (
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider mb-1">
            Voting Power Distribution
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            How voting power is distributed among the top DReps.
          </p>
          <VotingPowerTreemap dreps={topDRepsByPower} />
        </div>
      )}

      {/* Cross-chain radar comparison */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider mb-1">Cross-Chain Comparison</h3>
        <p className="text-xs text-muted-foreground mb-4">
          How Cardano governance compares across key dimensions.
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
        ) : benchmarks.length > 0 ? (
          <div className="space-y-4">
            {/* Radar chart */}
            <div className="rounded-xl border border-border bg-card p-4">
              <CrossChainRadar
                chains={benchmarks.map((b) => ({
                  chain: b.chain,
                  color:
                    b.chain === 'cardano'
                      ? '#818cf8'
                      : b.chain === 'ethereum'
                        ? '#6366f1'
                        : '#ec4899',
                  values: {
                    participation: Math.min(100, b.participationRate ?? 0),
                    delegates: Math.min(
                      100,
                      ((b.delegateCount ?? 0) /
                        Math.max(1, ...benchmarks.map((x) => x.delegateCount ?? 0))) *
                        100,
                    ),
                    onchain: b.chain === 'cardano' ? 90 : b.chain === 'polkadot' ? 85 : 40,
                    rationale: b.chain === 'cardano' ? 70 : b.chain === 'ethereum' ? 20 : 30,
                    diversity: Math.min(100, ((b.delegateCount ?? 0) / 10) * 5),
                  },
                }))}
                axes={[
                  { key: 'participation', label: 'Participation' },
                  { key: 'delegates', label: 'Delegate Pool' },
                  { key: 'onchain', label: 'On-chain' },
                  { key: 'rationale', label: 'Rationale' },
                  { key: 'diversity', label: 'Diversity' },
                ]}
              />
            </div>

            {/* Individual chain cards (detail) */}
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
          </div>
        ) : null}

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
