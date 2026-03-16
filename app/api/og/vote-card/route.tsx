import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';

export const runtime = 'edge';

const VOTE_COLORS: Record<string, string> = {
  Yes: OG.green,
  No: OG.red,
  Abstain: OG.textMuted,
};

const VOTE_BG: Record<string, string> = {
  Yes: `${OG.green}20`,
  No: `${OG.red}20`,
  Abstain: `${OG.textMuted}15`,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const drepId = searchParams.get('drepId');
    const txHash = searchParams.get('txHash');
    const index = searchParams.get('index');
    const vote = searchParams.get('vote') || 'Yes';
    const rationale = searchParams.get('rationale');

    if (!drepId || !txHash || index === null) {
      return new ImageResponse(<OGFallback message="Missing vote parameters" />, {
        width: 1200,
        height: 630,
      });
    }

    // Direct Supabase fetch compatible with edge runtime
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    let drepName = drepId.length > 20 ? `${drepId.slice(0, 12)}...${drepId.slice(-8)}` : drepId;
    let proposalTitle = 'Governance Proposal';

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Fetch DRep name
      const { data: drep } = await supabase.from('dreps').select('info').eq('id', drepId).single();

      if (drep?.info) {
        const info = drep.info as Record<string, unknown>;
        const name = (info.name as string) || (info.ticker as string) || (info.handle as string);
        if (name) drepName = name;
      }

      // Fetch proposal title
      const { data: proposal } = await supabase
        .from('proposals')
        .select('title')
        .eq('tx_hash', txHash)
        .eq('proposal_index', Number(index))
        .single();

      if (proposal?.title) {
        proposalTitle = proposal.title;
      }
    }

    const voteColor = VOTE_COLORS[vote] || OG.textMuted;
    const voteBg = VOTE_BG[vote] || `${OG.textMuted}15`;

    // Truncate texts for display
    const displayName = drepName.length > 30 ? drepName.slice(0, 28) + '...' : drepName;
    const displayTitle =
      proposalTitle.length > 80 ? proposalTitle.slice(0, 78) + '...' : proposalTitle;
    const displayRationale =
      rationale && rationale.length > 200 ? rationale.slice(0, 197) + '...' : rationale;

    return new ImageResponse(
      <OGBackground glow={voteColor}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '48px 64px',
            justifyContent: 'center',
          }}
        >
          {/* Header: DRep name + vote badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              marginBottom: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: '36px',
                fontWeight: 700,
                color: OG.text,
                lineHeight: 1.2,
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                display: 'flex',
                padding: '8px 24px',
                borderRadius: '24px',
                backgroundColor: voteBg,
                border: `2px solid ${voteColor}50`,
                fontSize: '24px',
                fontWeight: 700,
                color: voteColor,
              }}
            >
              {vote}
            </div>
          </div>

          {/* "voted on" label */}
          <div
            style={{
              display: 'flex',
              fontSize: '18px',
              color: OG.textDim,
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            voted on
          </div>

          {/* Proposal title */}
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 600,
              color: OG.text,
              lineHeight: 1.3,
              marginBottom: displayRationale ? '24px' : '0',
            }}
          >
            {displayTitle}
          </div>

          {/* Rationale excerpt if provided */}
          {displayRationale && (
            <div
              style={{
                display: 'flex',
                padding: '16px 20px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '16px',
                  color: OG.textMuted,
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                }}
              >
                &ldquo;{displayRationale}&rdquo;
              </div>
            </div>
          )}
        </div>
        <OGFooter left="$governada" right="governada.io" />
      </OGBackground>,
      {
        width: 1200,
        height: 630,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG] Error generating vote card:', error);
    return new ImageResponse(<OGFallback message="DRep vote on Governada" />, {
      width: 1200,
      height: 630,
    });
  }
}
