/**
 * Trajectory API — returns alignment snapshots over time for a DRep.
 * Powers future "alignment over time" sparklines on DRep profiles.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ drepId: string }> },
) {
  const { drepId } = await params;

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
    console.error('[trajectory] Query error:', error.message);
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
}
