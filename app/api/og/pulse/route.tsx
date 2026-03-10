import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const [drepsRes, proposalsRes] = await Promise.all([
      supabase.from('dreps').select('score, info').limit(2000),
      supabase
        .from('proposals')
        .select('tx_hash')
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null),
    ]);

    const dreps = drepsRes.data || [];
    const activeDReps = dreps.filter((d) => d.info?.isActive);
    const totalAda =
      activeDReps.reduce(
        (s: number, d) => s + parseInt(d.info?.votingPowerLovelace || '0', 10),
        0,
      ) / 1_000_000;

    const formattedAda =
      totalAda >= 1e9 ? `${(totalAda / 1e9).toFixed(1)}B` : `${(totalAda / 1e6).toFixed(1)}M`;
    const activeProposals = proposalsRes.data?.length || 0;

    const stats = [
      { label: 'ADA Governed', value: `${formattedAda}`, accent: OG.green },
      { label: 'Active Proposals', value: `${activeProposals}`, accent: OG.amber },
      { label: 'Active DReps', value: `${activeDReps.length}`, accent: OG.blue },
      { label: 'Total DReps', value: `${dreps.length}`, accent: OG.indigo },
    ];

    return new ImageResponse(
      <OGBackground glow={OG.indigo}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '48px' }}>
            <div style={{ display: 'flex', fontSize: '44px', fontWeight: 700, color: OG.text }}>
              Governance Pulse
            </div>
            <div
              style={{ display: 'flex', fontSize: '22px', color: OG.textMuted, marginTop: '8px' }}
            >
              Real-time Cardano governance health
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  padding: '32px 24px',
                  borderRadius: '16px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${s.accent}30`,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '52px',
                    fontWeight: 700,
                    color: s.accent,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '18px',
                    color: OG.textMuted,
                    marginTop: '12px',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
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
    console.error('[OG Pulse] Error:', error);
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
            Governance Pulse
          </div>
          <div
            style={{ display: 'flex', fontSize: '24px', color: OG.textMuted, marginTop: '16px' }}
          >
            governada.io/governance/health
          </div>
        </div>
      </OGBackground>,
      { width: 1200, height: 630 },
    );
  }
}
