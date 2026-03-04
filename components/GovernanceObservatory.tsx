'use client';

import { motion } from 'framer-motion';
import { useGovernanceBenchmarks } from '@/hooks/queries';
import { Globe, Sparkles } from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { CrossChainReportCard } from './CrossChainReportCard';
import { CrossChainDecentralization } from './CrossChainDecentralization';
import { ShareActions } from './ShareActions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BASE_URL } from '@/lib/constants';
import { CHAIN_IDENTITIES, type Chain, type ChainBenchmark } from '@/lib/crossChain';
import { getHeadlineMetric } from '@/lib/crossChain/chainMetrics';

interface BenchmarkRow {
  chain: string;
  period_label: string;
  participation_rate: number | null;
  delegate_count: number | null;
  proposal_count: number | null;
  proposal_throughput: number | null;
  avg_rationale_rate: number | null;
  raw_data: Record<string, unknown> | null;
  fetched_at: string;
}

interface GovernanceObservatoryProps {
  variant?: 'full' | 'compact';
  className?: string;
}

function rowToBenchmark(chain: Chain, row: BenchmarkRow): ChainBenchmark {
  return {
    chain,
    periodLabel: row.period_label,
    participationRate: row.participation_rate,
    delegateCount: row.delegate_count,
    proposalCount: row.proposal_count,
    proposalThroughput: row.proposal_throughput,
    avgRationaleRate: row.avg_rationale_rate,
    rawData: row.raw_data ?? {},
    fetchedAt: row.fetched_at,
  };
}

export function GovernanceObservatory({
  variant = 'full',
  className = '',
}: GovernanceObservatoryProps) {
  const { data: rawData, isLoading } = useGovernanceBenchmarks();
  const benchmarks = (rawData as { benchmarks?: Record<string, BenchmarkRow | null>; aiInsight?: string | null })?.benchmarks ?? {};
  const aiInsight = (rawData as { aiInsight?: string | null })?.aiInsight ?? null;

  const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];
  const hasData = chains.some((c) => benchmarks[c] != null);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Governance Observatory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-muted/20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasData) return null;

  if (variant === 'compact') {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className={`flex flex-wrap items-center justify-center gap-4 text-sm ${className}`}
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
          Governance across 3 chains:
        </span>
        {chains.map((chain) => {
          const row = benchmarks[chain];
          if (!row) return null;
          const b = rowToBenchmark(chain, row);
          const headline = getHeadlineMetric(b);
          const color = CHAIN_IDENTITIES[chain].color;
          return (
            <span key={chain} className="flex items-center gap-1.5">
              <span className="font-medium capitalize">{chain}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: `${color}15`,
                  color,
                }}
              >
                {headline}
              </span>
            </span>
          );
        })}
      </motion.div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Governance Observatory
          </CardTitle>
          <ShareActions
            url={`${BASE_URL}/pulse`}
            text="How does governance compare across Cardano, Ethereum, and Polkadot? Check the Observatory on @drepscore:"
            imageUrl={`${BASE_URL}/api/og/cross-chain`}
            imageFilename="cross-chain-governance.png"
            surface="cross_chain_observatory"
            variant="compact"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Each chain&apos;s governance health in its own terms — no false equivalences.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Section 1: Chain cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {chains.map((chain) => {
            const row = benchmarks[chain];
            if (!row) return null;
            return <CrossChainReportCard key={chain} benchmark={rowToBenchmark(chain, row)} />;
          })}
        </motion.div>

        {/* Section 2: AI insight banner */}
        {aiInsight && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="flex items-start gap-3 rounded-lg border border-border/30 bg-muted/10 px-4 py-3"
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500/70" />
            <div className="min-w-0">
              <p className="text-sm italic text-muted-foreground">{aiInsight}</p>
              <span className="mt-1 inline-block text-[10px] text-muted-foreground/40">
                AI-generated observation
              </span>
            </div>
          </motion.div>
        )}

        {/* Section 3: Decentralization comparison */}
        <CrossChainDecentralization />

        {/* Methodology footer */}
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/50">
          Each chain&apos;s metrics reflect its own governance model. Cross-chain scores are only
          shown for mathematically comparable properties (power distribution). Data sources: Cardano
          (on-chain via Koios), Ethereum (Tally), Polkadot (SubSquare).
        </p>
      </CardContent>
    </Card>
  );
}
