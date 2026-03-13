import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';

export const runtime = 'edge';

/**
 * GET /api/og/epoch-report?epoch=X&headline=...&decisions=N&ada=N&streak=N&drep=Name
 *
 * Generates a personalized epoch report card image (1200x630) for social sharing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const epoch = searchParams.get('epoch') || '?';
  const headline = searchParams.get('headline') || 'Your Governance Report';
  const decisions = searchParams.get('decisions') || '0';
  const ada = searchParams.get('ada') || '0';
  const streak = searchParams.get('streak') || '0';
  const drep = searchParams.get('drep');

  return new ImageResponse(
    <OGBackground glow={OG.indigo}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '64px',
          justifyContent: 'space-between',
        }}
      >
        {/* Top: epoch label + headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: OG.textMuted,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
            }}
          >
            Epoch {epoch} Report Card
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '42px',
              color: OG.text,
              fontWeight: 700,
              marginTop: '12px',
              lineHeight: 1.2,
              maxWidth: '900px',
            }}
          >
            {headline}
          </div>
          {drep && (
            <div
              style={{
                display: 'flex',
                fontSize: '20px',
                color: OG.textMuted,
                marginTop: '12px',
              }}
            >
              Represented by {drep}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '32px', marginBottom: '60px' }}>
          <ReportStat label="Decisions" value={decisions} icon="vote" color={OG.green} />
          <ReportStat label="ADA Governed" value={ada} icon="coins" color={OG.amber} />
          <ReportStat
            label="Check-in Streak"
            value={`${streak} epochs`}
            icon="flame"
            color={OG.indigo}
          />
        </div>

        <OGFooter left="$governada" right="governada.io" />
      </div>
    </OGBackground>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    },
  );
}

function ReportStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '28px 36px',
        borderRadius: '16px',
        background: OG.bgCard,
        border: `1px solid ${OG.border}`,
        minWidth: '200px',
      }}
    >
      <div style={{ display: 'flex', fontSize: '40px', fontWeight: 700, color }}>{value}</div>
      <div
        style={{
          display: 'flex',
          fontSize: '16px',
          color: OG.textMuted,
          marginTop: '8px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  );
}
