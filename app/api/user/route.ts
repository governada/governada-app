export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SupabaseUser, SupabaseUserUpdate } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { isValidDepth, getTunerEvents, getTunerDigestFrequency } from '@/lib/governanceTuner';
import { EVENT_REGISTRY } from '@/lib/notificationRegistry';
import { captureServerEvent } from '@/lib/posthog-server';

type DelegationHistoryEntry = {
  drepId?: string;
  drep_id?: string;
  txHash?: string;
  tx_hash?: string;
  stakeRegistered?: boolean;
  stake_registered?: boolean;
  timestamp?: string;
};

function asDelegationHistory(value: unknown): DelegationHistoryEntry[] | null {
  return Array.isArray(value) && value.length > 0 ? (value as DelegationHistoryEntry[]) : null;
}

function drepIdFromEntry(entry: DelegationHistoryEntry | undefined): string | undefined {
  return entry?.drepId ?? entry?.drep_id;
}

function txHashFromEntry(entry: DelegationHistoryEntry | undefined): string | undefined {
  return entry?.txHash ?? entry?.tx_hash;
}

function stakeRegisteredFromEntry(entry: DelegationHistoryEntry | undefined): boolean | undefined {
  return entry?.stakeRegistered ?? entry?.stake_registered;
}

function hostFromUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

function isMainnetTxHash(txHash: string | undefined): txHash is string {
  return /^[a-f0-9]{64}$/i.test(txHash ?? '');
}

function buildDelegationHistoryUpdate(
  incomingHistory: DelegationHistoryEntry[],
  previousHistory: DelegationHistoryEntry[],
): { nextHistory: DelegationHistoryEntry[]; latestEntry: DelegationHistoryEntry; isNew: boolean } {
  const latestEntry = incomingHistory[incomingHistory.length - 1]!;
  const incomingTxHash = txHashFromEntry(latestEntry);
  const previousLatestTxHash = txHashFromEntry(previousHistory[previousHistory.length - 1]);
  const txAlreadyExists =
    !!incomingTxHash && previousHistory.some((entry) => txHashFromEntry(entry) === incomingTxHash);
  const isNew = incomingTxHash
    ? !txAlreadyExists && incomingTxHash !== previousLatestTxHash
    : incomingHistory.length > previousHistory.length;

  if (!isNew && incomingHistory.length < previousHistory.length) {
    return { nextHistory: previousHistory, latestEntry, isNew };
  }

  if (isNew && incomingHistory.length <= previousHistory.length) {
    return { nextHistory: [...previousHistory, latestEntry], latestEntry, isNew };
  }

  return { nextHistory: incomingHistory, latestEntry, isNew };
}

export const GET = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('users').select('*').eq('id', userId!).single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const previousVisitAt = data.last_visit_at || null;

    await supabase
      .from('users')
      .update({ last_visit_at: new Date().toISOString() })
      .eq('id', userId!);

    return NextResponse.json({
      ...data,
      previousVisitAt,
    } as SupabaseUser & { previousVisitAt: string | null });
  },
  { auth: 'required' },
);

