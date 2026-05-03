export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { isSandboxMode } from '@/lib/delegation/mode';
import { getSupabaseAdmin } from '@/lib/supabase';

const SandboxDelegationBody = z.object({
  stakeAddress: z
    .string()
    .min(1, 'stakeAddress is required')
    .min(57, 'Sandbox delegation requires a full mainnet stake address')
    .max(59, 'Sandbox delegation requires a full mainnet stake address')
    .regex(/^stake1[a-z0-9]+$/, 'Sandbox delegation requires a mainnet stake address'),
  targetDrepId: z.string().min(1, 'targetDrepId is required'),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    if (!isSandboxMode()) {
      return NextResponse.json({ error: 'Sandbox delegation is not enabled' }, { status: 403 });
    }

    const body = SandboxDelegationBody.parse(await request.json());
    const id = crypto.randomUUID();
    const simulatedTxHash = `sandbox-${id}`;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('sandbox_delegations').insert({
      id,
      stake_address: body.stakeAddress,
      target_drep_id: body.targetDrepId,
      simulated_tx_hash: simulatedTxHash,
    });

    if (error) {
      throw new Error(`Failed to record sandbox delegation: ${error.message}`);
    }

    return NextResponse.json({
      mode: 'sandbox',
      txHash: simulatedTxHash,
      drepId: body.targetDrepId,
    });
  },
  { rateLimit: { max: 10, window: 60 } },
);
