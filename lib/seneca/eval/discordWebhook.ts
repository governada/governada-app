import { captureServerEvent } from '@/lib/posthog-server';

export const SENECA_DRIFT_AMBER = 0xff7f00;
export const SENECA_CALIBRATION_RED = 0xff0000;
export const SENECA_EVAL_AVATAR_URL = 'https://governada.io/icons/icon-192.png';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordAlertInput {
  title: string;
  description: string;
  color: number;
  fields: DiscordEmbedField[];
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  username: 'Seneca Eval';
  avatar_url: string;
  embeds: [
    {
      title: string;
      description: string;
      color: number;
      fields: DiscordEmbedField[];
      timestamp: string;
    },
  ];
}

export interface AlertDeliveryResult {
  delivered: boolean;
  fallback: 'none' | 'posthog';
  reason?: string;
}

export function buildDiscordWebhookPayload(input: DiscordAlertInput): DiscordWebhookPayload {
  return {
    username: 'Seneca Eval',
    avatar_url: SENECA_EVAL_AVATAR_URL,
    embeds: [
      {
        title: input.title,
        description: input.description,
        color: input.color,
        fields: input.fields,
        timestamp: input.timestamp ?? new Date().toISOString(),
      },
    ],
  };
}

export async function sendDiscordWebhookAlert(
  input: DiscordAlertInput,
  webhookUrl = process.env.SENECA_DRIFT_DISCORD_WEBHOOK,
): Promise<AlertDeliveryResult> {
  if (!webhookUrl) {
    captureServerEvent('seneca_drift_alert', toPostHogProperties(input, 'missing_webhook'));
    return { delivered: false, fallback: 'posthog', reason: 'missing_webhook' };
  }

  if (!isDiscordWebhookUrl(webhookUrl)) {
    captureServerEvent('seneca_drift_alert', toPostHogProperties(input, 'invalid_webhook'));
    return { delivered: false, fallback: 'posthog', reason: 'invalid_webhook' };
  }

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildDiscordWebhookPayload(input)),
    });
  } catch {
    captureServerEvent('seneca_drift_alert', toPostHogProperties(input, 'webhook_failed'));
    return { delivered: false, fallback: 'posthog', reason: 'webhook_failed' };
  }

  if (response.status !== 204) {
    captureServerEvent('seneca_drift_alert', {
      ...toPostHogProperties(input, 'webhook_failed'),
      status: response.status,
    });
    return { delivered: false, fallback: 'posthog', reason: `webhook_${response.status}` };
  }

  return { delivered: true, fallback: 'none' };
}

function isDiscordWebhookUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'discord.com' || url.hostname === 'discordapp.com') &&
      /^\/api\/webhooks\/[^/]+\/[^/]+$/u.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function toPostHogProperties(input: DiscordAlertInput, reason: string): Record<string, unknown> {
  return {
    title: input.title,
    description: input.description,
    color: input.color,
    reason,
    fields: input.fields,
  };
}
