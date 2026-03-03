import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { OGBackground, OGFooter, OG } from '@/lib/og-utils';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const epoch = searchParams.get('epoch') || '?';
  const votes = searchParams.get('votes') || '0';
  const rationales = searchParams.get('rationales') || '0';
  const proposals = searchParams.get('proposals') || '0';
  const repScore = searchParams.get('repScore');

  return new ImageResponse(
    <OGBackground glow={OG.indigo}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              fontSize: '24px',
              color: OG.textMuted,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase' as const,
            }}
          >
            Epoch {epoch} Summary
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: '48px',
              color: OG.text,
              fontWeight: 700,
              marginTop: '8px',
            }}
          >
            Governance Recap
          </div>
        </div>

        <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
          <StatBox label="DRep Votes" value={votes} color={OG.green} />
          <StatBox label="Rationales" value={rationales} color={OG.blue} />
          <StatBox label="Proposals" value={proposals} color={OG.amber} />
          {repScore && <StatBox label="Rep Score" value={repScore} color={OG.indigo} />}
        </div>

        <OGFooter />
      </div>
    </OGBackground>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    },
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 32px',
        borderRadius: '16px',
        background: OG.bgCard,
        border: `1px solid ${OG.border}`,
      }}
    >
      <div style={{ display: 'flex', fontSize: '48px', fontWeight: 700, color }}>{value}</div>
      <div style={{ display: 'flex', fontSize: '16px', color: OG.textMuted, marginTop: '8px' }}>
        {label}
      </div>
    </div>
  );
}
