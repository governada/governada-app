import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase';
import { CHAIN_IDENTITIES, type Chain } from '@/lib/crossChain';

export const dynamic = 'force-dynamic';

interface BenchmarkRow {
  chain: string;
  delegate_count: number | null;
  proposal_count: number | null;
  participation_rate: number | null;
  ai_insight: string | null;
}

function headlineFor(chain: Chain, row: BenchmarkRow): string {
  switch (chain) {
    case 'cardano':
      return row.delegate_count != null ? `${fmt(row.delegate_count)} DReps` : 'No data';
    case 'ethereum':
      return row.delegate_count != null ? `${fmt(row.delegate_count)} delegates` : 'No data';
    case 'polkadot':
      return row.proposal_count != null ? `${fmt(row.proposal_count)} referenda` : 'No data';
  }
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const TAGLINES: Record<Chain, string> = {
  cardano: 'DRep-based delegation',
  ethereum: 'DAO token voting',
  polkadot: 'Conviction voting',
};

export async function GET() {
  try {
    const supabase = createClient();

    const { data: rows } = await supabase
      .from('governance_benchmarks')
      .select('chain, delegate_count, proposal_count, participation_rate, ai_insight')
      .order('fetched_at', { ascending: false })
      .limit(3);

    const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];
    const byChain: Record<string, BenchmarkRow> = {};
    let insight: string | null = null;

    for (const chain of chains) {
      const row = (rows ?? []).find((r: { chain: string }) => r.chain === chain);
      if (row) {
        byChain[chain] = row as BenchmarkRow;
        if (!insight && (row as BenchmarkRow).ai_insight) {
          insight = (row as BenchmarkRow).ai_insight;
        }
      }
    }

    return new ImageResponse(
      <div
        style={{
          width: '1200',
          height: '630',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0b14',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>
            Governance Observatory
          </span>
        </div>
        <span style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '40px' }}>
          Each chain&apos;s governance in its own terms
        </span>

        <div style={{ display: 'flex', gap: '32px' }}>
          {chains.map((chain) => {
            const d = byChain[chain];
            const identity = CHAIN_IDENTITIES[chain];

            return (
              <div
                key={chain}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '32px 40px',
                  borderRadius: '16px',
                  border: `1px solid ${identity.color}30`,
                  backgroundColor: `${identity.color}08`,
                  minWidth: '280px',
                }}
              >
                <span
                  style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}
                >
                  {identity.name}
                </span>
                <span style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
                  {TAGLINES[chain]}
                </span>
                <span
                  style={{
                    fontSize: '36px',
                    fontWeight: 900,
                    color: identity.color,
                    lineHeight: 1,
                  }}
                >
                  {d ? headlineFor(chain, d) : '—'}
                </span>
                {d?.participation_rate != null && (
                  <span style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
                    {d.participation_rate}% participation
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {insight && (
          <div
            style={{
              display: 'flex',
              maxWidth: '900px',
              marginTop: '28px',
              padding: '12px 20px',
              borderRadius: '8px',
              backgroundColor: '#ffffff08',
            }}
          >
            <span style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
              {insight}
            </span>
          </div>
        )}

        <span style={{ fontSize: '14px', color: '#4b5563', marginTop: '24px' }}>
          drepscore.io — Governance Intelligence for Crypto
        </span>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (err) {
    console.error('[og/cross-chain] Error:', err);
    return new Response('OG image generation failed', { status: 500 });
  }
}
