import { ImageResponse } from 'next/og';
import { getDRepById } from '@/lib/data';
import { getDRepPrimaryName } from '@/utils/display';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
} from '@/lib/og-utils';
import { createClient } from '@/lib/supabase';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'edge';

interface DRepWrappedData {
  score_start?: number;
  score_end?: number;
  score_delta?: number;
  votes_cast?: number;
  rationales_written?: number;
  rationale_rate?: number;
  delegators_end?: number;
  participation_rate?: number;
}

export async function GET(request: Request, { params }: { params: Promise<{ drepId: string }> }) {
  try {
    const { drepId } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get('period');

    const drep = await getDRepById(decodeURIComponent(drepId));
    if (!drep) {
      return new ImageResponse(<OGFallback message="DRep not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const name = getDRepPrimaryName(drep);
    const color = tierColor(drep.drepScore);
    const tier = tierLabel(drep.drepScore);

    const supabase = createClient();
    const { count: totalDReps } = await supabase
      .from('dreps')
      .select('drep_id', { count: 'exact', head: true });

    const { count: betterCount } = await supabase
      .from('dreps')
      .select('drep_id', { count: 'exact', head: true })
      .gt('score', drep.drepScore);

    const rank = (betterCount ?? 0) + 1;
    const percentile = totalDReps ? Math.round(((totalDReps - rank) / totalDReps) * 100) : 0;

    // Fetch period data if ?period param provided
    let periodData: DRepWrappedData | null = null;
    if (period) {
      const adminSupabase = getSupabaseAdmin();
      const { data: wrapped } = await adminSupabase
        .from('governance_wrapped')
        .select('data')
        .eq('entity_type', 'drep')
        .eq('entity_id', decodeURIComponent(drepId))
        .eq('period_id', period)
        .single();
      if (wrapped?.data) {
        periodData = wrapped.data as DRepWrappedData;
      }
    }

    const votesCastLabel =
      periodData?.votes_cast !== undefined
        ? `Voted ${periodData.votes_cast} proposals`
        : `${drep.totalVotes || 0} Votes`;

    const stats = [
      {
        label: period ? 'Voted' : 'Votes Cast',
        value:
          period && periodData
            ? `${periodData.votes_cast ?? drep.totalVotes ?? 0}`
            : `${drep.totalVotes || 0}`,
      },
      { label: 'Rationale Rate', value: `${drep.rationaleRate}%` },
      { label: 'Delegators', value: `${drep.delegatorCount}` },
      { label: 'Rank', value: `#${rank}` },
    ];

    const delta = periodData?.score_delta;
    const deltaColor =
      delta !== undefined
        ? delta > 0
          ? OG.green
          : delta < 0
            ? OG.red
            : OG.textMuted
        : OG.textMuted;
    const deltaLabel =
      delta !== undefined
        ? delta > 0
          ? `+${delta} pts this epoch`
          : `${delta} pts this epoch`
        : null;

    return new ImageResponse(
      <OGBackground glow={color}>
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
              fontSize: '28px',
              color: OG.textMuted,
              fontWeight: 500,
              marginBottom: '16px',
            }}
          >
            {period ? 'My DRepScore This Epoch' : 'My DRepScore'}
          </div>

          <OGScoreRing score={drep.drepScore} size={280} />

          <div
            style={{
              display: 'flex',
              marginTop: '20px',
              padding: '8px 28px',
              borderRadius: '24px',
              backgroundColor: `${color}20`,
              border: `1px solid ${color}40`,
              fontSize: '22px',
              fontWeight: 600,
              color,
            }}
          >
            {tier} — Top {percentile}%
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: '36px',
              fontWeight: 700,
              marginTop: '32px',
              color: OG.text,
            }}
          >
            {name.length > 20 ? name.slice(0, 18) + '…' : name}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: '40px',
            }}
          >
            {stats.map((s) => (
              <div
                key={s.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  backgroundColor: OG.bgCard,
                  border: `1px solid ${OG.border}`,
                  minWidth: '140px',
                }}
              >
                <div style={{ display: 'flex', fontSize: '28px', fontWeight: 700, color: OG.text }}>
                  {s.value}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontSize: '14px',
                    color: OG.textMuted,
                    marginTop: '4px',
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {deltaLabel && (
            <div
              style={{
                display: 'flex',
                marginTop: '20px',
                padding: '6px 20px',
                borderRadius: '20px',
                backgroundColor: `${deltaColor}15`,
                border: `1px solid ${deltaColor}30`,
                fontSize: '20px',
                fontWeight: 600,
                color: deltaColor,
              }}
            >
              {deltaLabel}
            </div>
          )}

          <OGFooter left="$drepscore" right="drepscore.io" />
        </div>
      </OGBackground>,
      {
        width: 1080,
        height: 1080,
        headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
      },
    );
  } catch (error) {
    console.error('[OG Wrapped DRep] Error:', error);
    return new ImageResponse(<OGFallback message="My DRepScore" />, { width: 1080, height: 1080 });
  }
}
