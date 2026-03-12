import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';

export const runtime = 'edge';

const BAND_COLORS: Record<string, string> = {
  strong: '#10b981',
  good: '#22c55e',
  fair: '#f59e0b',
  critical: '#f43f5e',
};

function bandColor(band: string): string {
  return BAND_COLORS[band.toLowerCase()] ?? BAND_COLORS.fair;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const score = Number(searchParams.get('score') || '0');
  const band = searchParams.get('band') || 'fair';
  const epoch = searchParams.get('epoch');
  const drep = searchParams.get('drep');
  const tier = searchParams.get('tier');
  const participation = searchParams.get('participation');
  const ada = searchParams.get('ada');

  const color = bandColor(band);
  const hasPersonalData = !!drep;

  const jsx = (
    <OGBackground glow={color}>
      {/* Radial glow behind the score */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: hasPersonalData ? '120px' : '80px',
          left: hasPersonalData ? '80px' : '350px',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}1a 0%, transparent 70%)`,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '48px 64px',
        }}
      >
        {/* Top-left: Brand */}
        <div
          style={{
            display: 'flex',
            fontSize: '16px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
            color: '#818cf8',
          }}
        >
          GOVERNADA
        </div>

        {/* Main content area */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            gap: '80px',
            marginTop: '16px',
          }}
        >
          {/* Left: GHI Score with ring */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '280px',
            }}
          >
            <ScoreRing score={score} color={color} />
            <div
              style={{
                display: 'flex',
                marginTop: '16px',
                padding: '6px 24px',
                borderRadius: '20px',
                backgroundColor: `${color}20`,
                border: `1px solid ${color}40`,
                fontSize: '20px',
                fontWeight: 600,
                color,
                textTransform: 'capitalize' as const,
              }}
            >
              {band}
            </div>
            {!hasPersonalData && (
              <div
                style={{
                  display: 'flex',
                  fontSize: '18px',
                  color: OG.textMuted,
                  marginTop: '12px',
                }}
              >
                Cardano Governance Health
              </div>
            )}
          </div>

          {/* Right: Personal data or nothing */}
          {hasPersonalData && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'center',
                gap: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase' as const,
                  color: OG.textMuted,
                }}
              >
                Your Governance
              </div>

              {/* DRep name + tier */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '36px',
                    fontWeight: 700,
                    color: OG.text,
                    lineHeight: 1.2,
                  }}
                >
                  {drep.length > 22 ? drep.slice(0, 20) + '...' : drep}
                </div>
                {tier && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        display: 'flex',
                        padding: '4px 14px',
                        borderRadius: '12px',
                        backgroundColor: `${OG.indigo}20`,
                        border: `1px solid ${OG.indigo}40`,
                        fontSize: '14px',
                        fontWeight: 500,
                        color: OG.indigo,
                      }}
                    >
                      {tier}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: '40px', marginTop: '8px' }}>
                {participation && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', fontSize: '14px', color: OG.textDim }}>
                      Participation
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: '28px',
                        fontWeight: 700,
                        color: OG.text,
                      }}
                    >
                      {participation}
                    </div>
                  </div>
                )}
                {ada && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', fontSize: '14px', color: OG.textDim }}>ADA</div>
                    <div
                      style={{
                        display: 'flex',
                        fontSize: '28px',
                        fontWeight: 700,
                        color: OG.text,
                      }}
                    >
                      {ada}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <OGFooter left={epoch ? `Epoch ${epoch}` : undefined} right="governada.io" />
      </div>
    </OGBackground>
  );

  return new ImageResponse(jsx, {
    width: 1200,
    height: 630,
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={OG.barBg}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        {/* Glow arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth * 2}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          opacity={0.15}
        />
      </svg>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: '72px',
            fontWeight: 700,
            color: OG.text,
            lineHeight: 1,
          }}
        >
          {score}
        </div>
      </div>
    </div>
  );
}
