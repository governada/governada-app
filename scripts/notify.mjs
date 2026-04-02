import { fetchWithTimeout, loadLocalEnv, requireArg, utcTimestamp } from './lib/runtime.mjs';

loadLocalEnv(import.meta.url, [
  'DISCORD_AGENT_WEBHOOK_URL',
  'DISCORD_WEBHOOK_URL',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_FOUNDER_CHAT_ID',
]);

const args = process.argv.slice(2);
const alertType = requireArg(args, 0, 'notify.mjs <alert_type> <title> [details]');
const title = requireArg(args, 1, 'notify.mjs <alert_type> <title> [details]');
const details = args[2] ?? '';

if (process.env.NOTIFY_DISABLED === '1') {
  console.log(`Notifications disabled. Would have sent: [${alertType}] ${title} -- ${details}`);
  process.exit(0);
}

const alertConfig = {
  decision_gate: {
    prefix: '[PAUSE]',
    color: 16776960,
    action: 'Review the proposed plan and approve or request changes.',
    urgency: 'WAITING FOR YOUR INPUT',
  },
  deploy_blocked: {
    prefix: '[BLOCKED]',
    color: 16711680,
    action: 'Check the error details and decide how to proceed.',
    urgency: 'DEPLOY HALTED - ACTION REQUIRED',
  },
  escalation: {
    prefix: '[ESCALATE]',
    color: 16744448,
    action: 'Agent hit an unexpected situation and needs your guidance.',
    urgency: 'AGENT BLOCKED - NEEDS GUIDANCE',
  },
  complete: {
    prefix: '[DONE]',
    color: 5763719,
    action: 'Review the results at your convenience.',
    urgency: 'COMPLETED',
  },
  info: {
    prefix: '[INFO]',
    color: 5814783,
    action: 'No immediate action required.',
    urgency: 'INFO',
  },
};

const { prefix, color, action, urgency } = alertConfig[alertType] ?? alertConfig.info;
const timestamp = utcTimestamp();
let sent = 0;

const discordUrl = process.env.DISCORD_AGENT_WEBHOOK_URL ?? process.env.DISCORD_WEBHOOK_URL;

if (discordUrl) {
  const fields = [{ name: 'Status', value: urgency, inline: true }];

  if (details) {
    fields.push({ name: 'Details', value: details, inline: false });
  }

  fields.push({ name: 'Next Step', value: action, inline: false });

  const response = await fetchWithTimeout(
    discordUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${prefix} ${title}`,
            color,
            footer: { text: `Governada Agent | ${timestamp}` },
            fields,
          },
        ],
      }),
    },
    10000,
  ).catch(() => null);

  if (response && (response.status === 200 || response.status === 204)) {
    console.log(`Discord: sent (${alertType})`);
    sent += 1;
  } else {
    console.log(`Discord: failed (HTTP ${response?.status ?? '000'})`);
  }
}

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_FOUNDER_CHAT_ID) {
  const telegramText = [
    `${prefix} ${title}`,
    urgency,
    details || null,
    `Next: ${action}`,
    `Governada Agent | ${timestamp}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await fetchWithTimeout(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_FOUNDER_CHAT_ID,
        text: telegramText,
      }),
    },
    10000,
  ).catch(() => null);

  if (response?.ok) {
    console.log(`Telegram: sent (${alertType})`);
    sent += 1;
  } else {
    console.log(`Telegram: failed (HTTP ${response?.status ?? '000'})`);
  }
}

if (sent === 0) {
  console.log('WARNING: No notification channels configured or all failed.');
  console.log('Set DISCORD_AGENT_WEBHOOK_URL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID');
  process.exit(1);
}

console.log(`Notified via ${sent} channel(s)`);
