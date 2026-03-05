import { ImageResponse } from 'next/og';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  OGBackground,
  OGScoreRing,
  OGFooter,
  OGFallback,
  OG,
  tierColor,
  tierLabel,
  formatAdaCompact,
} from '@/lib/og-utils';

export const runtime = 'edge';

interface SPOWrappedData {
  score_start?: number;
  score_end?: number;
  score_delta?: number;
  votes_cast?: number;
  participation_rate?: number;
  delegator_count_end?: number;
  live_stake_end?: number;
}

export async function GET(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  try {
    const { poolId } = await params;
    const url = new URL(request.url);
    const period = url.searchParams.get('period');
    const supabase = getSupabaseAdmin();

    const { data: pool } = await supabase
      .from('pools')
      .select('pool_name, ticker, governance_score, live_stake, delegator_count')
      .eq('pool_id', decodeURIComponent(poolId))
      .single();

    if (!pool) {
      return new ImageResponse(<OGFallback message="Pool not found" />, {
        width: 1080,
        height: 1080,
      });
    }

    const score = pool.governance_score ?? 0;
    const color = tierColor(score);
    const tier = tierLabel(score);
    const name = pool.pool_name || pool.ticker || 'Unknown Pool';

    const { count: totalPools } = await supabase
      .from('pools')
      .select('pool_id', { count: 'exact', head: true });

    const { count: betterCount } = await supabase
      .from('pools')
      .select('pool_id', { count: 'exact', head: true })
      .gt('governance_score', score);

    const { count: voteCount } = await supabase
      .from('spo_votes')
      .select('*', { count: 'exact', head: true })
      .eq('pool_id', decodeURIComponent(poolId));

    const rank = (betterCount ?? 0) + 1;
    const percentile = totalPools ? Math.round(((totalPools - rank) / totalPools) * 100) : 0;

    // Fetch period data if ?period param provided
    let periodData: SPOWrappedData | null = null;
    if (period) {
      const { data: wrapped } = await supabase
        .from('governance_wrapped')
        .select('data')
        .eq('entity_type', 'spo')
        .eq('entity_id', decodeURIComponent(poolId))
        .eq('period_id', period)
        .single();
      if (wrapped?.data) {
        periodData = wrapped.data as SPOWrappedData;
      }
    }

    const stats = [
      {
        label: period ? 'Voted' : 'Votes Cast',
        value:
          period && periodData ? `${periodData.votes_cast ?? voteCount ?? 0}` : `${voteCount ?? 0}`,
      },
      { label: 'Live Stake', value: formatAdaCompact(pool.live_stake ?? 0) },
      { label: 'Delegators', value: `${pool.delegator_count ?? 0}` },
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
            {period ? 'My SPO Score This Epoch' : 'My SPO Score'}
          </div>

          <OGScoreRing score={score} size={280} />

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
    console.error('[OG Wrapped SPO] Error:', error);
    return new ImageResponse(<OGFallback message="My SPO Score" />, { width: 1080, height: 1080 });
  }
}
