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

// ── Event-Specific Content Builders ───────────────────────────────────────────

function buildTierChangeContent(data: Record<string, unknown>): { title: string; body: string } {
  const entity = data.entityType === 'spo' ? 'Pool' : 'DRep';
  const direction = data.direction === 'up' ? '↑' : '↓';
  return {
    title: `${entity} Tier ${direction} ${data.newTier}`,
    body: `Your governance tier changed from ${data.oldTier} to ${data.newTier} (score: ${data.newScore})`,
  };
}

function buildDriftContent(data: Record<string, unknown>): { title: string; body: string } {
  return {
    title: 'Alignment Drift Detected',
    body: `Your DRep has drifted ${data.driftScore} points from your governance values. ${data.classification === 'high' ? 'Consider reviewing alternative matches.' : 'Keep an eye on this.'}`,
  };
}

function buildCompetitiveContent(data: Record<string, unknown>): { title: string; body: string } {
  return {
    title: 'Competitive Movement',
    body: `${data.competitorTicker ?? 'A nearby pool'} just passed your pool in governance score.`,
  };
}

const CONTENT_BUILDERS: Record<
  string,
  (data: Record<string, unknown>) => { title: string; body: string }
> = {
  'tier-change': buildTierChangeContent,
  'spo-tier-change': buildTierChangeContent,
  'alignment-drift': buildDriftContent,
  'competitive-movement': buildCompetitiveContent,
};

function resolveContent(payload: NotificationPayload): {
  title: string;
  body: string;
  url?: string;
} {
  const builder = CONTENT_BUILDERS[payload.eventType];
  if (builder && payload.data) {
    const { title, body } = builder(payload.data);
    return { title, body, url: payload.fallback.url };
  }
  return payload.fallback;
}

// ── Per-Channel Renderers ─────────────────────────────────────────────────────

export function renderPush(payload: NotificationPayload): PushContent {
  const content = resolveContent(payload);
  return {
    title: content.title,
    body: content.body,
    url: content.url,
    tag: payload.eventType,
  };
}

export function renderDiscord(payload: NotificationPayload): DiscordContent {
  const content = resolveContent(payload);
  const color = getEventColor(payload.eventType);
  return {
    embeds: [
      {
        title: content.title,
        description: content.body,
        color,
        url: content.url,
        footer: { text: 'Civica' },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function renderTelegram(payload: NotificationPayload): TelegramContent {
  const content = resolveContent(payload);
  let text = `*${escapeMarkdown(content.title)}*\n${escapeMarkdown(content.body)}`;
  if (content.url) text += `\n[View on Civica](${content.url})`;
  return { text, parseMode: 'MarkdownV2' };
}

export function renderEmail(payload: NotificationPayload): {
  subject: string;
  data: Record<string, unknown>;
} {
  const content = resolveContent(payload);
  return {
    subject: content.title,
    data: {
      ...payload.data,
      title: content.title,
      body: content.body,
      url: content.url,
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
