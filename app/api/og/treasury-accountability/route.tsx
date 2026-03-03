import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';
import { getSpendingEffectiveness } from '@/lib/treasury';

export const runtime = 'edge';

export async function GET() {
  try {
    const data = await getSpendingEffectiveness();

    const rate = data.effectivenessRate !== null ? `${data.effectivenessRate}%` : 'N/A';
    const total =
      data.totalSpentAda >= 1_000_000
        ? `${(data.totalSpentAda / 1_000_000).toFixed(1)}M`
        : `${(data.totalSpentAda / 1_000).toFixed(0)}K`;

    return new ImageResponse(
      <OGBackground glow={OG.green}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '50px 60px',
          }}
        >
          <div
            style={{ display: 'flex', fontSize: '18px', color: OG.textMuted, marginBottom: '24px' }}
          >
            Cardano Treasury Accountability — DRepScore
          </div>

          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '80px',
                  fontWeight: 700,
                  color:
                    data.effectivenessRate !== null && data.effectivenessRate >= 70
                      ? OG.green
                      : data.effectivenessRate !== null && data.effectivenessRate >= 50
                        ? OG.amber
                        : OG.red,
                }}
              >
                {rate}
              </div>
              <div style={{ display: 'flex', fontSize: '24px', color: OG.textMuted }}>
                of spending rated as delivering
              </div>
            </div>

            <div style={{ display: 'flex', gap: '60px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                  Total Spent
                </div>
                <div style={{ display: 'flex', fontSize: '36px', fontWeight: 700 }}>
                  {total} ADA
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                  Proposals Enacted
                </div>
                <div style={{ display: 'flex', fontSize: '36px', fontWeight: 700 }}>
                  {data.totalEnacted}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                  Delivered
                </div>
                <div
                  style={{ display: 'flex', fontSize: '36px', fontWeight: 700, color: OG.green }}
                >
                  {data.ratingBreakdown.delivered}
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
          Accountability OG Error
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
