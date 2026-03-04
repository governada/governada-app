/**
 * PostHog Event Check — verify events are firing via the Query API.
 *
 * Usage:
 *   npx tsx scripts/posthog-check.ts <event_name>         # check a specific event
 *   npx tsx scripts/posthog-check.ts                       # list recent event counts
 *   npx tsx scripts/posthog-check.ts --since 24h           # events in last 24h (default: 1h)
 *
 * Requires POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in .env.local.
 * PostHog host defaults to NEXT_PUBLIC_POSTHOG_HOST or https://us.posthog.com.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com').replace(/\/+$/, '');

if (!API_KEY || !PROJECT_ID) {
  console.error('Missing env vars: POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID');
  console.error('Create a personal API key at: https://us.posthog.com/settings/user-api-keys');
  console.error('Find your project ID at: https://us.posthog.com/settings/project');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

function parseSince(arg: string): string {
  const match = arg.match(/^(\d+)(h|d|m)$/);
  if (!match) return new Date(Date.now() - 3600_000).toISOString();

  const value = parseInt(match[1]);
  const unit = match[2];
  const ms = unit === 'h' ? value * 3600_000 : unit === 'd' ? value * 86400_000 : value * 60_000;
  return new Date(Date.now() - ms).toISOString();
}

async function query(hogql: string): Promise<{ results: unknown[][]; columns: string[] }> {
  const res = await fetch(`${HOST}/api/projects/${PROJECT_ID}/query/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: {
        kind: 'HogQLQuery',
        query: hogql,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostHog API ${res.status}: ${text.substring(0, 200)}`);
  }

  return res.json();
}

async function checkSpecificEvent(eventName: string, since: string): Promise<void> {
  console.log(`\nChecking event: "${eventName}" since ${since}\n`);

  const result = await query(`
    SELECT
      event,
      count() as count,
      max(timestamp) as last_seen,
      countDistinct(distinct_id) as unique_users
    FROM events
    WHERE event = '${eventName}'
      AND timestamp >= '${since}'
    GROUP BY event
  `);

  if (result.results.length === 0) {
    console.log(`  NO EVENTS FOUND for "${eventName}" in this time window.`);
    console.log('  Possible issues: event not firing, wrong name, or time window too narrow.');
    return;
  }

  const [, count, lastSeen, uniqueUsers] = result.results[0];
  console.log(`  Count:        ${count}`);
  console.log(`  Last seen:    ${lastSeen}`);
  console.log(`  Unique users: ${uniqueUsers}`);
}

async function listRecentEvents(since: string): Promise<void> {
  console.log(`\nTop events since ${since}\n`);

  const result = await query(`
    SELECT
      event,
      count() as count,
      max(timestamp) as last_seen
    FROM events
    WHERE timestamp >= '${since}'
      AND event NOT LIKE '$%'
    GROUP BY event
    ORDER BY count DESC
    LIMIT 30
  `);

  if (result.results.length === 0) {
    console.log('No custom events found in this time window.');
    return;
  }

  console.log('| Event | Count | Last Seen |');
  console.log('|-------|-------|-----------|');
  for (const [event, count, lastSeen] of result.results) {
    const seen = typeof lastSeen === 'string' ? lastSeen.substring(0, 19) : String(lastSeen);
    console.log(`| ${String(event).padEnd(40)} | ${String(count).padStart(5)} | ${seen} |`);
  }
}

async function main() {
  console.log('PostHog Event Check');
  console.log('===================');

  const args = process.argv.slice(2);
  let sinceArg = '1h';
  let eventName: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) {
      sinceArg = args[i + 1];
      i++;
    } else if (!args[i].startsWith('--')) {
      eventName = args[i];
    }
  }

  const since = parseSince(sinceArg);

  if (eventName) {
    await checkSpecificEvent(eventName, since);
  } else {
    await listRecentEvents(since);
  }

  console.log(`\nDashboard: ${HOST}/project/${PROJECT_ID}`);
}

main().catch(console.error);
