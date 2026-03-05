import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ drepId: string }> }) {
  const { drepId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: drep } = await supabase
    .from('dreps')
    .select('id, score, participation_rate, metadata, delegator_count')
    .eq('id', drepId)
    .single();

  if (!drep) {
    return new NextResponse(
      '<html><body style="background:#0c1222;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>DRep not found</p></body></html>',
      { headers: { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' } },
    );
  }

  const meta = drep.metadata as Record<string, unknown> | null;
  const givenName = meta?.givenName as { value?: string } | undefined;
  const rawName = (givenName?.value ?? meta?.name ?? drepId.slice(0, 12) + '...') as string;
  const score = drep.score ?? 0;

  const color =
    score >= 95
      ? '#8b5cf6'
      : score >= 85
        ? '#22d3ee'
        : score >= 70
          ? '#fbbf24'
          : score >= 55
            ? '#94a3b8'
            : score >= 40
              ? '#f59e0b'
              : '#64748b';

  const tier =
    score >= 95
      ? 'Legendary'
      : score >= 85
        ? 'Diamond'
        : score >= 70
          ? 'Gold'
          : score >= 55
            ? 'Silver'
            : score >= 40
              ? 'Bronze'
              : 'Emerging';

  const name = rawName.length > 24 ? rawName.slice(0, 22) + '\u2026' : rawName;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0c1222; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #1e293b; border: 1px solid ${color}30; border-radius: 12px; padding: 20px; max-width: 320px; width: 100%; }
    .score { font-size: 48px; font-weight: 800; color: ${color}; line-height: 1; }
    .name { font-size: 16px; font-weight: 600; margin-top: 8px; }
    .tier { display: inline-block; background: ${color}20; color: ${color}; border: 1px solid ${color}40; border-radius: 16px; padding: 2px 10px; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .stats { display: flex; gap: 16px; margin-top: 16px; padding-top: 16px; border-top: 1px solid #334155; }
    .stat-label { font-size: 11px; color: #64748b; }
    .stat-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .cta { display: block; text-align: center; color: #6366f1; font-size: 12px; margin-top: 16px; text-decoration: none; }
    .bar-bg { background: #334155; border-radius: 4px; height: 4px; margin-top: 6px; }
    .bar { background: ${color}; border-radius: 4px; height: 4px; width: ${score}%; }
  </style>
</head>
<body>
  <div class="card">
    <div class="score">${score}</div>
    <div class="bar-bg"><div class="bar"></div></div>
    <div class="name">${name}</div>
    <div class="tier">${tier}</div>
    <div class="stats">
      <div>
        <div class="stat-label">Participation</div>
        <div class="stat-value">${Math.round((drep.participation_rate ?? 0) * 100)}%</div>
      </div>
      <div>
        <div class="stat-label">Delegators</div>
        <div class="stat-value">${(drep.delegator_count ?? 0).toLocaleString()}</div>
      </div>
    </div>
    <a href="https://drepscore.app/drep/${encodeURIComponent(drepId)}" target="_blank" class="cta">View full profile on DRepScore \u2197</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
