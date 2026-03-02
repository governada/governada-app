'use client';

import { useEffect, useState } from 'react';
import { CHAIN_IDENTITIES, getGradeColor, type Chain } from '@/lib/crossChain';

interface EmbedCrossChainProps {
  theme: 'dark' | 'light';
}

interface BenchmarkData {
  governance_score: number | null;
  grade: string | null;
  participation_rate: number | null;
}

export function EmbedCrossChain({ theme }: EmbedCrossChainProps) {
  const isDark = theme === 'dark';
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/governance/benchmarks')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.benchmarks) setBenchmarks(data.benchmarks);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-6"
        style={{ backgroundColor: isDark ? '#0a0b14' : '#fff', minHeight: 120 }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#06b6d4', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded-xl"
      style={{
        backgroundColor: isDark ? '#0a0b14' : '#fff',
        color: isDark ? '#fff' : '#0a0b14',
        border: `1px solid rgba(6, 182, 212, 0.15)`,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: 360,
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
        Governance Across Chains
      </div>

      <div className="space-y-2">
        {chains.map(chain => {
          const b = benchmarks[chain];
          const identity = CHAIN_IDENTITIES[chain];
          const grade = b?.grade ?? '—';
          const gradeColor = b?.grade ? getGradeColor(b.grade) : '#6b7280';

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
              <span className="flex-1 text-sm font-medium">{identity.name}</span>
              <span
                className="text-xl font-black"
                style={{ color: gradeColor }}
              >
                {grade}
              </span>
              <span className="text-xs tabular-nums" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
                {b?.governance_score ?? '—'}/100
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between items-center">
        <a
          href="https://drepscore.io/pulse"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-medium hover:underline"
          style={{ color: '#06b6d4' }}
        >
          View full comparison →
        </a>
        <span className="text-[9px]" style={{ color: isDark ? '#374151' : '#d1d5db' }}>
          drepscore.io
        </span>
      </div>
    </div>
  );
}
