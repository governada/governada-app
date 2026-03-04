import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export const GET = withRouteHandler(async (_request, { requestId }) => {
    const supabase = createClient();

    const [participation, treasury, decentralization] = await Promise.all([
      supabase
        .from('governance_participation_snapshots')
        .select('epoch, participation_rate, rationale_rate')
        .order('epoch', { ascending: true })
        .limit(20),
      supabase
        .from('treasury_health_snapshots')
        .select('epoch, health_score, runway_months, burn_rate_per_epoch')
        .order('epoch', { ascending: true })
        .limit(20),
      supabase
        .from('decentralization_snapshots')
        .select('epoch_no, composite_score, nakamoto_coefficient, active_drep_count')
        .order('epoch_no', { ascending: true })
        .limit(20),
    ]);

    return NextResponse.json({
      participation: participation.data ?? [],
      treasury: treasury.data ?? [],
      decentralization: decentralization.data ?? [],
    });
});
