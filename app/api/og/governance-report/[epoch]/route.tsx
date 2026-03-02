import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase';
import { GHI_BAND_COLORS, GHI_BAND_LABELS, type GHIBand } from '@/lib/ghi';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';
import type { ReportData } from '@/lib/stateOfGovernance';

export const runtime = 'edge';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ epoch: string }> },
) {
  try {
    const { epoch: epochStr } = await params;
    const epochNo = parseInt(epochStr, 10);
    if (isNaN(epochNo)) {
      return new ImageResponse(
        <OGBackground><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><div style={{ display: 'flex', fontSize: '36px', color: OG.textMuted }}>Report not found</div></div></OGBackground>,
        { width: 1200, height: 630 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: report } = await supabase
      .from('state_of_governance_reports')
      .select('report_data')
      .eq('epoch_no', epochNo)
      .single();

    if (!report) {
      return new ImageResponse(
        <OGBackground><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><div style={{ display: 'flex', fontSize: '36px', color: OG.textMuted }}>Report not found</div></div></OGBackground>,
        { width: 1200, height: 630 },
      );
    }

    const data = report.report_data as unknown as ReportData;
    const color = GHI_BAND_COLORS[(data.ghi.band as GHIBand) ?? 'good'];
    const bandLabel = GHI_BAND_LABELS[(data.ghi.band as GHIBand) ?? 'good'];
    const ghiDelta = data.ghiPrevScore != null ? Math.round((data.ghi.score - data.ghiPrevScore) * 10) / 10 : null;

    return new ImageResponse(
      (
        <OGBackground glow={color}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: '64px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
              <div style={{ display: 'flex', fontSize: '20px', color: OG.textMuted, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>
                State of Governance
              </div>
              <div style={{ display: 'flex', fontSize: '44px', fontWeight: 700, color: OG.text, marginTop: '4px' }}>
                Epoch {epochNo}
              </div>
              <div style={{ display: 'flex', fontSize: '18px', color: OG.textDim, marginTop: '4px' }}>
                {data.dateRange.start} — {data.dateRange.end}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '48px', flex: 1, alignItems: 'center' }}>
              {/* GHI Score */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', fontSize: '120px', fontWeight: 700, color, lineHeight: 1 }}>
                  {data.ghi.score}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', fontSize: '22px', fontWeight: 600, color, padding: '4px 16px', borderRadius: '20px', backgroundColor: `${color}20` }}>
                    {bandLabel}
                  </div>
                  {ghiDelta != null && ghiDelta !== 0 && (
                    <div style={{ display: 'flex', fontSize: '20px', color: ghiDelta > 0 ? OG.green : OG.red }}>
                      {ghiDelta > 0 ? '+' : ''}{ghiDelta}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                {[
                  { label: 'Active DReps', value: `${data.stats.activeDReps}`, accent: OG.blue },
                  { label: 'Votes This Epoch', value: `${data.stats.totalVotes}`, accent: OG.indigo },
                  { label: 'ADA Governed', value: data.stats.totalAdaGoverned, accent: OG.green },
                  { label: 'Avg Participation', value: `${data.stats.avgParticipation}%`, accent: OG.amber },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', width: '180px', fontSize: '18px', color: OG.textMuted }}>{s.label}</div>
                    <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: s.accent }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <OGFooter left="$drepscore" right={`drepscore.io/pulse/report/${epochNo}`} />
          </div>
        </OGBackground>
      ),
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' },
      },
    );
  } catch (error) {
    console.error('[OG Report] Error:', error);
    return new ImageResponse(
      <OGBackground><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><div style={{ display: 'flex', fontSize: '48px', fontWeight: 700, color: OG.brand }}>State of Governance</div></div></OGBackground>,
      { width: 1200, height: 630 },
    );
  }
}
