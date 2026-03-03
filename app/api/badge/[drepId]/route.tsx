import { NextRequest, NextResponse } from 'next/server';
import { ImageResponse } from 'next/og';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { captureServerEvent } from '@/lib/posthog-server';

function getTierColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function getTierLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  return 'Low';
}

function buildShieldSvg(score: number, tier: string, color: string): string {
  const labelWidth = 90;
  const scoreWidth = 90;
  const totalWidth = labelWidth + scoreWidth;
  const height = 28;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <title>DRepScore ${score}/100 (${tier})</title>
  <rect width="${totalWidth}" height="${height}" rx="4" fill="#1e293b"/>
  <clipPath id="r"><rect width="${totalWidth}" height="${height}" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect x="${labelWidth}" width="${scoreWidth}" height="${height}" fill="${color}22"/>
  </g>
  <text x="8" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="#e2e8f0" font-weight="600">DRepScore</text>
  <text x="${labelWidth + 8}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="${color}" font-weight="700">${score}/100</text>
  <text x="${labelWidth + 56}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${color}cc">${tier}</text>
</svg>`;
}

function buildCardSvg(
  name: string,
  score: number,
  tier: string,
  color: string,
  topPillar: string,
  topPillarValue: number,
): string {
  const w = 300,
    h = 100;
  const displayName = name.length > 22 ? name.slice(0, 20) + '…' : name;
  const ringR = 28,
    cx = 44,
    cy = 50,
    sw = 5;
  const circ = 2 * Math.PI * ringR;
  const offset = circ * (1 - score / 100);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <title>${name} — DRepScore ${score}/100</title>
  <rect width="${w}" height="${h}" rx="8" fill="#0c1222"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="7" fill="none" stroke="${color}33" stroke-width="1"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#1e293b" stroke-width="${sw}"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
    stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="18" fill="${color}" font-weight="700">${score}</text>
  <text x="84" y="30" font-family="sans-serif" font-size="14" fill="#e2e8f0" font-weight="600">${displayName}</text>
  <text x="84" y="50" font-family="sans-serif" font-size="11" fill="#94a3b8">${tier} · ${topPillar}: ${topPillarValue}%</text>
  <text x="84" y="80" font-family="sans-serif" font-size="10" fill="#64748b">drepscore.io</text>
</svg>`;
}

function buildFullSvg(
  name: string,
  drepId: string,
  score: number,
  tier: string,
  color: string,
  pillars: { label: string; value: number }[],
): string {
  const w = 480,
    h = 200;
  const displayName = name.length > 28 ? name.slice(0, 26) + '…' : name;
  const shortId = drepId.length > 24 ? `${drepId.slice(0, 12)}...${drepId.slice(-8)}` : drepId;
  const ringR = 50,
    cx = 72,
    cy = 90,
    sw = 8;
  const circ = 2 * Math.PI * ringR;
  const offset = circ * (1 - score / 100);

  const pillarBars = pillars
    .map((p, i) => {
      const barY = 60 + i * 28;
      const barW = Math.max(2, (p.value / 100) * 180);
      const pColor = p.value >= 80 ? '#22c55e' : p.value >= 50 ? '#f59e0b' : '#ef4444';
      return `<text x="160" y="${barY}" font-family="sans-serif" font-size="11" fill="#94a3b8">${p.label}</text>
    <rect x="260" y="${barY - 10}" width="180" height="14" rx="7" fill="#1e293b"/>
    <rect x="260" y="${barY - 10}" width="${barW}" height="14" rx="7" fill="${pColor}"/>
    <text x="448" y="${barY}" font-family="sans-serif" font-size="10" fill="#e2e8f0" text-anchor="end">${p.value}%</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <title>${name} — DRepScore ${score}/100</title>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0c1222"/>
      <stop offset="100%" stop-color="#162033"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="12" fill="url(#bg)"/>
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="11" fill="none" stroke="${color}22" stroke-width="1"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#1e293b" stroke-width="${sw}"/>
  <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"
    stroke-dasharray="${circ}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"/>
  <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="28" fill="${color}" font-weight="700">${score}</text>
  <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#94a3b8">${tier}</text>
  <text x="160" y="28" font-family="sans-serif" font-size="16" fill="#e2e8f0" font-weight="700">${displayName}</text>
  <text x="160" y="44" font-family="monospace" font-size="9" fill="#64748b">${shortId}</text>
  ${pillarBars}
  <text x="8" y="${h - 10}" font-family="sans-serif" font-size="11" fill="#475569" font-weight="600">DRepScore</text>
  <text x="${w - 8}" y="${h - 10}" text-anchor="end" font-family="sans-serif" font-size="9" fill="#475569">drepscore.io</text>
</svg>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;
  const format = (request.nextUrl.searchParams.get('format') || 'shield') as
    | 'shield'
    | 'card'
    | 'full';
  const outputType = request.nextUrl.searchParams.get('type') || 'svg';

  const drep = await getDRepById(decodeURIComponent(drepId));

  if (!drep) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28">
      <rect width="180" height="28" rx="4" fill="#1e293b"/>
      <text x="90" y="18" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#94a3b8">DRep Not Found</text>
    </svg>`;
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const referer = request.headers.get('referer') || 'direct';
  captureServerEvent('badge_rendered', { drep_id: drepId, format, referer }, `badge:${drepId}`);

  const name = getDRepPrimaryName(drep);
  const score = drep.drepScore;
  const color = getTierColor(score);
  const tier = getTierLabel(score);

  const pillars = [
    { label: 'Participation', value: drep.effectiveParticipation },
    { label: 'Rationale', value: drep.rationaleRate },
    { label: 'Reliability', value: drep.reliabilityScore },
    { label: 'Profile', value: drep.profileCompleteness },
  ];
  const topPillar = pillars.reduce((best, p) => (p.value > best.value ? p : best), pillars[0]);

  let svg: string;
  if (format === 'card') {
    svg = buildCardSvg(name, score, tier, color, topPillar.label, topPillar.value);
  } else if (format === 'full') {
    svg = buildFullSvg(name, drep.drepId, score, tier, color, pillars);
  } else {
    svg = buildShieldSvg(score, tier, color);
  }

  if (outputType === 'png') {
    const sizes: Record<string, { width: number; height: number }> = {
      shield: { width: 360, height: 56 },
      card: { width: 600, height: 200 },
      full: { width: 960, height: 400 },
    };
    const { width, height } = sizes[format] || sizes.shield;
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
          alt=""
          style={{ width: '100%', height: '100%' }}
        />
      </div>,
      {
        width,
        height,
        headers: { 'Cache-Control': 'public, max-age=900, s-maxage=900' },
      },
    );
  }

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
}
