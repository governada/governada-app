type FounderNotificationLevel = 'escalation' | 'info';

type FounderNotificationRequest = {
  level: FounderNotificationLevel;
  title: string;
  details: string;
};

type FounderNotificationResult = {
  ok: boolean;
  channels: string[];
  channelCount: number;
  failureReason?: string;
};

type AlertConfig = {
  prefix: string;
  color: number;
  action: string;
  urgency: string;
};

const ALERT_CONFIG: Record<FounderNotificationLevel, AlertConfig> = {
  escalation: {
    prefix: '[ESCALATION]',
    color: 16744448,
    action: 'Review the systems cockpit follow-ups and close the critical gap.',
    urgency: 'CRITICAL SYSTEM FOLLOW-UP OPEN',
  },
  info: {
    prefix: '[INFO]',
    color: 5814783,
    action: 'Review the results at your convenience.',
    urgency: 'INFO',
  },
};

function utcTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendFounderNotification(
  input: FounderNotificationRequest,
): Promise<FounderNotificationResult> {
  const config = ALERT_CONFIG[input.level];
  const timestamp = utcTimestamp();
  const channels: string[] = [];
  const failureReasons: string[] = [];

  const discordUrl = process.env.DISCORD_AGENT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    const response = await postWithTimeout(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${config.prefix} ${input.title}`,
            color: config.color,
            footer: { text: `Governada Agent - ${timestamp}` },
            fields: [
              { name: 'Status', value: config.urgency, inline: true },
              { name: 'Details', value: input.details, inline: false },
              { name: 'Next Step', value: config.action, inline: false },
            ],
          },
        ],
      }),
    }).catch(() => null);

    if (response && (response.status === 200 || response.status === 204)) {
      channels.push('discord');
    } else {
      failureReasons.push(`Discord failed (${response?.status ?? 'network'})`);
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_FOUNDER_CHAT_ID) {
    const text = [
      `${config.prefix} ${input.title}`,
      config.urgency,
      input.details,
      `Next: ${config.action}`,
      `Governada Agent - ${timestamp}`,
    ].join('\n\n');

    const response = await postWithTimeout(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_FOUNDER_CHAT_ID,
          text,
        }),
      },
    ).catch(() => null);

    if (response?.ok) {
      channels.push('telegram');
    } else {
      failureReasons.push(`Telegram failed (${response?.status ?? 'network'})`);
    }
  }

  if (channels.length === 0) {
    if (failureReasons.length === 0) {
      failureReasons.push('No founder notification channels configured');
    }

    return {
      ok: false,
      channels: [],
      channelCount: 0,
      failureReason: failureReasons.join('; '),
    };
  }

  return {
    ok: true,
    channels,
    channelCount: channels.length,
    failureReason: failureReasons.length > 0 ? failureReasons.join('; ') : undefined,
  };
}
