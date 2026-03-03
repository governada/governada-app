import { ImageResponse } from 'next/og';
import { OGBackground, OGScoreRing, OGFooter, OG } from '@/lib/og-utils';
import {
  getTreasuryBalance,
  calculateTreasuryHealthScore,
  getTreasuryTrend,
  calculateBurnRate,
  calculateRunwayMonths,
} from '@/lib/treasury';

export const runtime = 'edge';

export async function GET() {
  try {
    const [balance, healthScore, snapshots] = await Promise.all([
      getTreasuryBalance(),
      calculateTreasuryHealthScore(),
      getTreasuryTrend(10),
    ]);

    if (!balance) {
      return new ImageResponse(
        <OGBackground>
          <div
            style={{
              display: 'flex',
              padding: '60px',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: OG.textMuted,
            }}
          >
            Treasury data unavailable
          </div>
        </OGBackground>,
        {
          width: 1200,
          height: 630,
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
        },
      );
    }

    const burnRate = calculateBurnRate(snapshots, 10);
    const runway = calculateRunwayMonths(balance.balanceAda, burnRate);
    const score = healthScore?.score ?? 0;
    const balanceStr = formatLargeNumber(balance.balanceAda);
    const runwayStr = runway >= 999 ? '∞' : `${Math.round(runway)}mo`;

    const trend =
      snapshots.length >= 2
        ? balance.balanceAda > snapshots[snapshots.length - 2].balanceAda
          ? '↑'
          : '↓'
        : '';

    return new ImageResponse(
      <OGBackground glow={OG.indigo}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '50px 60px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', fontSize: '18px', color: OG.textMuted }}>
              Cardano Treasury Intelligence
            </div>
          </div>

          <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '60px' }}>
            {/* Health Score Ring */}
            <OGScoreRing score={score} size={200} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
              {/* Balance */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                  Treasury Balance
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700 }}>
                    {balanceStr}
                  </div>
                  <div style={{ display: 'flex', fontSize: '20px', color: OG.textMuted }}>
                    ADA {trend}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                    Runway
                  </div>
                  <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700 }}>
                    {runwayStr}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                    Health Score
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '32px',
                      fontWeight: 700,
                      color: score >= 75 ? OG.green : score >= 50 ? OG.amber : OG.red,
                    }}
                  >
                    {score}/100
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                    Epoch
                  </div>
                  <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700 }}>
                    {balance.epoch}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <OGFooter />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch {
    return new ImageResponse(
      <OGBackground>
        <div style={{ display: 'flex', padding: '60px', fontSize: '24px', color: OG.textMuted }}>
          Treasury OG Error
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  }
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
}
