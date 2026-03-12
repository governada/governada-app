import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OGFallback, OG, tierColor } from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stakeAddress: string }> },
) {
  try {
    const { stakeAddress } = await params;
    const supabase = createClient();

    // Find the user's DRep
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('drep_id')
      .eq('stake_address', stakeAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const drepId = (wallet as { drep_id?: string } | null)?.drep_id ?? null;

    let coveragePct = 0;
    let votesCount = 0;
    let totalProposals = 0;
    let missedCount = 0;
    let drepName: string | null = null;

    if (drepId) {
      const [votesResult, proposalsResult, drepResult] = await Promise.all([
        supabase
          .from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', drepId),
        supabase.from('proposals').select('proposal_tx_hash', { count: 'exact', head: true }),
        supabase.from('dreps').select('info').eq('id', drepId).single(),
      ]);

      votesCount = votesResult.count ?? 0;
      totalProposals = proposalsResult.count ?? 0;
      coveragePct = totalProposals > 0 ? Math.round((votesCount / totalProposals) * 100) : 0;
      missedCount = totalProposals - votesCount;

      // Try to extract DRep name from info
      const info = drepResult.data?.info;
      if (info && typeof info === 'object') {
        const infoObj = info as Record<string, unknown>;
        drepName = (infoObj.givenName as string) ?? (infoObj.name as string) ?? null;
      }
    }

    const color = tierColor(coveragePct);
    const isGood = coveragePct >= 80;

    return new ImageResponse(
      <OGBackground glow={color}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: OG.textMuted,
              fontWeight: 500,
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              marginBottom: '12px',
            }}
          >
            Representation Coverage
          </div>

          {/* Main stat */}
          <div
            style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginBottom: '8px' }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '100px',
                fontWeight: 700,
                color,
                lineHeight: 1,
              }}
            >
              {coveragePct}%
            </div>
            <div style={{ display: 'flex', fontSize: '28px', color: OG.textMuted }}>coverage</div>
          </div>

          {/* Headline */}
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 600,
              color: OG.text,
              marginBottom: '28px',
            }}
          >
            {isGood
              ? `${drepName ? drepName : 'Your DRep'} voted on ${votesCount} of ${totalProposals} proposals`
              : `${drepName ? drepName : 'Your DRep'} missed ${missedCount} of ${totalProposals} proposals`}
          </div>

          {/* Coverage bar */}
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '32px',
              backgroundColor: OG.barBg,
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${coveragePct}%`,
                height: '100%',
                backgroundColor: color,
                borderRadius: '16px',
              }}
            />
          </div>

          {/* CTA */}
          <div
            style={{
              display: 'flex',
              padding: '12px 28px',
              borderRadius: '12px',
              backgroundColor: `${OG.brand}20`,
              border: `1px solid ${OG.brand}40`,
              fontSize: '20px',
              fontWeight: 600,
              color: OG.brand,
              alignSelf: 'flex-start',
            }}
          >
            Check your representation at governada.io
          </div>

          <OGFooter left="$governada" right="governada.io" />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Coverage Gap] Error:', error);
    return new ImageResponse(<OGFallback message="Check Your Representation" />, {
      width: 1200,
      height: 630,
    });
  }
}
