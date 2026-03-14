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
import { logger } from '@/lib/logger';

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
  | 'platform-announcement'
  | 'tier-change'
  | 'spo-tier-change'
  | 'alignment-drift'
  | 'delegation-milestone'
  | 'spo-inactivity'
  | 'competitive-movement'
  | 'engagement-outcome';

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
  userId: string;
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
    logger.error('[Notifications] Discord webhook failed', {
      error: e instanceof Error ? e.message : e,
    });
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
    logger.error('[Notifications] Telegram send failed', {
      error: e instanceof Error ? e.message : e,
    });
    return false;
  }
}

type ChannelSender = (target: ChannelTarget, payload: NotificationPayload) => Promise<boolean>;

const CHANNEL_SENDERS: Record<Channel, ChannelSender> = {
  discord: (target, payload) => sendDiscordWebhook(target.channelIdentifier, payload),
  telegram: (target, payload) => sendTelegramMessage(target.channelIdentifier, payload),
  push: (target, payload) => sendPushToUser(target.userId, payload),
  email: async (_payload) => {
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
  userId: string,
  event: NotificationEvent | NotificationPayload,
): Promise<void> {
  const payload = toPayload(event);
  const supabase = getSupabaseAdmin();

  // Persist to inbox (DB) regardless of channel preferences — inbox is always-on
  await persistToInbox(supabase, userId, payload);

  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('channel')
    .eq('user_id', userId)
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
      userId,
    };
    const sent = await CHANNEL_SENDERS.push(target, payload);
    await logAndTrack(supabase, userId, payload, 'push', sent);
  }

  if (emailEnabled) {
    enabledChannels.delete('email');
    const target: ChannelTarget = {
      channel: 'email',
      channelIdentifier: '',
      config: {},
      userId,
    };
    const sent = await CHANNEL_SENDERS.email(target, payload);
    await logAndTrack(supabase, userId, payload, 'email', sent);
  }

  // Discord and Telegram still use user_channels for identifiers
  if (enabledChannels.size > 0) {
    const { data: channels } = await supabase
      .from('user_channels')
      .select('*')
      .eq('user_id', userId);

    if (channels) {
      for (const ch of channels) {
        if (!enabledChannels.has(ch.channel as Channel)) continue;

        const sender = CHANNEL_SENDERS[ch.channel as Channel];
        if (!sender) continue;

        const target: ChannelTarget = {
          channel: ch.channel,
          channelIdentifier: ch.channel_identifier,
          config: ch.config || {},
          userId,
        };

        const sent = await sender(target, payload);
        await logAndTrack(supabase, userId, payload, ch.channel, sent);
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
    .select('user_id, channel')
    .eq('event_type', payload.eventType)
    .eq('enabled', true);

  if (!prefs || prefs.length === 0) return 0;

  const userIds = new Set(prefs.map((p) => p.user_id));
  let sent = 0;
  for (const uid of userIds) {
    await notifyUser(uid, payload);
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
  | { type: 'custom'; userIds: string[] };

async function resolveSegment(segment: SegmentQuery): Promise<string[]> {
  const supabase = getSupabaseAdmin();

  switch (segment.type) {
    case 'custom':
      return segment.userIds;

    case 'claimed-dreps': {
      const { data } = await supabase.from('users').select('id').not('claimed_drep_id', 'is', null);
      return (data || []).map((u) => u.id);
    }

    case 'active-holders': {
      const days = segment.sinceDays ?? 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data } = await supabase.from('users').select('id').gte('last_active', since);
      return (data || []).map((u) => u.id);
    }

    case 'watching': {
      const { data } = await supabase
        .from('users')
        .select('id, watchlist')
        .not('watchlist', 'is', null);
      return (data || [])
        .filter((u) => Array.isArray(u.watchlist) && u.watchlist.includes(segment.drepId))
        .map((u) => u.id);
    }

    case 'delegated-to': {
      // Users whose most recent delegation_history entry matches drepId
      const { data } = await supabase
        .from('users')
        .select('id, delegation_history')
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
        .map((u) => u.id);
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
  const userIds = await resolveSegment(segment);
  let sent = 0;
  for (const uid of userIds) {
    await notifyUser(uid, event);
    sent++;
  }
  return sent;
}

// ── Inbox Persistence ───────────────────────────────────────────────────────

/**
 * Resolve a userId to a stake address via user_wallets (primary) or users table (legacy).
 * Returns null if no stake address is found — the notification still sends to channels
 * but won't appear in the inbox.
 */
async function resolveStakeAddress(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
): Promise<string | null> {
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('stake_address')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (wallet?.stake_address) return wallet.stake_address;

  const { data: user } = await supabase
    .from('users')
    .select('wallet_address')
    .eq('id', userId)
    .maybeSingle();

  if (!user?.wallet_address) return null;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_KOIOS_BASE_URL || 'https://api.koios.rest/api/v1'}/address_info`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _addresses: [user.wallet_address] }),
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.[0]?.stake_address) return data[0].stake_address as string;
    }
  } catch {
    // Non-critical — inbox persistence degrades gracefully
  }

  return null;
}

/**
 * Persist a notification to the inbox (notifications table) so users can
 * see it in the /you/inbox UI. Called once per notifyUser() invocation,
 * not once per channel.
 */
async function persistToInbox(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  try {
    const stakeAddress = await resolveStakeAddress(supabase, userId);
    if (!stakeAddress) {
      logger.warn('[Notifications] Cannot persist to inbox — no stake address for user', {
        userId,
      });
      return;
    }

    // Deduplicate: skip if an unread notification of the same type was created within 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_stake_address', stakeAddress)
      .eq('type', payload.eventType)
      .eq('read', false)
      .gte('created_at', cutoff)
      .limit(1);

    if (existing && existing.length > 0) return;

    await supabase.from('notifications').insert({
      user_stake_address: stakeAddress,
      type: payload.eventType,
      title: payload.fallback?.title ?? payload.eventType,
      body: payload.fallback?.body ?? null,
      action_url: payload.fallback?.url ?? null,
      metadata: payload.metadata ?? payload.data ?? null,
    });
  } catch (e) {
    logger.error('[Notifications] Failed to persist to inbox', {
      userId,
      error: e instanceof Error ? e.message : e,
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function logAndTrack(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
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
    userId,
  );

  await supabase.from('notification_log').insert({
    user_id: userId,
    event_type: payload.eventType,
    channel,
    payload: { ...payload.metadata, sent },
  });
}