export const PATCH = withRouteHandler(
  async (request: NextRequest, { userId, wallet }: RouteContext) => {
    const updates: SupabaseUserUpdate = await request.json();

    const allowedFields: (keyof SupabaseUserUpdate)[] = [
      'prefs',
      'watchlist',
      'push_subscriptions',
      'display_name',
      'digest_frequency',
      'governance_depth',
      'notification_preferences',
    ];

    const supabase = getSupabaseAdmin();
    const sanitizedUpdates: Record<string, unknown> = { last_active: new Date().toISOString() };
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    // When governance_depth is set, validate and compute derived notification settings
    if (updates.governance_depth !== undefined) {
      if (!isValidDepth(updates.governance_depth)) {
        return NextResponse.json({ error: 'Invalid governance_depth value' }, { status: 400 });
      }

      const depth = updates.governance_depth;
      const enabledEvents = getTunerEvents(depth);
      const enabledSet = new Set(enabledEvents);

      // Build notification_preferences: true for enabled events, false for the rest
      const allUserFacingKeys = EVENT_REGISTRY.filter(
        (e) => e.key !== 'profile-view' && e.key !== 'api-health-alert',
      ).map((e) => e.key);

      const notificationPreferences: Record<string, boolean> = {};
      for (const key of allUserFacingKeys) {
        notificationPreferences[key] = enabledSet.has(key);
      }

      sanitizedUpdates.notification_preferences = notificationPreferences;
      sanitizedUpdates.digest_frequency = getTunerDigestFrequency(depth);
    }

    const incomingDelegationHistory = asDelegationHistory(updates.delegation_history);
    let delegationPayload: Record<string, unknown> | null = null;
    let delegationDistinctId: string | null = null;

    if (incomingDelegationHistory) {
      const { data: currentUser, error: currentUserError } = await supabase
        .from('users')
        .select('delegation_history')
        .eq('id', userId!)
        .single();

      if (currentUserError) {
        logger.warn('Could not load prior delegation history before user update', {
          context: 'user',
          error: currentUserError.message,
        });
      }

      const previousHistory = asDelegationHistory(
        (currentUser as { delegation_history?: unknown } | null)?.delegation_history,
      );
      const { nextHistory, latestEntry, isNew } = buildDelegationHistoryUpdate(
        incomingDelegationHistory,
        previousHistory ?? [],
      );

      sanitizedUpdates.delegation_history = nextHistory;

      const txHash = txHashFromEntry(latestEntry);
      const drepId = drepIdFromEntry(latestEntry);
      const previousLatestEntry = previousHistory?.[previousHistory.length - 1];

      if (isNew && txHash?.startsWith('sandbox-')) {
        logger.info('Skipping user delegation telemetry for sandbox history entry', {
          context: 'user',
          txHash,
        });
      } else if (isNew && drepId && isMainnetTxHash(txHash)) {
        const { data: walletRow, error: walletError } = await supabase
          .from('user_wallets')
          .select('stake_address')
          .eq('user_id', userId!)
          .maybeSingle();

        if (walletError) {
          logger.warn('Could not resolve stake address for delegation telemetry', {
            context: 'user',
            error: walletError.message,
          });
        }

        const walletStakeAddress = (walletRow as { stake_address?: string } | null)?.stake_address;
        const stakeAddress =
          typeof walletStakeAddress === 'string'
            ? walletStakeAddress
            : wallet?.startsWith('stake1')
              ? wallet
              : null;

        if (stakeAddress) {
          const currentUrl = request.headers.get('referer') ?? undefined;
          const stakeRegistered = stakeRegisteredFromEntry(latestEntry);
          delegationDistinctId = stakeAddress;
          delegationPayload = {
            drep_id: drepId,
            previous_drep_id: drepIdFromEntry(previousLatestEntry) ?? null,
            tx_hash: txHash,
            ...(stakeRegistered !== undefined ? { stake_registered: stakeRegistered } : {}),
            mode: 'mainnet',
            $current_url: currentUrl,
            $host: hostFromUrl(currentUrl) ?? request.headers.get('host') ?? undefined,
          };
        } else {
          logger.warn('Skipping delegation telemetry without a resolved stake address', {
            context: 'user',
            userId,
          });
        }
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update(sanitizedUpdates)
      .eq('id', userId!)
      .select()
      .single();

    if (error) {
      logger.error('User update error', { context: 'user', error: error?.message });
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    if (delegationPayload && delegationDistinctId) {
      captureServerEvent('delegation_completed', delegationPayload, delegationDistinctId);
      captureServerEvent('delegated', delegationPayload, delegationDistinctId);
    }

    return NextResponse.json(data as SupabaseUser);
  },
  { auth: 'required' },
);
