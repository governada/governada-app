import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api/handler';
import { apiSuccess } from '@/lib/api/response';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ApiContext } from '@/lib/api/handler';

async function handler(_request: NextRequest, ctx: ApiContext) {
  const supabase = getSupabaseAdmin();

  const [statsResult, recapResult, openProposalsResult, activeDrepsResult] = await Promise.all([
    supabase.from('governance_stats').select('*').eq('id', 1).single(),
    supabase
      .from('epoch_recaps')
      .select('*')
      .order('epoch', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('expired_epoch', null)
      .is('dropped_epoch', null),
    supabase
      .from('dreps')
      .select('drep_id', { count: 'exact', head: true })
      .eq('registered', true)
      .not('info->isActive', 'eq', false),
  ]);

  const stats = statsResult.data;
  const recap = recapResult.data;

  const pulse = {
    current_epoch: stats?.current_epoch ?? null,
    treasury_balance_lovelace: stats?.treasury_balance_lovelace ?? null,
    open_proposals: openProposalsResult.count ?? 0,
    active_dreps: activeDrepsResult.count ?? 0,
    latest_recap: recap
      ? {
          epoch: recap.epoch,
          proposals_submitted: recap.proposals_submitted,
          proposals_ratified: recap.proposals_ratified,
          proposals_expired: recap.proposals_expired,
          proposals_dropped: recap.proposals_dropped,
          drep_participation_pct: recap.drep_participation_pct,
          treasury_withdrawn_ada: recap.treasury_withdrawn_ada,
          ai_narrative: recap.ai_narrative,
          computed_at: recap.computed_at,
        }
      : null,
    updated_at: stats?.updated_at ?? null,
  };

  return apiSuccess(pulse, {
    requestId: ctx.requestId,
    cacheSeconds: 600,
  });
}

export const GET = withApiHandler(handler);
export const dynamic = 'force-dynamic';
