import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';
import type { AlignmentScores } from '@/lib/drepIdentity';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/* ── Types ──────────────────────────────────────────────────────── */

interface PassportOGData {
  stage: number;
  alignment?: AlignmentScores;
  matchedDrepName?: string;
  matchScore?: number;
}

/* ── Alignment dimension config ─────────────────────────────────── */

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

/* ── SVG radar helpers ──────────────────────────────────────────── */

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

/* ── Parse query params ─────────────────────────────────────────── */

function parseParams(request: NextRequest): PassportOGData | null {
  const params = request.nextUrl.searchParams;

  // Try encoded passport first (compact)
  const encoded = params.get('data');
  if (encoded) {
    try {
      const json = atob(encoded);
      const data = JSON.parse(json) as PassportOGData;
      if (data.stage) return data;
    } catch {
      // Fall through to individual params
    }
  }

  // Individual params
  const stage = parseInt(params.get('stage') ?? '0', 10);
  if (stage < 1 || stage > 5) return null;

  const result: PassportOGData = { stage };

  const matchedDrepName = params.get('drep');
  if (matchedDrepName) result.matchedDrepName = matchedDrepName;

  const matchScore = parseInt(params.get('score') ?? '', 10);
  if (!isNaN(matchScore)) result.matchScore = matchScore;

  // Parse alignment from individual dimension params
  const tc = parseFloat(params.get('tc') ?? '');
  const tg = parseFloat(params.get('tg') ?? '');
  const de = parseFloat(params.get('de') ?? '');
  const se = parseFloat(params.get('se') ?? '');
  const inn = parseFloat(params.get('in') ?? '');
  const tr = parseFloat(params.get('tr') ?? '');

  if (!isNaN(tc) || !isNaN(tg) || !isNaN(de) || !isNaN(se) || !isNaN(inn) || !isNaN(tr)) {
    result.alignment = {
      treasuryConservative: isNaN(tc) ? null : tc,
      treasuryGrowth: isNaN(tg) ? null : tg,
      decentralization: isNaN(de) ? null : de,
      security: isNaN(se) ? null : se,
      innovation: isNaN(inn) ? null : inn,
      transparency: isNaN(tr) ? null : tr,
    };
  }

  return result;
}

/* ── Stage indicator ────────────────────────────────────────────── */

