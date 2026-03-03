import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
} from '@/lib/og-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return new ImageResponse(<OGFallback message="Missing wallet parameter" />, {
        width: 1200,
        height: 630,
      });
    }

    const supabase = getSupabaseAdmin();

    const { data: user } = await supabase
      .from('users')
      .select('governance_level, poll_count, delegation_history')
      .eq('wallet_address', wallet)
      .single();

    // Extract most recent delegation from history array
    const history =
      (user?.delegation_history as { drepId: string; timestamp: string }[] | null) ?? [];
    const sorted = [...history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    const drepId = sorted[0]?.drepId ?? null;
    const drep = drepId ? await getDRepById(drepId) : null;
    const drepName = drep ? getDRepPrimaryName(drep) : null;
    const drepScore = drep?.drepScore ?? 0;
    const governanceLevel = user?.governance_level ?? null;
    const pollCount = user?.poll_count ?? 0;
    const color = tierColor(drepScore);
    const tier = tierLabel(drepScore);

    return new ImageResponse(
      <OGBackground glow={color}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top: governance level badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {governanceLevel && (
              <div
                style={{
                  display: 'flex',
                  padding: '6px 20px',
                  borderRadius: '20px',
                  backgroundColor: `${OG.indigo}20`,
                  border: `1px solid ${OG.indigo}40`,
                  fontSize: '18px',
                  fontWeight: 600,
                  color: OG.indigo,
                }}
              >
                {governanceLevel}
              </div>
            )}
          </div>

          {/* Center: DRep info + score */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '48px',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <OGScoreRing score={drepScore} size={200} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', fontSize: '22px', color: OG.textMuted }}>
                I&apos;m delegated to
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '40px',
                  fontWeight: 700,
                  color: OG.text,
                  lineHeight: 1.2,
                }}
              >
                {drepName
                  ? drepName.length > 28
                    ? drepName.slice(0, 26) + '…'
                    : drepName
                  : 'Unknown DRep'}
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div
                  style={{
                    display: 'flex',
                    padding: '4px 16px',
                    borderRadius: '16px',
                    backgroundColor: `${color}20`,
                    border: `1px solid ${color}40`,
                    fontSize: '16px',
                    fontWeight: 600,
                    color,
                  }}
                >
                  {tier} — {drepScore}/100
                </div>
              </div>

              {pollCount > 0 && (
                <div style={{ display: 'flex', fontSize: '18px', color: OG.textMuted }}>
                  Voted on {pollCount} proposals
                </div>
              )}
            </div>
          </div>

          {/* Bottom: CTA */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700, color: OG.brand }}>
              Who&apos;s your DRep?
            </div>
            <div style={{ display: 'flex', fontSize: '18px', color: OG.textDim }}>drepscore.io</div>
          </div>
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=900, s-maxage=900' },
      },
    );
  } catch (error) {
    console.error('[OG Delegator] Error:', error);
    return new ImageResponse(<OGFallback message="Who's your DRep?" />, {
      width: 1200,
      height: 630,
    });
  }
}
