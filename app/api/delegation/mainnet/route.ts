export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { logger } from '@/lib/logger';
import { captureServerEvent } from '@/lib/posthog-server';

const MainnetDelegationBody = z.object({
  stakeAddress: z
    .string()
    .min(1, 'stakeAddress is required')
    .min(57, 'Mainnet delegation requires a full mainnet stake address')
    .max(59, 'Mainnet delegation requires a full mainnet stake address')
    .regex(/^stake1[a-z0-9]+$/, 'Mainnet delegation requires a mainnet stake address'),
  targetDrepId: z.string().min(1, 'targetDrepId is required'),
  txHash: z.string().regex(/^[a-f0-9]{64}$/, 'Mainnet delegation requires a 64-character tx hash'),
  previousDrepId: z.string().min(1).nullable().optional(),
  stakeRegistered: z.boolean(),
});

function hostFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

async function resolveAuthenticatedStakeAddress(wallet: string): Promise<string | null> {
  if (wallet.startsWith('stake1')) {
    return wallet;
  }

  try {
    const { resolveRewardAddress } = await import('@meshsdk/core');
    return resolveRewardAddress(wallet) ?? null;
  } catch {
    return null;
  }
}

export const POST = withRouteHandler(
  async (request: NextRequest, { requestId, userId, wallet }: RouteContext) => {
    const body = MainnetDelegationBody.parse(await request.json());

    if (wallet) {
      const authenticatedStakeAddress = await resolveAuthenticatedStakeAddress(wallet);
      if (authenticatedStakeAddress !== body.stakeAddress) {
        return NextResponse.json(
          { error: 'Stake address does not match authenticated wallet' },
          { status: 403 },
        );
      }
    }

    if (!wallet) {
      logger.warn('Mainnet delegation capture accepted without wallet on auth context', {
        context: 'api/delegation/mainnet',
        requestId,
        userId,
        stakeAddress: body.stakeAddress,
      });
    }

    const currentUrl = request.headers.get('referer') ?? undefined;
    const delegationPayload = {
      drep_id: body.targetDrepId,
      previous_drep_id: body.previousDrepId ?? null,
      tx_hash: body.txHash,
      stake_registered: body.stakeRegistered,
      mode: 'mainnet',
      $current_url: currentUrl,
      $host: hostFromUrl(currentUrl) ?? request.headers.get('host') ?? undefined,
    };

    captureServerEvent('delegation_completed', delegationPayload, body.stakeAddress);
    captureServerEvent('delegated', delegationPayload, body.stakeAddress);

    return NextResponse.json({
      captured: true,
      mode: 'mainnet',
      txHash: body.txHash,
    });
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
