import { describe, expect, it } from 'vitest';
import {
  SENECA_DRIFT_AMBER,
  SENECA_EVAL_AVATAR_URL,
  buildDiscordWebhookPayload,
} from '@/lib/seneca/eval/discordWebhook';

describe('Seneca Discord webhook payload', () => {
  it('uses Discord embeds with top-level identity fields and no Slack blocks', () => {
    const payload = buildDiscordWebhookPayload({
      title: 'Weekly pass rate dropped below 90%',
      description: '84% pass rate over the last 7 nightly runs.',
      color: SENECA_DRIFT_AMBER,
      fields: [{ name: 'Pass rate', value: '84%', inline: true }],
      timestamp: '2026-05-07T03:00:00.000Z',
    });

    expect(payload).toEqual({
      username: 'Seneca Eval',
      avatar_url: SENECA_EVAL_AVATAR_URL,
      embeds: [
        {
          title: 'Weekly pass rate dropped below 90%',
          description: '84% pass rate over the last 7 nightly runs.',
          color: 0xff7f00,
          fields: [{ name: 'Pass rate', value: '84%', inline: true }],
          timestamp: '2026-05-07T03:00:00.000Z',
        },
      ],
    });
    expect(payload).not.toHaveProperty('blocks');
  });
});
