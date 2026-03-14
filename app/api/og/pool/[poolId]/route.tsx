import { ImageResponse } from 'next/og';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
  formatAdaCompact,
} from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  try {
    const { poolId } = await params;
    const supabase = createClient();

    const { data: pool } = await supabase
      .from('pools')
      .select(
        'pool_id, pool_name, ticker, governance_score, delegator_count, live_stake_lovelace, governance_participation_rate',
      )
      .eq('pool_id', poolId)
      .single();

    if (!pool) {
      return new ImageResponse(<OGFallback message="Pool not found" />, {
        width: 1200,
        height: 630,
      });
    }

    const score = Number(pool.governance_score ?? 0);
    const color = tierColor(score);
    const tier = tierLabel(score);
    const poolName = (pool.pool_name as string | null) ?? poolId;
    const ticker = (pool.ticker as string | null) ?? '';
    const delegatorCount = Number(pool.delegator_count ?? 0);
    const stakeLovelace = Number(pool.live_stake_lovelace ?? 0);
    const participationRate = Number(
      (pool as Record<string, unknown>).governance_participation_rate ?? 0,
    );

    const displayName = ticker
      ? `[${ticker}] ${poolName.length > 20 ? poolName.slice(0, 18) + '\u2026' : poolName}`
      : poolName.length > 28
        ? poolName.slice(0, 26) + '\u2026'
        : poolName;

    const stats = [
      { label: 'Governance Score', value: `${score}/100` },
      { label: 'Delegators', value: delegatorCount.toLocaleString() },
      { label: 'Live Stake', value: `${formatAdaCompact(stakeLovelace)} ADA` },
      ...(participationRate > 0
        ? [{ label: 'Participation', value: `${Math.round(participationRate)}%` }]
        : []),
    ];

    return new ImageResponse(
      <OGBackground glow={color}>
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '48px 64px' }}>
          {/* Left: Score ring + tier badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '300px',
              marginRight: '48px',
            }}
          >
            <OGScoreRing score={score} size={200} />
            <div
              style={{
                display: 'flex',
                marginTop: '16px',
                padding: '6px 20px',
                borderRadius: '20px',
                backgroundColor: `${color}20`,
                border: `1px solid ${color}40`,
                fontSize: '18px',
                fontWeight: 600,
                color,
              }}
            >
              {tier}
            </div>
          </div>

          {/* Right: Pool info + stats grid */}
          <div
            style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}
          >
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '18px',
                  color: OG.textMuted,
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  marginBottom: '8px',
                }}
              >
                Stake Pool Governance
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '38px',
                  fontWeight: 700,
                  color: OG.text,
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
            </div>

            {/* Stats grid */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              {stats.map((s) => (
                <div
                  key={s.label}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    backgroundColor: OG.bgCard,
                    border: `1px solid ${OG.border}`,
                    minWidth: '160px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '26px',
                      fontWeight: 700,
                      color: OG.text,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '14px',
                      color: OG.textMuted,
                      marginTop: '4px',
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <OGFooter />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Pool] Error:', error);
    return new ImageResponse(<OGFallback message="Stake Pool Governance" />, {
      width: 1200,
      height: 630,
    });
  }
}
