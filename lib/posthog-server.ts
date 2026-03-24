import { PostHog } from 'posthog-node';
import { createHash } from 'crypto';

let client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  if (client) return client;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!key) return null;

  client = new PostHog(key, { host, flushAt: 1, flushInterval: 0 });
  return client;
}

/** Hash wallet addresses before sending to PostHog for privacy */
function hashDistinctId(id: string): string {
  // Only hash wallet-like identifiers (stake1..., addr1...), pass through 'server' etc.
  if (id.startsWith('stake1') || id.startsWith('addr1') || id.startsWith('addr_test')) {
    return `wallet_${createHash('sha256').update(id).digest('hex').slice(0, 16)}`;
  }
  return id;
}

export function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
  distinctId = 'server',
) {
  const ph = getPostHogServer();
  if (!ph) return;
  ph.capture({ distinctId: hashDistinctId(distinctId), event, properties });
}
