import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scenario = searchParams.get('scenario') || 'Current';
  const months = searchParams.get('months') || '—';
  const balance = searchParams.get('balance') || '—';

  return new ImageResponse(
    <OGBackground glow={OG.amber}>
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
          Treasury What-If Scenario — DRepScore
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
          <div style={{ display: 'flex', fontSize: '42px', fontWeight: 700 }}>{scenario}</div>

          <div style={{ display: 'flex', gap: '60px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                Projected Runway
              </div>
              <div style={{ display: 'flex', fontSize: '56px', fontWeight: 700, color: OG.amber }}>
                {months}mo
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                Treasury Balance
              </div>
              <div style={{ display: 'flex', fontSize: '56px', fontWeight: 700 }}>{balance}</div>
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
}
