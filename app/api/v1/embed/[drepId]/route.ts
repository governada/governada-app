import { NextRequest, NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess, apiError } from '@/lib/api/response';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import type { ApiContext } from '@/lib/api/handler';

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

const SHELLEY_GENESIS = 1596491091;
const EPOCH_LEN = 432000;
const SHELLEY_BASE = 209;

function getCurrentEpoch(): number {
  return Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
}

function renderBadgeSvg(name: string, score: number, theme: 'dark' | 'light'): string {
  const color = getTierColor(score);
  const tier = getTierLabel(score);
  const displayName = name.length > 20 ? name.slice(0, 18) + '\u2026' : name;
  const bg = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';

  const labelWidth = 90;
  const scoreWidth = 90;
  const totalWidth = labelWidth + scoreWidth;
  const height = 28;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <title>${name} — DRepScore ${score}/100 (${tier})</title>
  <rect width="${totalWidth}" height="${height}" rx="4" fill="${bg}"/>
  <clipPath id="r"><rect width="${totalWidth}" height="${height}" rx="4"/></clipPath>
  <g clip-path="url(#r)">
    <rect x="${labelWidth}" width="${scoreWidth}" height="${height}" fill="${color}22"/>
  </g>
  <text x="8" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="${textColor}" font-weight="600">DRepScore</text>
  <text x="${labelWidth + 8}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="${color}" font-weight="700">${score}/100</text>
  <text x="${labelWidth + 56}" y="18" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${color}cc">${tier}</text>
</svg>`;
}

function renderCardSvg(name: string, score: number, drep: any, theme: 'dark' | 'light'): string {
  const color = getTierColor(score);
  const tier = getTierLabel(score);
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const mutedColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const borderColor = theme === 'dark' ? '#1e293b' : '#e2e8f0';
  const displayName = name.length > 30 ? name.slice(0, 28) + '\u2026' : name;

  const w = 320;
  const h = 140;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <title>${name} — DRepScore ${score}/100 (${tier})</title>
  <rect width="${w}" height="${h}" rx="8" fill="${bg}" stroke="${borderColor}" stroke-width="1"/>
  <text x="16" y="28" font-family="Verdana,Geneva,sans-serif" font-size="14" fill="${textColor}" font-weight="700">${displayName}</text>
  <text x="16" y="50" font-family="Verdana,Geneva,sans-serif" font-size="11" fill="${mutedColor}">DRepScore</text>
  <text x="16" y="75" font-family="Verdana,Geneva,sans-serif" font-size="28" fill="${color}" font-weight="700">${score}</text>
  <text x="58" y="75" font-family="Verdana,Geneva,sans-serif" font-size="14" fill="${mutedColor}">/100</text>
  <text x="105" y="75" font-family="Verdana,Geneva,sans-serif" font-size="12" fill="${color}">${tier}</text>
  <line x1="16" y1="90" x2="${w - 16}" y2="90" stroke="${borderColor}" stroke-width="1"/>
  <text x="16" y="108" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${mutedColor}">Participation ${Math.round(drep.effectiveParticipation * 100)}%</text>
  <text x="120" y="108" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${mutedColor}">Rationale ${Math.round(drep.rationaleRate * 100)}%</text>
  <text x="215" y="108" font-family="Verdana,Geneva,sans-serif" font-size="9" fill="${mutedColor}">Reliability ${Math.round(drep.reliabilityScore * 100)}%</text>
  <text x="16" y="128" font-family="Verdana,Geneva,sans-serif" font-size="8" fill="${mutedColor}">drepscore.io</text>
</svg>`;
}

