import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { OGBackground, OGScoreRing, OGFooter, OGFallback, OG, tierColor } from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const drepsParam = request.nextUrl.searchParams.get('dreps');
    if (!drepsParam) return fallback('No DReps specified');

    const drepIds = drepsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (drepIds.length < 2) return fallback('Need at least 2 DReps');

    const dreps = (await Promise.all(drepIds.map((id) => getDRepById(id)))).filter(Boolean);
    if (dreps.length < 2) return fallback('DRep(s) not found');

    const pillarKeys = [
      'effectiveParticipation',
      'rationaleRate',
      'reliabilityScore',
      'profileCompleteness',
    ] as const;
    const pillarLabels = ['Participation', 'Rationale', 'Reliability', 'Profile'];
    const drepColors = [OG.indigo, OG.amber, OG.green];

    return new ImageResponse(
      <OGBackground glow={OG.indigo}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              color: OG.text,
            }}
          >
            DRep Comparison
          </div>

          <div
            style={{
              display: 'flex',
              flex: 1,
              gap: '24px',
              alignItems: 'stretch',
              justifyContent: 'center',
            }}
          >
            {dreps.map((drep, i) => {
              if (!drep) return null;
              const name = getDRepPrimaryName(drep);
              const color = drepColors[i];
              return (
                <div
                  key={drep.drepId}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                    padding: '24px 20px',
                    borderRadius: '16px',
                    backgroundColor: OG.bgCard,
                    border: `1px solid ${color}30`,
                    justifyContent: 'center',
                  }}
                >
                  <OGScoreRing score={drep.drepScore} size={120} />
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '22px',
                      fontWeight: 600,
                      marginTop: '12px',
                      textAlign: 'center',
                      maxWidth: '280px',
                      lineHeight: 1.2,
                      color,
                    }}
                  >
                    {name.length > 18 ? name.slice(0, 16) + '…' : name}
                  </div>

                  {/* Pillar mini-bars */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '16px',
                      width: '100%',
                    }}
                  >
                    {pillarKeys.map((key, pi) => {
                      const val = drep[key] as number;
                      const barColor = val >= 80 ? OG.green : val >= 50 ? OG.amber : OG.red;
                      return (
                        <div
                          key={key}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              width: '80px',
                              fontSize: '11px',
                              color: OG.textMuted,
                            }}
                          >
                            {pillarLabels[pi]}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flex: 1,
                              height: '10px',
                              backgroundColor: OG.barBg,
                              borderRadius: '5px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                width: `${val}%`,
                                height: '100%',
                                backgroundColor: barColor,
                                borderRadius: '5px',
                              }}
                            />
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              width: '30px',
                              fontSize: '11px',
                              color: OG.text,
                              justifyContent: 'flex-end',
                              fontWeight: 600,
                            }}
                          >
                            {val}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <OGFooter />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG Compare] Error:', error);
    return fallback('Error generating image');
  }
}

function fallback(message: string) {
  return new ImageResponse(<OGFallback message={message} />, { width: 1200, height: 630 });
}
