'use client';

import { useGovernanceBenchmarks } from '@/hooks/queries';
import { CHAIN_IDENTITIES, type Chain } from '@/lib/crossChain';

interface EmbedCrossChainProps {
  theme: 'dark' | 'light';
}

interface BenchmarkData {
  delegate_count: number | null;
  proposal_count: number | null;
  participation_rate: number | null;
}

const TAGLINES: Record<Chain, string> = {
  cardano: 'DRep delegation',
  ethereum: 'DAO token voting',
  polkadot: 'Conviction voting',
};

function headline(chain: Chain, b: BenchmarkData | null): string {
  if (!b) return '—';
  switch (chain) {
    case 'cardano':
      return b.delegate_count != null ? `${fmt(b.delegate_count)} DReps` : '—';
    case 'ethereum':
      return b.delegate_count != null ? `${fmt(b.delegate_count)} delegates` : '—';
    case 'polkadot':
      return b.proposal_count != null ? `${fmt(b.proposal_count)} referenda` : '—';
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function EmbedCrossChain({ theme }: EmbedCrossChainProps) {
  const isDark = theme === 'dark';
  const { data: benchmarkData, isLoading: loading } = useGovernanceBenchmarks();
  const benchmarks = ((benchmarkData as any)?.benchmarks ?? {}) as Record<string, BenchmarkData | null>;

  const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-6"
        style={{ backgroundColor: isDark ? '#0a0b14' : '#fff', minHeight: 120 }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: '#06b6d4', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: isDark ? '#0a0b14' : '#fff',
        color: isDark ? '#fff' : '#0a0b14',
        border: `1px solid rgba(6, 182, 212, 0.15)`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 360,
      }}
    >
      <div
        className="mb-3 text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: isDark ? '#6b7280' : '#9ca3af' }}
      >
        Governance Observatory
      </div>

      <div className="space-y-2">
        {chains.map((chain) => {
          const b = benchmarks[chain] as BenchmarkData | null;
          const identity = CHAIN_IDENTITIES[chain];

          return (
            <div
              key={chain}
              className="flex items-center gap-3 rounded-lg p-2"
              style={{ backgroundColor: `${identity.color}08` }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
                style={{ backgroundColor: `${identity.color}15`, color: identity.color }}
              >
                {identity.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium">{identity.name}</span>
                <div className="text-[10px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                  {TAGLINES[chain]}
                </div>
              </div>
              <span className="text-sm font-bold tabular-nums" style={{ color: identity.color }}>
                {headline(chain, b)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <a
          href="https://drepscore.io/pulse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-medium hover:underline"
          style={{ color: '#06b6d4' }}
        >
          View full Observatory →
        </a>
        <span className="text-[9px]" style={{ color: isDark ? '#374151' : '#d1d5db' }}>
          drepscore.io
        </span>
      </div>
    </div>
  );
}
