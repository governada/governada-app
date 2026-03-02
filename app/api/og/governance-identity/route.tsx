import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get('wallet');

    let drepName = 'Your DRep';
    let drepScore = '—';
    let epochsActive = '—';
    let citizenSince = '';

    if (wallet) {
      const supabase = createClient();

      const { data: user } = await supabase
        .from('users')
        .select('delegated_drep_id, created_at')
        .eq('wallet_address', wallet)
        .single();

      if (user?.delegated_drep_id) {
        const { data: drep } = await supabase
          .from('dreps')
          .select('id, score, info')
          .eq('id', user.delegated_drep_id)
          .single();

        if (drep) {
          const info = drep.info as Record<string, unknown> | null;
          drepName = (info?.name as string) || (info?.ticker as string) || 'DRep';
          drepScore = String(drep.score ?? '—');
        }
      }

      if (user?.created_at) {
        const created = new Date(user.created_at);
        const daysSince = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
        const approxEpochs = Math.floor(daysSince / 5);
        epochsActive = String(approxEpochs);
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
          {/* Top accent */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
          }} />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '32px',
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#06b6d415',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              color: '#06b6d4',
              fontWeight: 800,
            }}>
              G
            </div>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>
              Governance Identity
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '40px', marginBottom: '40px' }}>
            <StatBlock label="Delegated To" value={drepName} />
            <StatBlock label="DRep Score" value={`${drepScore}/100`} />
            <StatBlock label="Epochs Active" value={epochsActive} />
          </div>

          {citizenSince && (
            <span style={{ fontSize: '16px', color: '#06b6d4', fontWeight: 600 }}>
              {citizenSince}
            </span>
          )}

          <span style={{
            fontSize: '14px',
            color: '#4b5563',
            marginTop: 'auto',
          }}>
            drepscore.io — Governance Intelligence for Cardano
          </span>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (err) {
    console.error('[og/governance-identity] Error:', err);
    return new Response('OG image generation failed', { status: 500 });
  }
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px 32px',
      borderRadius: '12px',
      border: '1px solid rgba(6, 182, 212, 0.15)',
      backgroundColor: 'rgba(6, 182, 212, 0.05)',
      minWidth: '200px',
    }}>
      <span style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>{label}</span>
      <span style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{value}</span>
    </div>
  );
}
