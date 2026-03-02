'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Globe, Share2 } from 'lucide-react';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { CrossChainReportCard } from './CrossChainReportCard';
import { ShareActions } from './ShareActions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BASE_URL } from '@/lib/constants';
import type { Chain } from '@/lib/crossChain';

interface BenchmarkData {
  chain: string;
  participation_rate: number | null;
  delegate_count: number | null;
  proposal_count: number | null;
  governance_score: number | null;
  grade: string | null;
  fetched_at: string | null;
}

interface HistoryPoint {
  periodLabel: string;
  score: number | null;
  grade: string | null;
}

interface GovernanceObservatoryProps {
  variant?: 'full' | 'compact';
  className?: string;
}

export function GovernanceObservatory({ variant = 'full', className = '' }: GovernanceObservatoryProps) {
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData | null>>({});
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/governance/benchmarks');
        if (!res.ok) return;
        const data = await res.json();
        setBenchmarks(data.benchmarks ?? {});
        setHistory(data.history ?? {});
      } catch {
        // Graceful degradation — don't show section
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];
  const hasData = chains.some(c => benchmarks[c] != null);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Governance Across Chains
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/20" />
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
        {chains.map(chain => {
          const b = benchmarks[chain];
          if (!b) return null;
          return (
            <span key={chain} className="flex items-center gap-1.5">
              <span className="font-medium capitalize">{chain}</span>
              <span
                className="rounded-md px-1.5 py-0.5 text-xs font-bold"
                style={{
                  backgroundColor: `${getChainColor(chain)}15`,
                  color: getChainColor(chain),
                }}
              >
                {b.grade ?? '—'}
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
            Governance Across Chains
          </CardTitle>
          <ShareActions
            url={`${BASE_URL}/pulse`}
            text="How does governance health compare across Cardano, Ethereum, and Polkadot? Check the report cards on @drepscore:"
            imageUrl={`${BASE_URL}/api/og/cross-chain`}
            imageFilename="cross-chain-governance.png"
            surface="cross_chain_observatory"
            variant="compact"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          How does Cardano&apos;s governance stack up against other major chains?
        </p>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {chains.map(chain => {
            const b = benchmarks[chain];
            if (!b) return null;
            return (
              <CrossChainReportCard
                key={chain}
                data={{
                  chain,
                  participationRate: b.participation_rate,
                  delegateCount: b.delegate_count,
                  proposalCount: b.proposal_count,
                  governanceScore: b.governance_score,
                  grade: b.grade,
                  fetchedAt: b.fetched_at,
                }}
                history={history[chain] ?? []}
              />
            );
          })}
        </motion.div>

        {/* Methodology note */}
        <p className="mt-4 text-center text-[11px] text-muted-foreground/60">
          Scores computed from on-chain participation, delegate activity, and proposal throughput.
          Data: Cardano (GHI), Ethereum (Tally), Polkadot (SubSquare). Updated weekly.
        </p>
      </CardContent>
    </Card>
  );
}

function getChainColor(chain: Chain): string {
  const colors: Record<Chain, string> = {
    cardano: '#06b6d4',
    ethereum: '#a855f7',
    polkadot: '#ec4899',
  };
  return colors[chain];
}
