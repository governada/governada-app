import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { captureServerEvent } from '@/lib/posthog-server';

const DelegationEventsBody = z.object({
  stakeAddress: z
    .string()
    .min(1, 'stakeAddress is required')
    .regex(/^stake1[a-z0-9]+$/, 'Invalid mainnet stake address format'),
  drepId: z
    .string()
    .min(1, 'drepId is required')
    .max(128)
    .regex(/^[a-z0-9_]+$/, 'Invalid DRep id format'),
  previousDrepId: z.string().max(128).nullable().optional(),
  txHash: z
    .string()
    .min(1, 'txHash is required')
    .max(128)
    .regex(/^(sandbox-[0-9a-f-]{36}|[a-f0-9]{64})$/i, 'Invalid transaction hash format'),
  stakeRegistered: z.boolean(),
  mode: z.enum(['mainnet', 'sandbox']),
  currentUrl: z.string().url().optional(),
});

function hostFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = DelegationEventsBody.parse(await request.json());
    const referer = request.headers.get('referer') || undefined;
    const currentUrl = body.currentUrl || referer;
    const host = hostFromUrl(currentUrl) || request.headers.get('host') || undefined;

    const delegationPayload = {
      drep_id: body.drepId,
      previous_drep_id: body.previousDrepId ?? null,
      tx_hash: body.txHash,
      stake_registered: body.stakeRegistered,
      mode: body.mode,
      $current_url: currentUrl,
      $host: host,
    };

    captureServerEvent('delegation_completed', delegationPayload, body.stakeAddress);
    captureServerEvent('delegated', delegationPayload, body.stakeAddress);

    return NextResponse.json({
      captured: true,
      events: ['delegation_completed', 'delegated'],
    });
  },
  { rateLimit: { max: 30, window: 60 } },
);
