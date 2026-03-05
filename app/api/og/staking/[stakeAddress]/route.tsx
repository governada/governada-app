import { ImageResponse } from 'next/og';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
} from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stakeAddress: string }> },
) {
  try {
    const { stakeAddress } = await params;
    const { searchParams } = new URL(request.url);
    const poolId = searchParams.get('poolId');

    if (!poolId) {
      return new ImageResponse(<OGFallback message="Your Staking Governance" />, {
        width: 1080,
        height: 1080,
      });
    }

    const supabase = createClient();

    const { data: pool } = await supabase
      .from('pools')
      .select('pool_id, pool_name, ticker, governance_score, delegator_count, live_stake')
      .eq('pool_id', poolId)
      .single();

    if (!pool) {
      return new ImageResponse(<OGFallback message="Pool not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const score = Number(pool.governance_score ?? 0);
    const color = tierColor(score);
    const tier = tierLabel(score);
    const poolName = (pool.pool_name as string | null) ?? poolId;
    const ticker = (pool.ticker as string | null) ?? '';
    const delegatorCount = Number(pool.delegator_count ?? 0);
    const participationRate = 0; // pools table may not have this; omit if absent

    const displayName = ticker
      ? `[${ticker}] ${poolName.length > 18 ? poolName.slice(0, 16) + '\u2026' : poolName}`
      : poolName.length > 24
        ? poolName.slice(0, 22) + '\u2026'
        : poolName;

    // Suppress unused param lint — stakeAddress reserved for future personalisation
    void stakeAddress;

    return new ImageResponse(
      <OGBackground glow={color}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '80px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: '26px',
              color: OG.textMuted,
              fontWeight: 500,
              marginBottom: '28px',
            }}
          >
            Your Staking Governance
          </div>

          <OGScoreRing score={score} size={220} />

          <div
            style={{
              display: 'flex',
              marginTop: '20px',
              padding: '8px 24px',
              borderRadius: '24px',
              backgroundColor: `${color}20`,
              border: `1px solid ${color}40`,
              fontSize: '20px',
              fontWeight: 600,
              color,
            }}
          >
            {tier} Tier
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '32px',
              fontWeight: 700,
              marginTop: '20px',
              color: OG.text,
            }}
          >
            {displayName}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginTop: '32px',
            }}
          >
            {[
              { label: 'Governance Score', value: `${score}/100` },
              { label: 'Delegators', value: `${delegatorCount.toLocaleString()}` },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 28px',
                  borderRadius: '12px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${OG.border}`,
                  minWidth: '180px',
                }}
              >
                <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: OG.text }}>
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

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Staking] Error:', error);
    return new ImageResponse(<OGFallback message="Your Staking Governance" />, {
      width: 1080,
      height: 1080,
    });
  }
}
