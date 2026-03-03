/**
 * Notification Engine — registry-driven, channel-agnostic event routing.
 * Supports: push, email, discord, telegram.
 *
 * Architecture:
 *   1. Event Registry (notificationRegistry.ts) defines all event types
 *   2. Channel Renderers (channelRenderers.ts) produce per-channel content
 *   3. This module routes payloads to the right channels for the right users
 *
 * Three routing modes:
 *   - notifyUser(): send to one user's enabled channels
 *   - broadcastEvent(): send to all users with the event type enabled
 *   - notifySegment(): send to a computed user segment
 */
import { captureServerEvent } from '@/lib/posthog-server';

import { type NotificationPayload, renderDiscord, renderTelegram } from './channelRenderers';
import { type Channel } from './notificationRegistry';
import { sendPushToUser } from './push';
import { getSupabaseAdmin } from './supabase';

// Re-export types for backward compatibility and convenience
export type { NotificationPayload } from './channelRenderers';
export type { Channel } from './notificationRegistry';

/**
 * @deprecated Use NotificationPayload instead. Kept for backward compat with
 * existing callers (check-notifications, etc.) — they can pass this directly
 * and it maps to NotificationPayload.fallback.
 */
export type EventType =
  | 'score-change'
  | 'pending-proposals'
  | 'urgent-deadline'
  | 'delegation-change'
  | 'critical-proposal-open'
  | 'profile-view'
  | 'api-health-alert'
  | 'delegator-growth'
  | 'rank-change'
  | 'near-milestone'
  | 'proposal-deadline'
  | 'score-opportunity'
  | 'treasury-health-alert'
  | 'treasury-proposal-new'
  | 'treasury-accountability-open'
  | 'governance-brief'
  | 'rationale-reminder'
  | 'delegator-sentiment-diverge'
  | 'competitive-threat'
  | 'accountability-result'
  | 'profile-view-spike'
  | 'drep-voted'
  | 'drep-score-change'
  | 'drep-missed-vote'
  | 'drep-inactive'
  | 'representation-drop'
  | 'better-match-found'
  | 'citizen-level-up'
  | 'delegation-anniversary'
  | 'poll-deadline'
  | 'watchlist-alert'
  | 'governance-pattern-alert'
  | 'platform-announcement';

/** @deprecated Use NotificationPayload instead */
export interface NotificationEvent {
  eventType: EventType;
  title: string;
  body: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelTarget {
  channel: Channel;
  channelIdentifier: string;
  config: Record<string, unknown>;
  userWallet: string;
}

/** Convert legacy NotificationEvent to NotificationPayload */
function toPayload(event: NotificationEvent | NotificationPayload): NotificationPayload {
  if ('fallback' in event) return event;
  return {
    eventType: event.eventType,
    data: event.metadata,
    fallback: { title: event.title, body: event.body, url: event.url },
    metadata: event.metadata,
  };
}

// ── Channel Senders ─────────────────────────────────────────────────────────

async function sendDiscordWebhook(
  webhookUrl: string,
  payload: NotificationPayload,
): Promise<boolean> {
  try {
    const content = renderDiscord(payload);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error('[Notifications] Discord webhook failed:', e instanceof Error ? e.message : e);
    return false;
  }
}

async function sendTelegramMessage(chatId: string, payload: NotificationPayload): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return false;

  try {
    const content = renderTelegram(payload);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: content.text,
        parse_mode: content.parseMode,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (e) {
    console.error('[Notifications] Telegram send failed:', e instanceof Error ? e.message : e);
    return false;
  }
}

type ChannelSender = (target: ChannelTarget, payload: NotificationPayload) => Promise<boolean>;

const CHANNEL_SENDERS: Record<Channel, ChannelSender> = {
  discord: (target, payload) => sendDiscordWebhook(target.channelIdentifier, payload),
  telegram: (target, payload) => sendTelegramMessage(target.channelIdentifier, payload),
  push: (target, payload) => sendPushToUser(target.userWallet, payload),
  email: async (_target, _payload) => {
    // Wired in Phase 2 via lib/email.ts
    return false;
  },
};

/** Replace a channel sender at runtime (used by email.ts to wire itself in) */
export function registerChannelSender(channel: Channel, sender: ChannelSender): void {
  CHANNEL_SENDERS[channel] = sender;
}

// ── Core Router ─────────────────────────────────────────────────────────────

/**
 * Send a notification to all subscribed channels for a user.
 * Accepts both legacy NotificationEvent and new NotificationPayload.
 */
export async function notifyUser(
  userWallet: string,
  event: NotificationEvent | NotificationPayload,
): Promise<void> {
  const payload = toPayload(event);
  const supabase = getSupabaseAdmin();

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('channel')
    .eq('user_wallet', userWallet)
    .eq('event_type', payload.eventType)
    .eq('enabled', true);

  if (!prefs || prefs.length === 0) return;

  const enabledChannels = new Set(prefs.map((p) => p.channel as Channel));

  // For push and email, we don't require a user_channels entry —
  // push reads users.push_subscriptions, email reads users.email
  const pushEnabled = enabledChannels.has('push');
  const emailEnabled = enabledChannels.has('email');

  if (pushEnabled) {
    enabledChannels.delete('push');
    const target: ChannelTarget = {
      channel: 'push',
      channelIdentifier: '',
      config: {},
      userWallet,
    };
    const sent = await CHANNEL_SENDERS.push(target, payload);
    await logAndTrack(supabase, userWallet, payload, 'push', sent);
  }

  if (emailEnabled) {
    enabledChannels.delete('email');
    const target: ChannelTarget = {
      channel: 'email',
      channelIdentifier: '',
      config: {},
      userWallet,
    };
    const sent = await CHANNEL_SENDERS.email(target, payload);
    await logAndTrack(supabase, userWallet, payload, 'email', sent);
  }

  // Discord and Telegram still use user_channels for identifiers
  if (enabledChannels.size > 0) {
    const { data: channels } = await supabase
      .from('user_channels')
      .select('*')
      .eq('user_wallet', userWallet);

    if (channels) {
      for (const ch of channels) {
        if (!enabledChannels.has(ch.channel as Channel)) continue;

        const sender = CHANNEL_SENDERS[ch.channel as Channel];
        if (!sender) continue;

        const target: ChannelTarget = {
          channel: ch.channel,
          channelIdentifier: ch.channel_identifier,
          config: ch.config || {},
          userWallet,
        };

        const sent = await sender(target, payload);
        await logAndTrack(supabase, userWallet, payload, ch.channel, sent);
      }
    }
  }
}

/**
 * Broadcast an event to a Discord webhook (server-wide, not per-user).
 */
export async function broadcastDiscord(
  event: NotificationEvent | NotificationPayload,
): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return false;
  return sendDiscordWebhook(webhookUrl, toPayload(event));
}

