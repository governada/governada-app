export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { computeEDI, type EDIResult } from '@/lib/ghi/ediMetrics';
import { shortenDRepId } from '@/utils/display';
import { logger } from '@/lib/logger';

export const GET = withRouteHandler(async (_request, { requestId }) => {
  const supabase = createClient();

  const { data: dreps } = await supabase
    .from('dreps')
    .select('id, info')
    .not('info->isActive', 'is', null);

  const activeDreps = (dreps ?? []).filter((d: any) => d.info?.isActive);
  const votingPowers = activeDreps
    .map((d: any) => parseInt(d.info?.votingPowerLovelace || '0', 10))
    .filter((v: number) => v > 0);

  const edi: EDIResult = computeEDI(votingPowers);

  const { data: history } = await supabase
    .from('decentralization_snapshots')
    .select(
      'epoch_no, composite_score, nakamoto_coefficient, gini, shannon_entropy, hhi, theil_index, concentration_ratio, tau_decentralization',
    )
    .order('epoch_no', { ascending: false })
    .limit(20);

  // Top DReps by voting power for treemap visualization
  const sortedByPower = activeDreps
    .map((d: any) => ({
      drepId: d.id,
      name: d.info?.name || d.info?.ticker || d.info?.handle || shortenDRepId(d.id),
      votingPower: parseInt(d.info?.votingPowerLovelace || '0', 10),
    }))
    .filter((d) => d.votingPower > 0)
    .sort((a, b) => b.votingPower - a.votingPower)
    .slice(0, 30);

  return NextResponse.json(
    {
      current: edi,
      activeDrepCount: activeDreps.length,
      history: (history ?? []).reverse(),
      topDRepsByPower: sortedByPower,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
  );
});
