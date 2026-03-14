import { ImageResponse } from 'next/og';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();

    // Get latest inter-body alignment data
    const { data: alignments } = await supabase
      .from('inter_body_alignment')
      .select('alignment_score, proposal_tx_hash')
      .order('created_at', { ascending: false })
      .limit(100);

    // Get current epoch from latest GHI snapshot
    const { data: ghiSnapshot } = await supabase
      .from('ghi_snapshots')
      .select('epoch_no')
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentEpoch = ghiSnapshot?.epoch_no ?? null;

    // Compute average alignment across recent proposals
    let avgAlignment = 0;
    if (alignments && alignments.length > 0) {
      const total = alignments.reduce((sum, a) => sum + (Number(a.alignment_score) || 0), 0);
      avgAlignment = Math.round(total / alignments.length);
    }

    const agreementPct = Math.min(100, Math.max(0, avgAlignment));
    const disagreementPct = 100 - agreementPct;

    // Color based on agreement level
    const barColor = agreementPct >= 70 ? OG.green : agreementPct >= 40 ? OG.amber : OG.red;
    const statusLabel =
      agreementPct >= 70
        ? 'Strong Alignment'
        : agreementPct >= 40
          ? 'Moderate Divergence'
          : 'Significant Divergence';

    return new ImageResponse(
      <OGBackground glow={barColor}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
            justifyContent: 'center',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px' }}>
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                color: OG.textMuted,
                fontWeight: 500,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                marginBottom: '8px',
              }}
            >
              {currentEpoch ? `Epoch ${currentEpoch}` : 'Current Epoch'} \u2014 Inter-Body Alignment
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: '42px',
                fontWeight: 700,
                color: OG.text,
                lineHeight: 1.2,
              }}
            >
              DReps, SPOs &amp; CC: {agreementPct}% Agreement
            </div>
          </div>

          {/* Alignment bar */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '32px' }}>
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: '48px',
                borderRadius: '24px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: `${agreementPct}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {agreementPct >= 20 && (
                  <div
                    style={{ display: 'flex', fontSize: '18px', fontWeight: 600, color: '#fff' }}
                  >
                    Agree {agreementPct}%
                  </div>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  width: `${disagreementPct}%`,
                  height: '100%',
                  backgroundColor: OG.barBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {disagreementPct >= 20 && (
                  <div
                    style={{
                      display: 'flex',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: OG.textMuted,
                    }}
                  >
                    Diverge {disagreementPct}%
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status + stats row */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <div
              style={{
                display: 'flex',
                padding: '10px 24px',
                borderRadius: '20px',
                backgroundColor: `${barColor}20`,
                border: `1px solid ${barColor}40`,
                fontSize: '20px',
                fontWeight: 600,
                color: barColor,
              }}
            >
              {statusLabel}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 24px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div style={{ display: 'flex', fontSize: '24px', fontWeight: 700, color: OG.text }}>
                {alignments?.length ?? 0}
              </div>
              <div
                style={{ display: 'flex', fontSize: '13px', color: OG.textMuted, marginTop: '2px' }}
              >
                Proposals Analyzed
              </div>
            </div>
          </div>

          <OGFooter left="$governada" right="governada.io/governance/health" />
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG Divergence] Error:', error);
    return new ImageResponse(<OGFallback message="Governance Alignment" />, {
      width: 1200,
      height: 630,
    });
  }
}
