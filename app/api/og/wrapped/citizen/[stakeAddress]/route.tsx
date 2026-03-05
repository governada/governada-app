import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
} from '@/lib/og-utils';

export const runtime = 'edge';

interface CitizenWrappedData {
  drep_name?: string;
  drep_score_end?: number;
  drep_votes_in_period?: number;
  drep_rationales_in_period?: number;
  delegation_duration_epochs?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stakeAddress: string }> },
) {
  try {
    const { stakeAddress } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get('period');

    if (!period) {
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
            <div
              style={{
                display: 'flex',
                fontSize: '52px',
                fontWeight: 700,
                color: OG.brand,
                marginBottom: '24px',
              }}
            >
              $drepscore
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '32px',
                color: OG.text,
                fontWeight: 600,
                textAlign: 'center',
                marginBottom: '16px',
              }}
            >
              Your Governance Story
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '22px',
                color: OG.textMuted,
                textAlign: 'center',
              }}
            >
              Connect your wallet to see your governance wrapped
            </div>
            <OGFooter left="$drepscore" right="drepscore.io" />
          </div>
        </OGBackground>,
        {
          width: 1080,
          height: 1080,
          headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
        },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: wrapped } = await supabase
      .from('governance_wrapped')
      .select('data')
      .eq('entity_type', 'citizen')
      .eq('entity_id', decodeURIComponent(stakeAddress))
      .eq('period_id', period)
      .single();

    if (!wrapped?.data) {
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
            <div
              style={{
                display: 'flex',
                fontSize: '52px',
                fontWeight: 700,
                color: OG.brand,
                marginBottom: '24px',
              }}
            >
              $drepscore
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '28px',
                color: OG.textMuted,
                textAlign: 'center',
              }}
            >
              Connect your wallet to see your governance story
            </div>
            <OGFooter left="$drepscore" right="drepscore.io" />
          </div>
        </OGBackground>,
        {
          width: 1080,
          height: 1080,
          headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
        },
      );
    }

    const citizenData = wrapped.data as CitizenWrappedData;
    const drepScore = citizenData.drep_score_end ?? 0;
    const drepName = citizenData.drep_name ?? 'Your DRep';
    const votesCast = citizenData.drep_votes_in_period ?? 0;
    const rationalesWritten = citizenData.drep_rationales_in_period ?? 0;
    const delegationEpochs = citizenData.delegation_duration_epochs ?? 0;
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
            padding: '80px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              color: OG.textMuted,
              fontWeight: 500,
              marginBottom: '16px',
            }}
          >
            Your Governance This Epoch
          </div>

          <OGScoreRing score={drepScore} size={220} />

          <div
            style={{
              display: 'flex',
              marginTop: '16px',
              padding: '6px 24px',
              borderRadius: '24px',
              backgroundColor: `${color}20`,
              border: `1px solid ${color}40`,
              fontSize: '20px',
              fontWeight: 600,
              color,
            }}
          >
            {tier}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '34px',
              fontWeight: 700,
              marginTop: '24px',
              color: OG.text,
            }}
          >
            {drepName.length > 22 ? drepName.slice(0, 20) + '…' : drepName}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginTop: '32px',
              width: '100%',
              maxWidth: '700px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 24px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: '28px' }}>🗳️</div>
              <div style={{ display: 'flex', fontSize: '22px', color: OG.text }}>
                Your DRep voted on{' '}
                <span
                  style={{
                    display: 'flex',
                    fontWeight: 700,
                    color,
                    marginLeft: '8px',
                    marginRight: '8px',
                  }}
                >
                  {votesCast}
                </span>{' '}
                proposals
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 24px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: '28px' }}>📝</div>
              <div style={{ display: 'flex', fontSize: '22px', color: OG.text }}>
                Providing rationales for{' '}
                <span
                  style={{
                    display: 'flex',
                    fontWeight: 700,
                    color,
                    marginLeft: '8px',
                    marginRight: '8px',
                  }}
                >
                  {rationalesWritten}
                </span>{' '}
                of them
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px 24px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: '28px' }}>⏱️</div>
              <div style={{ display: 'flex', fontSize: '22px', color: OG.text }}>
                Delegating since{' '}
                <span
                  style={{
                    display: 'flex',
                    fontWeight: 700,
                    color,
                    marginLeft: '8px',
                    marginRight: '8px',
                  }}
                >
                  {delegationEpochs}
                </span>{' '}
                epochs ago
              </div>
            </div>
          </div>

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG Wrapped Citizen] Error:', error);
    return new ImageResponse(<OGFallback message="Your Governance Story" />, {
      width: 1080,
      height: 1080,
    });
  }
}
