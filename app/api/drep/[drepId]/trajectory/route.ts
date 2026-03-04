/**
 * Trajectory API — returns alignment snapshots over time for a DRep.
 * Powers future "alignment over time" sparklines on DRep profiles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export const GET = withRouteHandler(async (request, { requestId }) => {
  const drepId = request.nextUrl.pathname.split('/api/drep/')[1]?.split('/')[0];

  if (!drepId) {
    return NextResponse.json({ error: 'drepId is required' }, { status: 400 });
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('alignment_snapshots')
    .select('*')
    .eq('drep_id', drepId)
    .order('epoch', { ascending: true });

  if (error) {
    logger.error('Query error', { context: 'trajectory', error: error.message });
    return NextResponse.json({ error: 'Failed to fetch trajectory' }, { status: 500 });
  }

  const snapshots = (data || []).map((row: any) => ({
    epoch: row.epoch,
    treasuryConservative: row.alignment_treasury_conservative,
    treasuryGrowth: row.alignment_treasury_growth,
    decentralization: row.alignment_decentralization,
    security: row.alignment_security,
    innovation: row.alignment_innovation,
    transparency: row.alignment_transparency,
    pcaCoordinates: row.pca_coordinates,
    snapshotAt: row.snapshot_at,
  }));

  return NextResponse.json({
    drepId,
    snapshots,
    totalEpochs: snapshots.length,
  });
});
