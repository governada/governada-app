import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stakeAddress: string }> },
) {
  try {
    const { stakeAddress } = await params;
    const decoded = decodeURIComponent(stakeAddress);

    const supabase = getSupabaseAdmin();

    // Look up user by stake address
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('user_id, delegation_streak_epochs, created_at')
      .eq('stake_address', decoded)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      return new ImageResponse(<OGFallback message="Civic Identity" />, {
        width: 1080,
        height: 1080,
      });
    }

    // Fetch milestones count
    const { count: milestoneCount } = await supabase
      .from('citizen_milestones')
      .select('milestone_key', { count: 'exact', head: true })
      .eq('user_id', wallet.user_id);

    // Compute citizen-since epoch (approximate from wallet creation date)
    const createdDate = new Date(wallet.created_at);
    const shelleyStart = new Date('2020-07-29T21:44:51Z');
    const epochDurationMs = 5 * 24 * 60 * 60 * 1000;
    const citizenSinceEpoch = Math.floor(
      208 + (createdDate.getTime() - shelleyStart.getTime()) / epochDurationMs,
    );

    const streak = wallet.delegation_streak_epochs ?? 0;
    const milestones = milestoneCount ?? 0;

    return new ImageResponse(
      <OGBackground glow={OG.brand}>
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
          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '24px',
              color: OG.brand,
              fontWeight: 600,
              marginBottom: '24px',
              letterSpacing: '0.05em',
            }}
          >
            CIVIC IDENTITY
          </div>

          {/* Citizen Since */}
          <div
            style={{
              display: 'flex',
              fontSize: '48px',
              fontWeight: 700,
              color: OG.text,
              marginBottom: '8px',
            }}
          >
            Citizen Since Epoch {citizenSinceEpoch}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: '48px',
              width: '100%',
              maxWidth: '800px',
              justifyContent: 'center',
            }}
          >
            <StatCard emoji="🔥" value={`${streak}`} label="Epoch Streak" />
            <StatCard emoji="🏅" value={`${milestones}`} label="Milestones" />
          </div>

          <OGFooter left="Civica" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Civic Identity] Error:', error);
    return new ImageResponse(<OGFallback message="Civic Identity" />, {
      width: 1080,
      height: 1080,
    });
  }
}

function StatCard({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 48px',
        borderRadius: '16px',
        backgroundColor: OG.bgCard,
        border: `1px solid ${OG.border}`,
        minWidth: '200px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '36px', marginBottom: '8px' }}>{emoji}</div>
      <div
        style={{
          display: 'flex',
          fontSize: '44px',
          fontWeight: 700,
          color: OG.text,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: '18px',
          color: OG.textMuted,
          marginTop: '4px',
        }}
      >
        {label}
      </div>
    </div>
  );
}
