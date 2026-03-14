import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

// Epoch derivation (same constants as lib/api/response.ts)
const SHELLEY_GENESIS = 1596491091;
const EPOCH_LEN = 432000;
const SHELLEY_BASE = 209;

function getCurrentEpoch(): number {
  return Math.floor((Date.now() / 1000 - SHELLEY_GENESIS) / EPOCH_LEN) + SHELLEY_BASE;
}

/**
 * Resolve userId to stake_address (same pattern as notifications route).
 */
async function resolveStakeAddress(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('stake_address')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  return wallet?.stake_address ?? null;
}

/**
 * POST /api/you/checkin — record a hub check-in for the current epoch.
 * Idempotent: multiple calls in the same epoch produce one row.
 */
export const POST = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const stakeAddress = await resolveStakeAddress(userId!);
    if (!stakeAddress) {
      return NextResponse.json({ error: 'No wallet linked' }, { status: 400 });
    }

    const epoch = getCurrentEpoch();
    const supabase = getSupabaseAdmin();

    // Upsert: ON CONFLICT does nothing (idempotent)
    await supabase
      .from('user_hub_checkins')
      .upsert(
        { user_stake_address: stakeAddress, epoch },
        { onConflict: 'user_stake_address,epoch', ignoreDuplicates: true },
      );

    return NextResponse.json({ ok: true, epoch });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);

/**
 * GET /api/you/checkin — return current check-in streak and last check-in epoch.
 * Streak counts consecutive epochs with a check-in, allowing a 1-epoch grace gap.
 */
export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const stakeAddress = await resolveStakeAddress(userId!);
    if (!stakeAddress) {
      return NextResponse.json({ streak: 0, lastEpoch: null });
    }

    const supabase = getSupabaseAdmin();
    const currentEpoch = getCurrentEpoch();

    // Fetch recent check-ins (descending by epoch), enough to compute streak
    const { data: checkins } = await supabase
      .from('user_hub_checkins')
      .select('epoch')
      .eq('user_stake_address', stakeAddress)
      .order('epoch', { ascending: false })
      .limit(200);

    if (!checkins || checkins.length === 0) {
      return NextResponse.json({ streak: 0, lastEpoch: null });
    }

    const epochSet = new Set(checkins.map((c) => c.epoch));
    const lastEpoch = checkins[0].epoch;

    // Count streak backward from current epoch with 1-epoch grace period.
    // Start from current epoch (or last check-in if not checked in this epoch yet).
    let streak = 0;
    let e = currentEpoch;
    let gracesUsed = 0;

    // If user hasn't checked in this epoch or last epoch, streak is 0
    if (!epochSet.has(currentEpoch) && !epochSet.has(currentEpoch - 1)) {
      return NextResponse.json({ streak: 0, lastEpoch });
    }

    // Walk backward counting consecutive epochs (with grace)
    while (e > 0) {
      if (epochSet.has(e)) {
        streak++;
        gracesUsed = 0; // reset grace on a hit
      } else {
        gracesUsed++;
        if (gracesUsed > 1) break; // more than 1-epoch gap breaks the streak
      }
      e--;
    }

    return NextResponse.json({ streak, lastEpoch });
  },
  { auth: 'required' },
);
