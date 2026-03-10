/**
 * Push Notification Admin/Debug API
 * Thin wrapper around lib/push.ts for manual testing.
 * Production notifications go through the unified notification engine.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendPushBroadcast, buildPushPayload } from '@/lib/push';
import { getSupabaseAdmin } from '@/lib/supabase';
import { type NotificationPayload } from '@/lib/channelRenderers';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { PushSendSchema } from '@/lib/api/schemas/user';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = PushSendSchema.parse(await request.json());
    const { type } = body;

    const supabase = getSupabaseAdmin();

    const { data: users } = await supabase
      .from('users')
      .select('id, wallet_address, push_subscriptions, claimed_drep_id')
      .not('push_subscriptions', 'eq', '{}');

    if (!users || users.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No subscribed users' });
    }

    const subscribedUsers = users.filter(
      (u) => u.push_subscriptions?.endpoint && u.push_subscriptions?.keys,
    );

    let payload: NotificationPayload;
    let targetIds = subscribedUsers.map((u) => u.id as string);

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
            url: txHash ? `/proposal/${txHash}/${index || 0}` : '/governance/proposals',
          },
        };
        break;
      }

      case 'drep-pending-proposals': {
        const { pendingCount, criticalCount } = body;

        targetIds = subscribedUsers.filter((u) => u.claimed_drep_id).map((u) => u.id as string);
        payload = {
          eventType: 'pending-proposals',
          fallback: {
            title:
              criticalCount && criticalCount > 0
                ? `${criticalCount} critical proposal${criticalCount !== 1 ? 's' : ''} need your vote`
                : `${pendingCount} proposal${pendingCount !== 1 ? 's' : ''} awaiting your vote`,
            body: 'Open your DRep dashboard to review and vote.',
            url: '/my-gov/inbox',
          },
        };
        break;
      }

      case 'test': {
        payload = {
          eventType: 'platform-announcement',
          fallback: {
            title: 'Governada Test Notification',
            body: 'Push notifications are working!',
            url: '/',
          },
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    buildPushPayload(payload);

    const result = await sendPushBroadcast(targetIds, payload);
    return NextResponse.json({
      sent: result.sent,
      expired: result.expired,
      total: targetIds.length,
    });
  },
  { auth: 'none', rateLimit: { max: 10, window: 60 } },
);
