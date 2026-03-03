import { ImageResponse } from 'next/og';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import {
  OGBackground,
  OGScoreRing,
  OGPillarBar,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
  shortenDRepId,
} from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(request: Request, { params }: { params: Promise<{ drepId: string }> }) {
  try {
    const { drepId } = await params;
    const drep = await getDRepById(decodeURIComponent(drepId));

    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1200,
        height: 630,
      });
    }

    const name = getDRepPrimaryName(drep);
    const color = tierColor(drep.drepScore);
    const tier = tierLabel(drep.drepScore);
    const pillars = [
      { label: 'Participation', value: (drep.effectiveParticipation / 100) * 30, maxPoints: 30 },
      { label: 'Rationale', value: (drep.rationaleRate / 100) * 35, maxPoints: 35 },
      { label: 'Reliability', value: (drep.reliabilityScore / 100) * 20, maxPoints: 20 },
      { label: 'Profile', value: (drep.profileCompleteness / 100) * 15, maxPoints: 15 },
    ];

    return new ImageResponse(
      <OGBackground glow={color}>
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '48px 64px' }}>
          {/* Left: Score ring + tier badge */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '300px',
              marginRight: '48px',
            }}
          >
            <OGScoreRing score={drep.drepScore} size={200} />
            <div
              style={{
                display: 'flex',
                marginTop: '16px',
                padding: '6px 20px',
                borderRadius: '20px',
                backgroundColor: `${color}20`,
                border: `1px solid ${color}40`,
                fontSize: '18px',
                fontWeight: 600,
                color,
              }}
            >
              {tier}
            </div>
          </div>

          {/* Right: Info + pillars */}
          <div
            style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: '42px',
                  fontWeight: 700,
                  color: OG.text,
                  lineHeight: 1.2,
                }}
              >
                {name.length > 24 ? name.slice(0, 22) + '…' : name}
              </div>
              <div
                style={{ display: 'flex', gap: '16px', marginTop: '10px', alignItems: 'center' }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '16px',
                    color: OG.textDim,
                    fontFamily: 'monospace',
                  }}
                >
                  {shortenDRepId(drep.drepId)}
                </div>
                {drep.isActive && (
                  <div
                    style={{
                      display: 'flex',
                      padding: '2px 10px',
                      borderRadius: '10px',
                      backgroundColor: `${OG.green}20`,
                      fontSize: '13px',
                      color: OG.green,
                      fontWeight: 500,
                    }}
                  >
                    Active
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    padding: '2px 10px',
                    borderRadius: '10px',
                    backgroundColor: `${OG.blue}20`,
                    fontSize: '13px',
                    color: OG.blue,
                    fontWeight: 500,
                  }}
                >
                  {drep.sizeTier}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {pillars.map((p) => (
                <OGPillarBar key={p.label} {...p} />
              ))}
            </div>
          </div>
        </div>
        <OGFooter />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG] Error generating image:', error);
    return new ImageResponse(<OGFallback message="Find your ideal Cardano DRep" />, {
      width: 1200,
      height: 630,
    });
  }
}
