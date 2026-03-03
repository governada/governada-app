/**
 * Push Notification Admin/Debug API
 * Thin wrapper around lib/push.ts for manual testing.
 * Production notifications go through the unified notification engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendPushBroadcast, buildPushPayload } from '@/lib/push';
import { getSupabaseAdmin } from '@/lib/supabase';
import { type NotificationPayload } from '@/lib/channelRenderers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body as { type: string };

    const supabase = getSupabaseAdmin();

    const { data: users } = await supabase
      .from('users')
      .select('wallet_address, push_subscriptions, claimed_drep_id')
      .not('push_subscriptions', 'eq', '{}');

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscribed users' });
    }

    const subscribedUsers = users.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => u.push_subscriptions?.endpoint && u.push_subscriptions?.keys,
    );

    let payload: NotificationPayload;
    let targetAddresses = subscribedUsers.map((u) => u.wallet_address);

    switch (type) {
      case 'critical-proposal-open': {
        const { proposalTitle, txHash, index } = body;
        payload = {
          eventType: 'critical-proposal-open',
          fallback: {
            title: 'Critical Governance Proposal',
            body: proposalTitle
              ? `"${proposalTitle}" is open for voting. This is a high-impact proposal.`
              : 'A critical governance proposal is now open for voting.',
            url: txHash ? `/proposals/${txHash}/${index || 0}` : '/proposals',
          },
        };
        break;
      }

      case 'drep-pending-proposals': {
        const { pendingCount, criticalCount } = body;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        targetAddresses = subscribedUsers
          .filter((u: any) => u.claimed_drep_id)
          .map((u) => u.wallet_address);
        payload = {
          eventType: 'pending-proposals',
          fallback: {
            title:
              criticalCount > 0
                ? `${criticalCount} critical proposal${criticalCount !== 1 ? 's' : ''} need your vote`
                : `${pendingCount} proposal${pendingCount !== 1 ? 's' : ''} awaiting your vote`,
            body: 'Open your DRep dashboard to review and vote.',
            url: '/dashboard/inbox',
          },
        };
        break;
      }

      case 'test': {
        payload = {
          eventType: 'platform-announcement',
          fallback: {
            title: 'DRepScore Test Notification',
            body: 'Push notifications are working!',
            url: '/',
          },
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    // Use buildPushPayload to verify the payload structure is correct
    buildPushPayload(payload);

    const result = await sendPushBroadcast(targetAddresses, payload);
    return NextResponse.json({
      sent: result.sent,
      expired: result.expired,
      total: targetAddresses.length,
    });
  } catch (err) {
    console.error('[Push API] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
