import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';
import type { AlignmentScores } from '@/lib/drepIdentity';

export const runtime = 'edge';

interface ShareableProfile {
  personality: string;
  dimensions: AlignmentScores;
  narrative: string;
}

const DIMENSION_ORDER: (keyof AlignmentScores)[] = [
  'treasuryConservative',
  'treasuryGrowth',
  'decentralization',
  'security',
  'innovation',
  'transparency',
];

const DIMENSION_LABELS: Record<keyof AlignmentScores, string> = {
  treasuryConservative: 'Conservative',
  treasuryGrowth: 'Growth',
  decentralization: 'Decentral.',
  security: 'Security',
  innovation: 'Innovation',
  transparency: 'Transparency',
};

const DIMENSION_COLORS: Record<keyof AlignmentScores, string> = {
  treasuryConservative: '#dc2626',
  treasuryGrowth: '#10b981',
  decentralization: '#a855f7',
  security: '#f59e0b',
  innovation: '#06b6d4',
  transparency: '#3b82f6',
};

function parseProfile(encoded: string | null): ShareableProfile | null {
  if (!encoded) return null;
  try {
    const json = atob(encoded);
    const data = JSON.parse(json);
    if (!data.personality || !data.dimensions) return null;
    return data as ShareableProfile;
  } catch {
    return null;
  }
}

function getRadarPoints(dimensions: AlignmentScores, cx: number, cy: number, maxR: number): string {
  return DIMENSION_ORDER.map((dim, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const score = (dimensions[dim] ?? 50) / 100;
    const r = maxR * score;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

function getGridPoints(cx: number, cy: number, maxR: number, scale: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const r = maxR * scale;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

function getDominantColor(dimensions: AlignmentScores): string {
  let bestDim: keyof AlignmentScores = 'transparency';
  let bestDistance = -1;
  for (const dim of DIMENSION_ORDER) {
    const val = dimensions[dim] ?? 50;
    const distance = Math.abs(val - 50);
    if (distance > bestDistance) {
      bestDistance = distance;
      bestDim = dim;
    }
  }
  return DIMENSION_COLORS[bestDim];
}

export async function GET(request: NextRequest) {
  try {
    const profile = parseProfile(request.nextUrl.searchParams.get('profile'));

    if (!profile) {
      return new ImageResponse(<OGFallback message="Find your governance match" />, {
        width: 1200,
        height: 630,
      });
    }

    const accentColor = getDominantColor(profile.dimensions);
    const cx = 200;
    const cy = 200;
    const maxR = 160;

    return new ImageResponse(
      <OGBackground glow={accentColor}>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
          }}
        >
          {/* Left: Radar */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '420px',
              marginRight: '48px',
            }}
          >
            <svg width="400" height="400" viewBox="0 0 400 400">
              {/* Grid rings */}
              {[0.25, 0.5, 0.75, 1.0].map((scale) => (
                <polygon
                  key={scale}
                  points={getGridPoints(cx, cy, maxR, scale)}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                />
              ))}
              {/* Axis lines */}
              {DIMENSION_ORDER.map((_, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const ex = cx + maxR * Math.cos(angle);
                const ey = cy + maxR * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1={cx}
                    y1={cy}
                    x2={ex}
                    y2={ey}
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="1"
                  />
                );
              })}
              {/* Data polygon glow */}
              <polygon
                points={getRadarPoints(profile.dimensions, cx, cy, maxR)}
                fill={`${accentColor}10`}
                stroke={accentColor}
                strokeWidth="3"
                opacity="0.3"
              />
              {/* Data polygon */}
              <polygon
                points={getRadarPoints(profile.dimensions, cx, cy, maxR)}
                fill={`${accentColor}25`}
                stroke={accentColor}
                strokeWidth="2.5"
              />
              {/* Data points */}
              {DIMENSION_ORDER.map((dim, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const score = (profile.dimensions[dim] ?? 50) / 100;
                const r = maxR * score;
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);
                return (
                  <circle
                    key={dim}
                    cx={px}
                    cy={py}
                    r="4"
                    fill={accentColor}
                    stroke="#0c1222"
                    strokeWidth="2"
                  />
                );
              })}
              {/* Axis labels */}
              {DIMENSION_ORDER.map((dim, i) => {
                const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                const labelR = maxR + 28;
                const lx = cx + labelR * Math.cos(angle);
                const ly = cy + labelR * Math.sin(angle);
                const cosA = Math.cos(angle);
                const anchor: 'start' | 'middle' | 'end' =
                  cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
                return (
                  <text
                    key={dim}
                    x={lx}
                    y={ly + 5}
                    textAnchor={anchor}
                    fill="#94a3b8"
                    fontSize="13"
                    fontFamily="sans-serif"
                  >
                    {DIMENSION_LABELS[dim]}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Right: Identity info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '16px',
                fontWeight: 600,
                color: accentColor,
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '12px',
              }}
            >
              Governance Identity
            </div>

            <div
              style={{
                display: 'flex',
                fontSize: '48px',
                fontWeight: 700,
                color: OG.text,
                lineHeight: 1.1,
                marginBottom: '20px',
              }}
            >
              {profile.personality}
            </div>

            {profile.narrative && (
              <div
                style={{
                  display: 'flex',
                  fontSize: '20px',
                  color: OG.textMuted,
                  lineHeight: 1.5,
                  marginBottom: '32px',
                  maxWidth: '460px',
                }}
              >
                {profile.narrative.length > 160
                  ? profile.narrative.slice(0, 157) + '...'
                  : profile.narrative}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              {DIMENSION_ORDER.map((dim) => {
                const score = profile.dimensions[dim] ?? 50;
                return (
                  <div
                    key={dim}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: DIMENSION_COLORS[dim],
                      }}
                    />
                    <span style={{ fontSize: '14px', color: OG.textMuted }}>
                      {DIMENSION_LABELS[dim]}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: OG.text }}>
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <OGFooter left="Find your match" right="governada.io/match" />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
      },
    );
  } catch (error) {
    console.error('[OG] Match image error:', error);
    return new ImageResponse(<OGFallback message="Find your governance match" />, {
      width: 1200,
      height: 630,
    });
  }
}
