import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase';
import { getDRepPrimaryName } from '@/utils/display';
import { OGBackground, OGFooter, OG, tierColor } from '@/lib/og-utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: topDreps } = await supabase
      .from('dreps')
      .select('drep_id, name, ticker, handle, score, info')
      .order('score', { ascending: false })
      .limit(5);

    const dreps = (topDreps || []).map((d, i: number) => ({
      rank: i + 1,
      name: getDRepPrimaryName({ ...d, drepId: d.drep_id }),
      score: d.score ?? 0,
    }));

    return new ImageResponse(
      <OGBackground glow={OG.green}>
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
            <div style={{ display: 'flex', fontSize: '44px', fontWeight: 700, color: OG.text }}>
              DRep Leaderboard
            </div>
            <div
              style={{ display: 'flex', fontSize: '22px', color: OG.textMuted, marginTop: '8px' }}
            >
              Top scoring Cardano DReps
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
            {dreps.map((d) => {
              const color = tierColor(d.score);
              return (
                <div
                  key={d.rank}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 24px',
                    borderRadius: '12px',
                    backgroundColor: OG.bgCard,
                    border: `1px solid ${OG.border}`,
                    gap: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '28px',
                      fontWeight: 700,
                      color: d.rank <= 3 ? OG.amber : OG.textMuted,
                      width: '40px',
                    }}
                  >
                    #{d.rank}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flex: 1,
                      fontSize: '24px',
                      fontWeight: 600,
                      color: OG.text,
                    }}
                  >
                    {d.name.length > 24 ? d.name.slice(0, 22) + '…' : d.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '28px',
                      fontWeight: 700,
                      color,
                    }}
                  >
                    {d.score}
                  </div>
                </div>
              );
            })}
          </div>

          <OGFooter left="$governada" right="governada.io/governance/health#leaderboard" />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Leaderboard] Error:', error);
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
            DRep Leaderboard
          </div>
        </div>
      </OGBackground>,
      { width: 1200, height: 630 },
    );
  }
}
