import { ImageResponse } from 'next/og';
import { CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { OGBackground, OGFooter, OGFallback, OG } from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CATEGORY_COLORS: Record<string, string> = {
  delegation: OG.blue,
  influence: OG.indigo,
  engagement: OG.amber,
  identity: OG.green,
};

const MILESTONE_EMOJIS: Record<string, string> = {
  'first-delegation': '\u{1F91D}',
  'delegation-streak-10': '\u{1F525}',
  'delegation-streak-25': '\u{1F525}',
  'delegation-streak-50': '\u{1F525}',
  'delegation-streak-100': '\u{1F525}',
  'influenced-10': '\u{1F5F3}',
  'influenced-50': '\u{1F5F3}',
  'influenced-100': '\u{1F5F3}',
  'first-engagement': '\u{1F4E3}',
  'engagement-10': '\u{1F4E3}',
  'ada-governed-100k': '\u{1FA99}',
  'ada-governed-1m': '\u{1FA99}',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stakeAddress: string; milestoneKey: string }> },
) {
  try {
    const { stakeAddress, milestoneKey } = await params;

    const milestone = CITIZEN_MILESTONES.find((m) => m.key === milestoneKey);
    if (!milestone) {
      return new ImageResponse(<OGFallback message="Milestone not found" />, {
        width: 1200,
        height: 630,
      });
    }

    const supabase = createClient();

    // Look up citizen tenure (first delegation epoch)
    const { data: wallet } = await supabase
      .from('user_wallets')
      .select('delegation_streak_epochs, created_at')
      .eq('stake_address', stakeAddress)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const streakEpochs = (wallet as { delegation_streak_epochs?: number } | null)
      ?.delegation_streak_epochs;

    const emoji = MILESTONE_EMOJIS[milestoneKey] || '\u{1F3C5}';
    const accentColor = CATEGORY_COLORS[milestone.category] || OG.brand;

    return new ImageResponse(
      <OGBackground glow={accentColor}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '64px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Header badge */}
          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: accentColor,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              marginBottom: '24px',
            }}
          >
            Citizen Achievement Unlocked
          </div>

          {/* Icon */}
          <div style={{ display: 'flex', fontSize: '72px', marginBottom: '20px' }}>{emoji}</div>

          {/* Milestone name */}
          <div
            style={{
              display: 'flex',
              fontSize: '44px',
              fontWeight: 700,
              color: OG.text,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {milestone.label}
          </div>

          {/* Description */}
          <div
            style={{
              display: 'flex',
              fontSize: '22px',
              color: OG.textMuted,
              marginTop: '12px',
              textAlign: 'center',
              maxWidth: '700px',
            }}
          >
            {milestone.description}
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '40px',
            }}
          >
            {/* Category badge */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '16px 28px',
                borderRadius: '12px',
                backgroundColor: OG.bgCard,
                border: `1px solid ${OG.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: accentColor,
                  textTransform: 'capitalize' as const,
                }}
              >
                {milestone.category}
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: '13px',
                  color: OG.textMuted,
                  marginTop: '4px',
                }}
              >
                Category
              </div>
            </div>

            {/* Tenure / streak */}
            {streakEpochs != null && streakEpochs > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 28px',
                  borderRadius: '12px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${OG.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: OG.text,
                  }}
                >
                  {streakEpochs} Epochs
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '13px',
                    color: OG.textMuted,
                    marginTop: '4px',
                  }}
                >
                  Delegation Streak
                </div>
              </div>
            )}
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
  } catch (error) {
    console.error('[OG Citizen Milestone] Error:', error);
    return new ImageResponse(<OGFallback message="Citizen Achievement" />, {
      width: 1200,
      height: 630,
    });
  }
}
