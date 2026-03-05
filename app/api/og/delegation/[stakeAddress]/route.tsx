import { ImageResponse } from 'next/og';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
  shortenDRepId,
} from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ stakeAddress: string }> },
) {
  try {
    const { stakeAddress } = await params;
    const { searchParams } = new URL(request.url);
    const drepIdParam = searchParams.get('drepId');

    const supabase = createClient();

    if (!drepIdParam) {
      const shortStake = `${stakeAddress.slice(0, 12)}...${stakeAddress.slice(-6)}`;
      return new ImageResponse(
        <OGBackground>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              height: '100%',
              padding: '80px',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
            }}
          >
            <div style={{ display: 'flex', fontSize: '28px', color: OG.textMuted, fontWeight: 500 }}>
              Your Governance This Epoch
            </div>
            <div style={{ display: 'flex', fontSize: '20px', color: OG.textDim, fontFamily: 'monospace' }}>
              {shortStake}
            </div>
            <div
              style={{
                display: 'flex',
                padding: '16px 32px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
                fontSize: '18px',
                color: OG.textMuted,
              }}
            >
              Delegation data syncing…
            </div>
            <OGFooter left="$drepscore" right="drepscore.io" />
          </div>
        </OGBackground>,
        {
          width: 1080,
          height: 1080,
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
        },
      );
    }

    const drepId = decodeURIComponent(drepIdParam);

    const { data: drep } = await supabase
      .from('dreps')
      .select('id, score, current_tier, info')
      .eq('id', drepId)
      .single();

    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const info = (drep.info as Record<string, unknown> | null) ?? {};
    const score = Number(drep.score ?? 0);
    const rawName = (info.name as string | null) ?? null;
    const name = rawName
      ? rawName.length > 20
        ? rawName.slice(0, 18) + '…'
        : rawName
      : shortenDRepId(drepId);
    const tier = (drep.current_tier as string | null) ?? tierLabel(score);
    const totalVotes = Number(info.totalVotes ?? 0);
    const delegatorCount = Number(info.delegatorCount ?? 0);
    const color = tierColor(score);

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
              marginBottom: '32px',
            }}
          >
            Your Governance This Epoch
          </div>

          <OGScoreRing score={score} size={220} />

          <div
            style={{
              display: 'flex',
              marginTop: '20px',
              padding: '8px 24px',
              borderRadius: '24px',
              backgroundColor: `${color}20`,
              border: `1px solid ${color}40`,
              fontSize: '20px',
              fontWeight: 600,
              color,
            }}
          >
            {tier} Tier
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
            {name}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginTop: '36px',
            }}
          >
            {[
              { label: 'Proposals Voted', value: `${totalVotes}` },
              { label: 'Delegators', value: `${delegatorCount}` },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 32px',
                  borderRadius: '12px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${OG.border}`,
                  minWidth: '180px',
                }}
              >
                <div
                  style={{ display: 'flex', fontSize: '32px', fontWeight: 700, color: OG.text }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '14px',
                    color: OG.textMuted,
                    marginTop: '4px',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Delegation] Error:', error);
    return new ImageResponse(<OGFallback message="Your Governance" />, {
      width: 1080,
      height: 1080,
    });
  }
}