function StageIndicator({ stage }: { stage: number }) {
  const stages = [
    { num: 1, label: 'Discover' },
    { num: 2, label: 'Prepare' },
    { num: 3, label: 'Connect' },
    { num: 4, label: 'Delegate' },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {stages.map(({ num, label }) => {
        const isComplete = stage > num || stage === 5;
        const isCurrent = stage === num;
        return (
          <div key={num} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                fontSize: '14px',
                fontWeight: 700,
                backgroundColor: isComplete
                  ? 'rgba(16, 185, 129, 0.2)'
                  : isCurrent
                    ? 'rgba(99, 102, 241, 0.2)'
                    : 'rgba(255,255,255,0.05)',
                color: isComplete ? '#10b981' : isCurrent ? '#6366f1' : '#475569',
                border: `1px solid ${
                  isComplete
                    ? 'rgba(16, 185, 129, 0.3)'
                    : isCurrent
                      ? 'rgba(99, 102, 241, 0.4)'
                      : 'rgba(255,255,255,0.08)'
                }`,
              }}
            >
              {isComplete ? '\u2713' : num}
            </div>
            <span
              style={{
                fontSize: '12px',
                color: isComplete ? '#10b981' : isCurrent ? '#6366f1' : '#475569',
                marginRight: '8px',
              }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Route handler ──────────────────────────────────────────────── */

export async function GET(request: NextRequest) {
  try {
    const data = parseParams(request);

    if (!data) {
      return new ImageResponse(<OGFallback message="Start your governance journey" />, {
        width: 1200,
        height: 630,
      });
    }

    const hasAlignment = data.alignment != null;
    const accentColor = hasAlignment ? getDominantColor(data.alignment!) : OG.brand;
    const isComplete = data.stage === 5;

    const cx = 180;
    const cy = 180;
    const maxR = 140;

    return new ImageResponse(
      <OGBackground glow={accentColor}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
          }}
        >
          {/* Top bar: passport header + stage progress */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '32px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: isComplete
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(99, 102, 241, 0.15)',
                  border: `1px solid ${isComplete ? 'rgba(16, 185, 129, 0.3)' : 'rgba(99, 102, 241, 0.3)'}`,
                }}
              >
                <span style={{ fontSize: '18px' }}>{isComplete ? '\u2713' : '\u229B'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: OG.text,
                  }}
                >
                  {isComplete ? 'Active Governance Citizen' : 'Governance Passport'}
                </span>
              </div>
            </div>
            <StageIndicator stage={data.stage} />
          </div>

          {/* Main content */}
          <div style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
            {/* Left: Radar chart (if alignment exists) */}
            {hasAlignment && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '380px',
                  marginRight: '48px',
                }}
              >
                <svg width="360" height="360" viewBox="0 0 360 360">
                  {/* Grid rings */}
                  {[0.25, 0.5, 0.75, 1.0].map((scale) => (
                    <polygon
                      key={scale}
                      points={getGridPoints(cx, cy, maxR, scale)}
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
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
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="1"
                      />
                    );
                  })}
                  {/* Data polygon glow */}
                  <polygon
                    points={getRadarPoints(data.alignment!, cx, cy, maxR)}
                    fill={`${accentColor}10`}
                    stroke={accentColor}
                    strokeWidth="3"
                    opacity="0.3"
                  />
                  {/* Data polygon */}
                  <polygon
                    points={getRadarPoints(data.alignment!, cx, cy, maxR)}
                    fill={`${accentColor}20`}
                    stroke={accentColor}
                    strokeWidth="2"
                  />
                  {/* Data points */}
                  {DIMENSION_ORDER.map((dim, i) => {
                    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                    const score = (data.alignment![dim] ?? 50) / 100;
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
                    const labelR = maxR + 24;
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
                        fontSize="12"
                        fontFamily="sans-serif"
                      >
                        {DIMENSION_LABELS[dim]}
                      </text>
                    );
                  })}
                </svg>
              </div>
            )}

            {/* Right: Identity details */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                justifyContent: 'center',
                gap: '20px',
              }}
            >
              {/* Match info */}
              {data.matchedDrepName && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: accentColor,
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                    }}
                  >
                    Top Match
                  </span>
                  <span
                    style={{
                      fontSize: '36px',
                      fontWeight: 700,
                      color: OG.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {data.matchedDrepName}
                  </span>
                  {data.matchScore != null && (
                    <span
                      style={{
                        fontSize: '20px',
                        color: OG.textMuted,
                      }}
                    >
                      {data.matchScore}% alignment match
                    </span>
                  )}
                </div>
              )}

              {/* No match info — show generic text */}
              {!data.matchedDrepName && !hasAlignment && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '40px',
                      fontWeight: 700,
                      color: OG.text,
                      lineHeight: 1.2,
                    }}
                  >
                    {isComplete
                      ? 'My voice is active in Cardano governance'
                      : 'Building my governance identity'}
                  </span>
                  <span style={{ fontSize: '20px', color: OG.textMuted }}>
                    {isComplete
                      ? 'Join me in shaping the future of Cardano'
                      : 'Discover your governance values'}
                  </span>
                </div>
              )}

              {/* Dimension pills (if alignment exists but no match name shown) */}
              {hasAlignment && !data.matchedDrepName && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {DIMENSION_ORDER.map((dim) => {
                    const score = data.alignment![dim] ?? 50;
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
                        <span style={{ fontSize: '13px', color: OG.textMuted }}>
                          {DIMENSION_LABELS[dim]}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: OG.text,
                          }}
                        >
                          {score}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <OGFooter left="Governance Passport" right="governada.io/get-started" />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch (error) {
    console.error('[OG] Passport image error:', error);
    return new ImageResponse(<OGFallback message="Start your governance journey" />, {
      width: 1200,
      height: 630,
    });
  }
}
