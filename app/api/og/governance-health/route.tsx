import { ImageResponse } from 'next/og';
import { computeGHI, GHI_BAND_COLORS, GHI_BAND_LABELS } from '@/lib/ghi';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ghi = await computeGHI();
    const color = GHI_BAND_COLORS[ghi.band];
    const label = GHI_BAND_LABELS[ghi.band];

    const supabase = createClient();
    const { data: snapshots } = await supabase
      .from('ghi_snapshots')
      .select('epoch_no, score')
      .order('epoch_no', { ascending: false })
      .limit(10);

    const prevScore = snapshots?.[0]?.score != null ? Number(snapshots[0].score) : null;
    const delta = prevScore != null ? Math.round((ghi.score - prevScore) * 10) / 10 : null;
    const trendSign = delta != null && delta > 0 ? '+' : '';

    return new ImageResponse(
      <OGBackground glow={color}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                color: OG.textMuted,
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase' as const,
              }}
            >
              Governance Health Index
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '48px', flex: 1 }}>
            {/* Score */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '140px',
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                }}
              >
                {ghi.score}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '24px',
                    fontWeight: 600,
                    color,
                    padding: '4px 16px',
                    borderRadius: '20px',
                    backgroundColor: `${color}20`,
                  }}
                >
                  {label}
                </div>
                {delta != null && delta !== 0 && (
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '22px',
                      color: delta > 0 ? OG.green : OG.red,
                    }}
                  >
                    {trendSign}
                    {delta}
                  </div>
                )}
              </div>
            </div>

            {/* Components */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {ghi.components.map((comp) => (
                <div key={comp.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      width: '160px',
                      fontSize: '18px',
                      color: OG.textMuted,
                    }}
                  >
                    {comp.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flex: 1,
                      height: '20px',
                      backgroundColor: OG.barBg,
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: `${Math.min(100, comp.value)}%`,
                        height: '100%',
                        backgroundColor: color,
                        borderRadius: '10px',
                        opacity: 0.7 + (comp.value / 100) * 0.3,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      width: '48px',
                      fontSize: '18px',
                      color: OG.text,
                      fontWeight: 600,
                      justifyContent: 'flex-end',
                    }}
                  >
                    {comp.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <OGFooter left="$governada" right="governada.io/governance/health" />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch (error) {
    console.error('[OG GHI] Error:', error);
    return new ImageResponse(
      <OGBackground>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700, color: OG.brand }}>
            Governance Health
          </div>
          <div
            style={{ display: 'flex', fontSize: '24px', color: OG.textMuted, marginTop: '16px' }}
          >
            governada.io
          </div>
        </div>
      </OGBackground>,
      { width: 1200, height: 630 },
    );
  }
}
