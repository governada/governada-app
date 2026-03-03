import { ImageResponse } from 'next/og';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import { MILESTONES } from '@/lib/milestones';
import { OGBackground, OGScoreRing, OGFooter, OGFallback, OG } from '@/lib/og-utils';

export const runtime = 'edge';

const MILESTONE_EMOJIS: Record<string, string> = {
  'claimed-profile': '🛡️',
  'first-10-delegators': '👥',
  'first-100-delegators': '🎯',
  'first-1000-delegators': '🏆',
  'score-above-80-30d': '⭐',
  'all-pillars-strong': '🎯',
  'rationale-streak-5': '📝',
  'rationale-streak-10': '📚',
  'perfect-participation-epoch': '✅',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ drepId: string; milestoneKey: string }> },
) {
  try {
    const { drepId, milestoneKey } = await params;
    const drep = await getDRepById(decodeURIComponent(drepId));
    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const milestone = MILESTONES.find((m) => m.key === milestoneKey);
    if (!milestone) {
      return new ImageResponse(<OGFallback message="Milestone not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const name = getDRepPrimaryName(drep);
    const emoji = MILESTONE_EMOJIS[milestoneKey] || '🏅';

    return new ImageResponse(
      <OGBackground glow={OG.amber}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '80px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: '24px',
              color: OG.amber,
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            Achievement Unlocked
          </div>

          <div style={{ display: 'flex', fontSize: '80px', marginBottom: '16px' }}>{emoji}</div>

          <div
            style={{
              display: 'flex',
              fontSize: '40px',
              fontWeight: 700,
              color: OG.text,
              textAlign: 'center',
            }}
          >
            {milestone.label}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '20px',
              color: OG.textMuted,
              marginTop: '8px',
              textAlign: 'center',
            }}
          >
            {milestone.description}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              marginTop: '48px',
            }}
          >
            <OGScoreRing score={drep.drepScore} size={120} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: OG.text }}>
                {name.length > 20 ? name.slice(0, 18) + '…' : name}
              </div>
              <div
                style={{ display: 'flex', fontSize: '16px', color: OG.textMuted, marginTop: '4px' }}
              >
                DRepScore: {drep.drepScore}/100
              </div>
            </div>
          </div>

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
      },
    );
  } catch (error) {
    console.error('[OG Milestone] Error:', error);
    return new ImageResponse(<OGFallback message="Achievement Unlocked" />, {
      width: 1080,
      height: 1080,
    });
  }
}