function renderMinimalSvg(score: number, theme: 'dark' | 'light'): string {
  const color = getTierColor(score);
  const bg = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="28">
  <title>DRepScore ${score}/100</title>
  <rect width="52" height="28" rx="4" fill="${bg}"/>
  <text x="26" y="18" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="12" fill="${color}" font-weight="700">${score}</text>
</svg>`;
}

function renderHtmlCard(name: string, score: number, drep: any, theme: 'dark' | 'light'): string {
  const color = getTierColor(score);
  const tier = getTierLabel(score);
  const isDark = theme === 'dark';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;background:transparent}
.card{background:${isDark ? '#0f172a' : '#fff'};border:1px solid ${isDark ? '#1e293b' : '#e2e8f0'};border-radius:8px;padding:16px;max-width:320px;color:${isDark ? '#e2e8f0' : '#1e293b'}}
.name{font-size:14px;font-weight:700;margin-bottom:4px}
.label{font-size:11px;color:${isDark ? '#94a3b8' : '#64748b'}}
.score{font-size:28px;font-weight:700;color:${color}}
.score span{font-size:14px;color:${isDark ? '#94a3b8' : '#64748b'}}
.tier{font-size:12px;color:${color};margin-left:8px}
.stats{display:flex;gap:16px;margin-top:8px;padding-top:8px;border-top:1px solid ${isDark ? '#1e293b' : '#e2e8f0'};font-size:9px;color:${isDark ? '#94a3b8' : '#64748b'}}
.foot{margin-top:8px;font-size:8px;color:${isDark ? '#64748b' : '#94a3b8'}}
a{color:inherit;text-decoration:none}
</style></head><body>
<div class="card">
<div class="name">${name.length > 30 ? name.slice(0, 28) + '&hellip;' : name}</div>
<div class="label">DRepScore</div>
<div><span class="score">${score}<span>/100</span></span><span class="tier">${tier}</span></div>
<div class="stats">
<span>Participation ${Math.round(drep.effectiveParticipation * 100)}%</span>
<span>Rationale ${Math.round(drep.rationaleRate * 100)}%</span>
<span>Reliability ${Math.round(drep.reliabilityScore * 100)}%</span>
</div>
<div class="foot"><a href="https://drepscore.io/drep/${encodeURIComponent(drep.drepId)}" target="_blank">drepscore.io</a></div>
</div></body></html>`;
}

async function handler(request: NextRequest, ctx: ApiContext, params?: Record<string, string>) {
  const drepId = decodeURIComponent(params?.drepId || '');
  if (!drepId) {
    return apiError(
      'missing_parameter',
      { param: 'drepId', context: 'DRep ID is required in the URL path.' },
      { requestId: ctx.requestId },
    );
  }

  const drep = await getDRepById(drepId);
  if (!drep) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28">
      <rect width="180" height="28" rx="4" fill="#1e293b"/>
      <text x="90" y="18" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#94a3b8">DRep Not Found</text>
    </svg>`;
    return new NextResponse(svg, {
      status: 404,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=300' },
    });
  }

  const url = request.nextUrl;
  const format = url.searchParams.get('format') || 'svg';
  const style = url.searchParams.get('style') || 'badge';
  const theme = (url.searchParams.get('theme') || 'dark') as 'dark' | 'light';
  const name = getDRepPrimaryName(drep);
  const score = drep.drepScore;

  // JSON format — NFT-ready metadata
  if (format === 'json') {
    const metadata = {
      drep_id: drep.drepId,
      name,
      score,
      tier: getTierLabel(score),
      components: {
        rationale_quality: drep.rationaleRate,
        effective_participation: drep.effectiveParticipation,
        reliability: drep.reliabilityScore,
        profile_completeness: drep.profileCompleteness,
      },
      alignment: {
        treasury_conservative: drep.alignmentTreasuryConservative,
        treasury_growth: drep.alignmentTreasuryGrowth,
        decentralization: drep.alignmentDecentralization,
        security: drep.alignmentSecurity,
        innovation: drep.alignmentInnovation,
        transparency: drep.alignmentTransparency,
      },
      snapshot_epoch: getCurrentEpoch(),
      snapshot_date: new Date().toISOString().split('T')[0],
      schema_version: 1,
      image_url: `https://drepscore.io/api/v1/embed/${encodeURIComponent(drep.drepId)}?format=svg&style=${style}&theme=${theme}`,
    };

    return apiSuccess(metadata, {
      requestId: ctx.requestId,
      dataCachedAt: drep.updatedAt ? new Date(drep.updatedAt) : undefined,
      cacheSeconds: 900,
    });
  }

  // HTML format — iframe-embeddable card
  if (format === 'html') {
    const html = renderHtmlCard(name, score, drep, theme);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'X-Request-Id': ctx.requestId,
      },
    });
  }

  // SVG format (default)
  let svg: string;
  if (style === 'card') {
    svg = renderCardSvg(name, score, drep, theme);
  } else if (style === 'minimal') {
    svg = renderMinimalSvg(score, theme);
  } else {
    svg = renderBadgeSvg(name, score, theme);
  }

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
      'X-Request-Id': ctx.requestId,
    },
  });
}

export const GET = withApiHandler(handler, { skipRateLimit: true });
export const dynamic = 'force-dynamic';
