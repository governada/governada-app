import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
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

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const drepId = request.nextUrl.searchParams.get('drepId');
    if (!drepId) {
      return new ImageResponse(<OGFallback message="Connect your wallet to find your DRep" />, {
        width: 1080,
        height: 1080,
      });
    }

    const drep = await getDRepById(decodeURIComponent(drepId));
    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const name = getDRepPrimaryName(drep);
    const color = tierColor(drep.drepScore);
    const tier = tierLabel(drep.drepScore);

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
          <div style={{ display: 'flex', fontSize: '28px', color: OG.textMuted, fontWeight: 500 }}>
            I&apos;m delegated to
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '44px',
              fontWeight: 700,
              color: OG.text,
              marginTop: '16px',
              marginBottom: '32px',
            }}
          >
            {name.length > 20 ? name.slice(0, 18) + '…' : name}
          </div>

          <OGScoreRing score={drep.drepScore} size={240} />

          <div
            style={{
              display: 'flex',
              marginTop: '20px',
              padding: '8px 28px',
              borderRadius: '24px',
              backgroundColor: `${color}20`,
              border: `1px solid ${color}40`,
              fontSize: '20px',
              fontWeight: 600,
              color,
            }}
          >
            {tier} Governance Representative
          </div>

          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: '36px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700, color: OG.text }}>
                {drep.effectiveParticipation}%
              </div>
              <div style={{ display: 'flex', fontSize: '16px', color: OG.textMuted }}>
                Participation
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700, color: OG.text }}>
                {drep.rationaleRate}%
              </div>
              <div style={{ display: 'flex', fontSize: '16px', color: OG.textMuted }}>
                Rationale
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '32px', fontWeight: 700, color: OG.text }}>
                {drep.reliabilityScore}%
              </div>
              <div style={{ display: 'flex', fontSize: '16px', color: OG.textMuted }}>
                Reliability
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '26px',
              fontWeight: 600,
              color: OG.brand,
              marginTop: '48px',
            }}
          >
            Who&apos;s your DRep?
          </div>

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, max-age=900, s-maxage=900' },
      },
    );
  } catch (error) {
    console.error('[OG Wrapped Delegator] Error:', error);
    return new ImageResponse(<OGFallback message="Who's your DRep?" />, {
      width: 1080,
      height: 1080,
    });
  }
}
