import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase';
import { getGradeColor, CHAIN_IDENTITIES, type Chain } from '@/lib/crossChain';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const enabled = await getFeatureFlag('cross_chain_embed');
    if (!enabled) {
      return new Response('Feature disabled', { status: 404 });
    }

    const supabase = createClient();

    const { data: rows } = await supabase
      .from('governance_benchmarks')
      .select('chain, governance_score, grade, participation_rate, delegate_count')
      .order('fetched_at', { ascending: false })
      .limit(3);

    const chains: Chain[] = ['cardano', 'ethereum', 'polkadot'];
    const byChain: Record<string, { score: number; grade: string; participation: number | null; delegates: number | null }> = {};

    for (const chain of chains) {
      const row = (rows ?? []).find((r: { chain: string }) => r.chain === chain);
      if (row) {
        byChain[chain] = {
          score: row.governance_score ?? 0,
          grade: row.grade ?? '—',
          participation: row.participation_rate,
          delegates: row.delegate_count,
        };
      }
    }

    return new ImageResponse(
      (
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
          {/* Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <span style={{ fontSize: '32px', fontWeight: 800, color: '#fff' }}>
              Governance Health Across Chains
            </span>
          </div>
          <span style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '40px' }}>
            How do major blockchain governance systems compare?
          </span>

          {/* Cards */}
          <div style={{ display: 'flex', gap: '32px' }}>
            {chains.map(chain => {
              const d = byChain[chain];
              const identity = CHAIN_IDENTITIES[chain];
              const gradeColor = d ? getGradeColor(d.grade) : '#6b7280';

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
                  <span style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                    {identity.name}
                  </span>
                  <span style={{ fontSize: '72px', fontWeight: 900, color: gradeColor, lineHeight: 1 }}>
                    {d?.grade ?? '—'}
                  </span>
                  <span style={{ fontSize: '18px', color: '#9ca3af', marginTop: '8px' }}>
                    {d ? `${d.score}/100` : 'No data'}
                  </span>
                  {d?.participation != null && (
                    <span style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
                      {d.participation}% participation
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Branding */}
          <span style={{ fontSize: '14px', color: '#4b5563', marginTop: '32px' }}>
            drepscore.io — Governance Intelligence for Crypto
          </span>
        </div>
      ),
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
