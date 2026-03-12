import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';
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

    // Fetch wallet + linked DRep
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('user_id, delegation_streak_epochs, drep_id')
      .eq('stake_address', stakeAddress)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const drepId = (wallet as { drep_id?: string } | null)?.drep_id ?? null;
    const streak =
      (wallet as { delegation_streak_epochs?: number } | null)?.delegation_streak_epochs ?? 0;

    // Coverage: votes cast by user's DRep / total proposals
    let coveragePct = 0;
    let votesCount = 0;
    let totalProposals = 0;

    if (drepId) {
      const [votesResult, proposalsResult] = await Promise.all([
        supabase
          .from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('drep_id', drepId),
        supabase.from('proposals').select('proposal_tx_hash', { count: 'exact', head: true }),
      ]);
      votesCount = votesResult.count ?? 0;
      totalProposals = proposalsResult.count ?? 0;
      coveragePct = totalProposals > 0 ? Math.round((votesCount / totalProposals) * 100) : 0;
    }

    // Milestones earned
    const userId = (wallet as { user_id?: string } | null)?.user_id;
    let milestonesEarned = 0;
    if (userId) {
      const { count } = await supabase
        .from('citizen_milestones')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      milestonesEarned = count ?? 0;
    }

    // Coverage bar color
    const coverageColor = coveragePct >= 80 ? OG.green : coveragePct >= 50 ? OG.amber : OG.red;

    const stats = [
      { label: 'Coverage', value: `${coveragePct}%`, color: coverageColor },
      { label: 'Proposals Influenced', value: `${votesCount}`, color: OG.blue },
      { label: 'Delegation Streak', value: `${streak} epochs`, color: OG.indigo },
      { label: 'Milestones', value: `${milestonesEarned}`, color: OG.amber },
    ];

    return new ImageResponse(
      <OGBackground glow={OG.brand}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                color: OG.textMuted,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                marginBottom: '8px',
              }}
            >
              My Governance Footprint
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '42px',
                fontWeight: 700,
                color: OG.text,
                lineHeight: 1.2,
              }}
            >
              Cardano Citizen
            </div>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              flex: 1,
              alignContent: 'center',
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px 32px',
                  borderRadius: '16px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${OG.border}`,
                  minWidth: '220px',
                  flex: '1 1 40%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '40px',
                    fontWeight: 700,
                    color: s.color,
                    lineHeight: 1,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '16px',
                    color: OG.textMuted,
                    marginTop: '8px',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Coverage bar */}
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '20px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', fontSize: '16px', color: OG.textMuted }}>
                Representation Coverage
              </div>
              <div
                style={{ display: 'flex', fontSize: '16px', color: coverageColor, fontWeight: 600 }}
              >
                {coveragePct}%
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '16px',
                backgroundColor: OG.barBg,
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: `${coveragePct}%`,
                  height: '100%',
                  backgroundColor: coverageColor,
                  borderRadius: '8px',
                }}
              />
            </div>
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
    console.error('[OG Governance Stats] Error:', error);
    return new ImageResponse(<OGFallback message="My Governance Footprint" />, {
      width: 1200,
      height: 630,
    });
  }
}