/**
 * Send notifications to all users who have a specific event type enabled on any channel.
 */
export async function broadcastEvent(
  event: NotificationEvent | NotificationPayload,
): Promise<number> {
  const payload = toPayload(event);
  const supabase = getSupabaseAdmin();

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('user_wallet, channel')
    .eq('event_type', payload.eventType)
    .eq('enabled', true);

  if (!prefs || prefs.length === 0) return 0;

  const wallets = new Set(prefs.map((p) => p.user_wallet));
  let sent = 0;
  for (const wallet of wallets) {
    await notifyUser(wallet, payload);
    sent++;
  }

  return sent;
}

// ── Segment Targeting ─────────────────────────────────────────────────────────

export type SegmentQuery =
  | { type: 'delegated-to'; drepId: string }
  | { type: 'watching'; drepId: string }
  | { type: 'claimed-dreps' }
  | { type: 'active-holders'; sinceDays?: number }
  | { type: 'citizen-level-min'; level: string }
  | { type: 'custom'; wallets: string[] };

async function resolveSegment(segment: SegmentQuery): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  switch (segment.type) {
    case 'custom':
      return segment.wallets;

    case 'claimed-dreps': {
      const { data } = await supabase
        .from('users')
        .select('wallet_address')
        .not('claimed_drep_id', 'is', null);
      return (data || []).map((u) => u.wallet_address);
    }

    case 'active-holders': {
      const days = segment.sinceDays ?? 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase
        .from('users')
        .select('wallet_address')
        .gte('last_active', since);
      return (data || []).map((u) => u.wallet_address);
    }

    case 'watching': {
      const { data } = await supabase
        .from('users')
        .select('wallet_address, watchlist')
        .not('watchlist', 'is', null);
      return (data || [])
        .filter((u) => Array.isArray(u.watchlist) && u.watchlist.includes(segment.drepId))
        .map((u) => u.wallet_address);
    }

    case 'delegated-to': {
      // Users whose most recent delegation_history entry matches drepId
      const { data } = await supabase
        .from('users')
        .select('wallet_address, delegation_history')
        .not('delegation_history', 'is', null);
      return (data || [])
        .filter((u) => {
          const history = u.delegation_history as Array<{ drepId: string }>;
          return (
            Array.isArray(history) &&
            history.length > 0 &&
            history[history.length - 1].drepId === segment.drepId
          );
        })
        .map((u) => u.wallet_address);
    }

    case 'citizen-level-min':
      // Placeholder — will be implemented when citizen levels are added (Session 11)
      return [];
  }
}

/**
 * Send notifications to a computed user segment.
 */
export async function notifySegment(
  segment: SegmentQuery,
  event: NotificationEvent | NotificationPayload,
): Promise<number> {
  const wallets = await resolveSegment(segment);
  let sent = 0;
  for (const wallet of wallets) {
    await notifyUser(wallet, event);
    sent++;
  }
  return sent;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function logAndTrack(
  supabase: any,
  wallet: string,
  payload: NotificationPayload,
  channel: string,
  sent: boolean,
) {
  captureServerEvent(
    'notification_sent',
    {
      channel,
      event_type: payload.eventType,
      delivered: sent,
    },
    wallet,
  );

  await supabase.from('notification_log').insert({
    user_wallet: wallet,
    event_type: payload.eventType,
    channel,
    payload: { ...payload.metadata, sent },
  });
}
