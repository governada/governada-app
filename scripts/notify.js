const { loadLocalEnv } = require('./lib/runtime');

loadLocalEnv();

const alertConfig = {
  decision_gate: {
    prefix: '[DECISION]',
    color: 16776960,
    action: 'Review the proposed plan and approve or request changes',
    urgency: 'WAITING FOR YOUR INPUT',
  },
  deploy_blocked: {
    prefix: '[DEPLOY BLOCKED]',
    color: 16711680,
    action: 'Check the error details and decide how to proceed',
    urgency: 'DEPLOY HALTED - ACTION REQUIRED',
  },
  escalation: {
    prefix: '[ESCALATION]',
    color: 16744448,
    action: 'Agent hit an unexpected situation and needs your guidance',
    urgency: 'AGENT BLOCKED - NEEDS GUIDANCE',
  },
  complete: {
    prefix: '[COMPLETE]',
    color: 5763719,
    action: 'Review the results at your convenience',
    urgency: 'COMPLETED',
  },
  info: {
    prefix: '[INFO]',
    color: 5814783,
    action: 'No immediate action required',
    urgency: 'INFO',
  },
};

async function sendNotification(type, notificationTitle, notificationDetails = '') {
  if (process.env.NOTIFY_DISABLED === '1') {
    console.log(
      `Notifications disabled. Would have sent: [${type}] ${notificationTitle} -- ${notificationDetails}`,
    );
    return true;
  }

  const config = alertConfig[type] || alertConfig.info;
  const timestamp = new Date()
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');

  const discordUrl = process.env.DISCORD_AGENT_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
  let sent = 0;

  if (discordUrl) {
    const fields = [{ name: 'Status', value: config.urgency, inline: true }];
    if (notificationDetails) {
      fields.push({ name: 'Details', value: notificationDetails, inline: false });
    }
    fields.push({ name: 'Next Step', value: config.action, inline: false });

    const discordResponse = await fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [
          {
            title: `${config.prefix} ${notificationTitle}`,
            color: config.color,
            footer: { text: `Governada Agent - ${timestamp}` },
            fields,
          },
        ],
      }),
    }).catch(() => null);

    if (discordResponse && (discordResponse.status === 200 || discordResponse.status === 204)) {
      console.log(`Discord: sent (${type})`);
      sent += 1;
    } else {
      console.log(`Discord: failed (HTTP ${discordResponse ? discordResponse.status : '000'})`);
    }
  }

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_FOUNDER_CHAT_ID) {
    const lines = [`${config.prefix} ${notificationTitle}`, '', config.urgency];
    if (notificationDetails) {
      lines.push('', notificationDetails);
    }
    lines.push('', `Next: ${config.action}`, '', `Governada Agent - ${timestamp}`);

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_FOUNDER_CHAT_ID,
          text: lines.join('\n'),
        }),
      },
    ).catch(() => null);

    if (telegramResponse && telegramResponse.status === 200) {
      console.log(`Telegram: sent (${type})`);
      sent += 1;
    } else {
      console.log(`Telegram: failed (HTTP ${telegramResponse ? telegramResponse.status : '000'})`);
    }
  }

  if (sent === 0) {
    console.log('WARNING: No notification channels configured or all failed.');
    console.log(
      'Set DISCORD_AGENT_WEBHOOK_URL and/or TELEGRAM_BOT_TOKEN + TELEGRAM_FOUNDER_CHAT_ID',
    );
    return false;
  }

  console.log(`Notified via ${sent} channel(s)`);
  return true;
}

if (require.main === module) {
  const alertType = process.argv[2];
  const title = process.argv[3];
  const details = process.argv[4] || '';

  if (!alertType || !title) {
    console.error('Usage: node scripts/notify.js <alert_type> <title> [details]');
    process.exit(1);
  }

  sendNotification(alertType, title, details)
    .then((ok) => process.exit(ok ? 0 : 1))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

module.exports = {
  sendNotification,
};
