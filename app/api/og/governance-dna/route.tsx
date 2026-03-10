import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const votesCount = request.nextUrl.searchParams.get('votes') || '0';
    const match1Name = request.nextUrl.searchParams.get('m1name') || '';
    const match1Score = request.nextUrl.searchParams.get('m1score') || '0';
    const match2Name = request.nextUrl.searchParams.get('m2name') || '';
    const match2Score = request.nextUrl.searchParams.get('m2score') || '0';
    const match3Name = request.nextUrl.searchParams.get('m3name') || '';
    const match3Score = request.nextUrl.searchParams.get('m3score') || '0';

    const matches = [
      { name: match1Name, score: parseInt(match1Score) },
      { name: match2Name, score: parseInt(match2Score) },
      { name: match3Name, score: parseInt(match3Score) },
    ].filter((m) => m.name && m.score > 0);

    return new ImageResponse(
      <OGBackground glow={OG.indigo}>
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
          {/* DNA icon representation */}
          <div
            style={{
              display: 'flex',
              fontSize: '64px',
              marginBottom: '16px',
            }}
          >
            🧬
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '40px',
              fontWeight: 700,
              color: OG.text,
              marginBottom: '8px',
            }}
          >
            My Governance DNA
          </div>

          <div
            style={{ display: 'flex', fontSize: '20px', color: OG.textMuted, marginBottom: '48px' }}
          >
            Based on {votesCount} governance decisions
          </div>

          {matches.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                width: '100%',
                maxWidth: '700px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '18px',
                  color: OG.textMuted,
                  marginBottom: '4px',
                }}
              >
                My top DRep matches:
              </div>
              {matches.map((m, i) => {
                const matchColor =
                  m.score >= 70 ? OG.green : m.score >= 50 ? OG.amber : OG.textMuted;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '20px 24px',
                      borderRadius: '12px',
                      backgroundColor: OG.bgCard,
                      border: `1px solid ${matchColor}30`,
                      gap: '16px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontSize: '24px',
                        fontWeight: 700,
                        color: i === 0 ? OG.amber : OG.textMuted,
                        width: '32px',
                      }}
                    >
                      #{i + 1}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flex: 1,
                        fontSize: '24px',
                        fontWeight: 600,
                        color: OG.text,
                      }}
                    >
                      {m.name.length > 20 ? m.name.slice(0, 18) + '…' : m.name}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        padding: '4px 16px',
                        borderRadius: '16px',
                        backgroundColor: `${matchColor}20`,
                        fontSize: '20px',
                        fontWeight: 700,
                        color: matchColor,
                      }}
                    >
                      {m.score}% match
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: '22px', color: OG.textMuted }}>
              Take the quiz at governada.io to find your matches
            </div>
          )}

          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              fontWeight: 600,
              color: OG.brand,
              marginTop: '40px',
            }}
          >
            Find your Governance DNA at governada.io
          </div>

          <OGFooter left="$governada" right="governada.io/governance" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
      },
    );
  } catch (error) {
    console.error('[OG Governance DNA] Error:', error);
    return new ImageResponse(<OGFallback message="Find your Governance DNA" />, {
      width: 1080,
      height: 1080,
    });
  }
}
