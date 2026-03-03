import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { OGBackground, OGScoreRing, OGFooter, OGFallback, OG, tierColor } from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  try {
    const { drepId } = await params;
    const drep = await getDRepById(decodeURIComponent(drepId));
    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const prevScore = parseInt(request.nextUrl.searchParams.get('prev') || '0');
    const delta = drep.drepScore - prevScore;
    const isGain = delta > 0;
    const name = getDRepPrimaryName(drep);
    const color = tierColor(drep.drepScore);
    const deltaColor = isGain ? OG.green : OG.red;
    const narrative =
      request.nextUrl.searchParams.get('reason') || (isGain ? 'Score improved!' : 'Score changed');

    return new ImageResponse(
      <OGBackground glow={deltaColor}>
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
              fontSize: '24px',
              color: deltaColor,
              fontWeight: 600,
              padding: '6px 20px',
              borderRadius: '20px',
              backgroundColor: `${deltaColor}15`,
              border: `1px solid ${deltaColor}30`,
              marginBottom: '24px',
            }}
          >
            {isGain ? '↑' : '↓'} {Math.abs(delta)} points
          </div>

          <OGScoreRing score={drep.drepScore} size={240} />

          <div
            style={{
              display: 'flex',
              fontSize: '36px',
              fontWeight: 700,
              color: OG.text,
              marginTop: '24px',
            }}
          >
            {name.length > 20 ? name.slice(0, 18) + '…' : name}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: OG.textMuted,
              marginTop: '12px',
            }}
          >
            {narrative}
          </div>

          {prevScore > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                marginTop: '40px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', fontSize: '16px', color: OG.textDim }}>Previous</div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '40px',
                    fontWeight: 700,
                    color: OG.textMuted,
                  }}
                >
                  {prevScore}
                </div>
              </div>
              <div
                style={{ display: 'flex', fontSize: '32px', color: deltaColor, fontWeight: 700 }}
              >
                →
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', fontSize: '16px', color: OG.textDim }}>Current</div>
                <div style={{ display: 'flex', fontSize: '40px', fontWeight: 700, color }}>
                  {drep.drepScore}
                </div>
              </div>
            </div>
          )}

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
    console.error('[OG Score Change] Error:', error);
    return new ImageResponse(<OGFallback message="Score Update" />, { width: 1080, height: 1080 });
  }
}
