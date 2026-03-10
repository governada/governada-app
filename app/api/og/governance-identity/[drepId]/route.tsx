import { ImageResponse } from 'next/og';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { OGBackground, OGFooter, OGFallback, shortenDRepId } from '@/lib/og-utils';
import {
  extractAlignments,
  getDominantDimension,
  getIdentityColor,
  getDimensionLabel,
  getDimensionOrder,
  alignmentsToArray,
  getPersonalityLabel,
} from '@/lib/drepIdentity';

export const runtime = 'edge';

function OGHexShape({
  scores,
  size,
  color,
}: {
  scores: number[];
  size: number;
  color: { hex: string; rgb: [number, number, number] };
}) {
  const center = size / 2;
  const maxR = size / 2 - 4;
  const minRadius = 0.25;

  const vertices = scores.map((score, i) => {
    const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
    const normalizedScore = score / 100;
    const radius = maxR * (minRadius + normalizedScore * (1 - minRadius));
    return [center + radius * Math.cos(angle), center + radius * Math.sin(angle)] as [
      number,
      number,
    ];
  });

  const points = vertices.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid rings */}
      {[0.25, 0.5, 0.75, 1].map((pct) => {
        const ringPts = Array.from({ length: 6 }, (_, i) => {
          const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
          const r = maxR * pct;
          return `${(center + r * Math.cos(angle)).toFixed(1)},${(center + r * Math.sin(angle)).toFixed(1)}`;
        }).join(' ');
        return (
          <polygon
            key={pct}
            points={ringPts}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={pct === 1 ? 1 : 0.5}
          />
        );
      })}

      {/* Axis lines */}
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + maxR * Math.cos(angle)}
            y2={center + maxR * Math.sin(angle)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Glow layer */}
      <polygon
        points={points}
        fill={`rgba(${color.rgb.join(',')}, 0.15)`}
        stroke={color.hex}
        strokeWidth={2}
        opacity={0.6}
      />

      {/* Main shape */}
      <polygon
        points={points}
        fill={`rgba(${color.rgb.join(',')}, 0.12)`}
        stroke={color.hex}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Vertex dots */}
      {vertices.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={color.hex} />
      ))}
    </svg>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ drepId: string }> }) {
  try {
    const { drepId } = await params;
    const drep = await getDRepById(decodeURIComponent(drepId));

    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      });
    }

    const name = getDRepPrimaryName(drep);
    const alignments = extractAlignments(drep);
    const scores = alignmentsToArray(alignments);
    const dominant = getDominantDimension(alignments);
    const color = getIdentityColor(dominant);
    const personality = getPersonalityLabel(alignments);
    const dimensions = getDimensionOrder();

    return new ImageResponse(
      <OGBackground glow={color.hex}>
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: '48px 64px' }}>
          {/* Left: Hex shape */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '320px',
              marginRight: '48px',
            }}
          >
            <OGHexShape scores={scores} size={260} color={color} />
            <div
              style={{
                display: 'flex',
                fontSize: '56px',
                fontWeight: 700,
                color: color.hex,
                marginTop: '-170px',
                textShadow: `0 0 20px ${color.hex}`,
              }}
            >
              {drep.drepScore ?? 0}
            </div>
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
                fontSize: '14px',
                color: color.hex,
                fontWeight: 600,
                letterSpacing: '2px',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              GOVERNANCE IDENTITY
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '36px',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '22px',
                color: '#94a3b8',
                marginTop: '4px',
              }}
            >
              {personality}
            </div>

            {/* Alignment dimension bars */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                marginTop: '28px',
              }}
            >
              {dimensions.map((dim, i) => {
                const dimColor = getIdentityColor(dim);
                const score = scores[i];
                return (
                  <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        display: 'flex',
                        width: '130px',
                        fontSize: '14px',
                        color: '#94a3b8',
                      }}
                    >
                      {getDimensionLabel(dim)}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        flex: 1,
                        height: '16px',
                        backgroundColor: '#1e293b',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          width: `${score}%`,
                          height: '100%',
                          backgroundColor: dimColor.hex,
                          borderRadius: '8px',
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        width: '40px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: dimColor.hex,
                        justifyContent: 'flex-end',
                      }}
                    >
                      {score}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <OGFooter left="$governada" right={shortenDRepId(drepId)} />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch {
    return new ImageResponse(<OGFallback message="Error generating image" />, {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  }
}
