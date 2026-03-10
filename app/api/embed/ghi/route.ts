import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: snapshots } = await supabase
    .from('ghi_snapshots')
    .select('epoch_no, ghi_score, components')
    .order('epoch_no', { ascending: false })
    .limit(12);

  const latest = snapshots?.[0];
  const score = latest?.ghi_score ?? 0;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  const values = (snapshots ?? []).reverse().map((s) => s.ghi_score ?? 0);
  const maxV = Math.max(...values, 1);
  const sparkPath =
    values.length > 1
      ? values
          .map((v, i) => {
            const x = (i / (values.length - 1)) * 100;
            const y = 30 - (v / maxV) * 28;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          })
          .join(' ')
      : 'M 0 15 L 100 15';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0c1222; color: #e2e8f0; font-family: -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    .card { background: #1e293b; border-radius: 12px; padding: 20px; max-width: 280px; width: 100%; }
    .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .score { font-size: 48px; font-weight: 800; color: ${color}; line-height: 1; margin: 8px 0; }
    .cta { display: block; text-align: center; color: #6366f1; font-size: 12px; margin-top: 16px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="label">Governance Health Index</div>
    <div class="score">${Math.round(score)}</div>
    <svg viewBox="0 0 100 30" style="width:100%;height:30px;overflow:visible">
      <path d="${sparkPath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <div style="color:#64748b;font-size:11px;margin-top:4px">Last 12 epochs</div>
    <a href="https://governada.io/governance/health" target="_blank" class="cta">View on Governada \u2197</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    },
  });
}
