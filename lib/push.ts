/**
 * Push Notification Sender — extracted from app/api/push/send/route.ts
 *
 * Reads push subscriptions from users.push_subscriptions (not user_channels)
 * and sends via web-push. Called by the notification engine's push channel sender.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push');

import { type NotificationPayload } from './channelRenderers';
import { getSupabaseAdmin } from './supabase';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:hello@drepscore.com';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

async function sendToSubscription(
  subscription: PushSubscription,
  payload: PushPayload,
): Promise<{ success: boolean; expired?: boolean }> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 86400 });
    return { success: true };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      return { success: false, expired: true };
    }
    console.error('[Push] Send error:', statusCode, (err as Error)?.message);
    return { success: false };
  }
}

export function buildPushPayload(payload: NotificationPayload): PushPayload {
  return {
    title: payload.fallback.title,
    body: payload.fallback.body,
    url: payload.fallback.url,
    tag: payload.eventType,
  };
}

/**
 * Send a push notification to a single user by wallet address.
 * Reads their push_subscriptions from the users table.
 */
export async function sendPushToUser(
  walletAddress: string,
  payload: NotificationPayload,
): Promise<boolean> {
  if (!ensureVapid()) return false;

  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from('users')
    .select('push_subscriptions')
    .eq('wallet_address', walletAddress)
    .single();

  if (!user?.push_subscriptions?.endpoint || !user?.push_subscriptions?.keys) {
    return false;
  }

  const pushPayload = buildPushPayload(payload);
  const result = await sendToSubscription(user.push_subscriptions, pushPayload);

  if (result.expired) {
    await supabase
      .from('users')
      .update({ push_subscriptions: {} })
      .eq('wallet_address', walletAddress);
  }

  return result.success;
}

/**
 * Send push notifications to multiple users.
 * Returns the count of successful sends.
 */
export async function sendPushBroadcast(
  walletAddresses: string[],
  payload: NotificationPayload,
): Promise<{ sent: number; expired: number }> {
  if (!ensureVapid()) return { sent: 0, expired: 0 };

  const supabase = getSupabaseAdmin();
  const { data: users } = await supabase
    .from('users')
    .select('wallet_address, push_subscriptions')
    .in('wallet_address', walletAddresses)
    .not('push_subscriptions', 'eq', '{}');

  if (!users || users.length === 0) return { sent: 0, expired: 0 };

  const pushPayload = buildPushPayload(payload);
  let sent = 0;
  let expired = 0;
  const expiredAddresses: string[] = [];

  for (const user of users) {
    if (!user.push_subscriptions?.endpoint || !user.push_subscriptions?.keys) continue;
    const result = await sendToSubscription(user.push_subscriptions, pushPayload);
    if (result.success) sent++;
    if (result.expired) {
      expired++;
      expiredAddresses.push(user.wallet_address);
    }
  }

  if (expiredAddresses.length > 0) {
    for (const addr of expiredAddresses) {
      await supabase.from('users').update({ push_subscriptions: {} }).eq('wallet_address', addr);
    }
  }

  return { sent, expired };
}
