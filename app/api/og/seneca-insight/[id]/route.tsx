import { ImageResponse } from 'next/og';
import { OGBackground, OGFallback, OG } from '@/lib/og-utils';

export const runtime = 'edge';

/**
 * Seneca Insight OG Image — Shareable branded card for Seneca analyses.
 *
 * Query params:
 * - quote: The Seneca insight text (required)
 * - topic: Governance topic label (optional, e.g., "Treasury Analysis")
 * - persona: Seneca persona that generated it (optional)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const quote = searchParams.get('quote') ?? '';
    const topic = searchParams.get('topic') ?? 'Governance Insight';
    const persona = searchParams.get('persona') ?? 'navigator';

    if (!quote) {
      return new ImageResponse(<OGFallback message="No insight to share" />, {
        width: 1200,
        height: 630,
      });
    }

    // Persona accent colors
    const accentColors: Record<string, string> = {
      navigator: '#38bdf8', // sky-400
      analyst: '#fbbf24', // amber-400
      partner: '#a78bfa', // violet-400
      guide: '#38bdf8', // sky-400
    };
    const accent = accentColors[persona] ?? accentColors.navigator;

    // Truncate long quotes for the card
    const displayQuote = quote.length > 280 ? quote.slice(0, 277) + '...' : quote;

    return new ImageResponse(
      <OGBackground glow={accent}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
            justifyContent: 'space-between',
          }}
        >
          {/* Top: Seneca branding + topic badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Compass sigil (simplified) */}
            <div
              style={{
                display: 'flex',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${accent}40 0%, ${accent}15 100%)`,
                border: `2px solid ${accent}60`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: accent,
                }}
              >
                S
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: OG.text }}>
                Seneca
              </div>
              <div style={{ display: 'flex', fontSize: '14px', color: OG.textMuted }}>
                Governance Intelligence
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                marginLeft: 'auto',
                padding: '6px 16px',
                borderRadius: '16px',
                background: `${accent}15`,
                border: `1px solid ${accent}30`,
                color: accent,
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {topic}
            </div>
          </div>

          {/* Center: The insight quote */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              justifyContent: 'center',
              padding: '24px 0',
            }}
          >
            {/* Opening quotation mark */}
            <div
              style={{
                display: 'flex',
                fontSize: '64px',
                lineHeight: 1,
                color: `${accent}60`,
                fontFamily: 'serif',
                marginBottom: '-8px',
              }}
            >
              &ldquo;
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: displayQuote.length > 200 ? '24px' : '28px',
                lineHeight: 1.5,
                color: OG.text,
                fontWeight: 500,
                maxWidth: '1000px',
              }}
            >
              {displayQuote}
            </div>
          </div>

          {/* Bottom: Insight ID + Governada branding */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', fontSize: '14px', color: OG.textDim }}>
              Insight #{id.slice(0, 8)}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontSize: '24px', fontWeight: 700, color: OG.brand }}>
                $governada
              </div>
              <div style={{ display: 'flex', fontSize: '16px', color: OG.textDim }}>
                governada.io
              </div>
            </div>
          </div>
        </div>
      </OGBackground>,
      {
        width: 1200,
        height: 630,
      },
    );
  } catch {
    return new ImageResponse(<OGFallback message="Failed to generate insight card" />, {
      width: 1200,
      height: 630,
    });
  }
}
