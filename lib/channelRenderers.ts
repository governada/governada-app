/**
 * Channel Renderers — produce channel-optimized content from notification payloads.
 *
 * Each channel gets content tailored to its format:
 *   - Push: compact title + body (2 lines max)
 *   - Email: full branded HTML via React Email (added in Phase 2)
 *   - Discord: rich embeds with color coding
 *   - Telegram: MarkdownV2 formatted text
 *
 * Renderers use structured `data` when available, falling back to `fallback`
 * for backward compatibility with existing callers.
 */

import { type Channel, getEventColor } from './notificationRegistry';

export interface NotificationPayload {
  eventType: string;
  data?: Record<string, unknown>;
  fallback: { title: string; body: string; url?: string };
  metadata?: Record<string, unknown>;
}

export interface PushContent {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface DiscordContent {
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    url?: string;
    footer: { text: string };
    timestamp: string;
  }>;
}

export interface TelegramContent {
  text: string;
  parseMode: 'MarkdownV2';
}

export type RenderedContent = {
  push?: PushContent;
  email?: { subject: string; data: Record<string, unknown> };
  discord?: DiscordContent;
  telegram?: TelegramContent;
};

function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

// ── Per-Channel Renderers ─────────────────────────────────────────────────────

export function renderPush(payload: NotificationPayload): PushContent {
  return {
    title: payload.fallback.title,
    body: payload.fallback.body,
    url: payload.fallback.url,
    tag: payload.eventType,
  };
}

export function renderDiscord(payload: NotificationPayload): DiscordContent {
  const color = getEventColor(payload.eventType);
  return {
    embeds: [
      {
        title: payload.fallback.title,
        description: payload.fallback.body,
        color,
        url: payload.fallback.url,
        footer: { text: 'DRepScore' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function renderTelegram(payload: NotificationPayload): TelegramContent {
  let text = `*${escapeMarkdown(payload.fallback.title)}*\n${escapeMarkdown(payload.fallback.body)}`;
  if (payload.fallback.url) text += `\n[View on DRepScore](${payload.fallback.url})`;
  return { text, parseMode: 'MarkdownV2' };
}

export function renderEmail(payload: NotificationPayload): {
  subject: string;
  data: Record<string, unknown>;
} {
  return {
    subject: payload.fallback.title,
    data: {
      ...payload.data,
      title: payload.fallback.title,
      body: payload.fallback.body,
      url: payload.fallback.url,
      eventType: payload.eventType,
    },
  };
}

// ── Unified Render ────────────────────────────────────────────────────────────

const RENDERERS: Record<Channel, (payload: NotificationPayload) => unknown> = {
  push: renderPush,
  email: renderEmail,
  discord: renderDiscord,
  telegram: renderTelegram,
};

export function renderForChannel<C extends Channel>(
  channel: C,
  payload: NotificationPayload,
): RenderedContent[C] {
  const renderer = RENDERERS[channel];
  return renderer(payload) as RenderedContent[C];
}
