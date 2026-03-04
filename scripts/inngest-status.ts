/**
 * Inngest Status — query function list and recent run health via REST API.
 *
 * Usage:
 *   npx tsx scripts/inngest-status.ts              # summary of all functions
 *   npx tsx scripts/inngest-status.ts --failures    # only show recent failures
 *
 * Requires INNGEST_SIGNING_KEY in .env.local.
 *
 * Note: The Inngest REST API exposes runs per-event, not a global function list.
 * This script queries the sync endpoint to get the registered function list,
 * then checks recent events in the sync_log for run health.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const INNGEST_API = 'https://api.inngest.com/v1';
const SIGNING_KEY = process.env.INNGEST_SIGNING_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://drepscore.io';

if (!SIGNING_KEY) {
  console.error('INNGEST_SIGNING_KEY is not set');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${SIGNING_KEY}`,
  'Content-Type': 'application/json',
};

const EXPECTED_FUNCTIONS = [
  'sync-proposals',
  'sync-dreps',
  'sync-votes',
  'sync-secondary',
  'sync-slow',
  'sync-treasury-snapshot',
  'sync-governance-benchmarks',
  'sync-freshness-guard',
  'snapshot-ghi',
  'alert-integrity',
  'alert-inbox',
  'alert-api-health',
  'check-notifications',
  'check-accountability-polls',
  'generate-epoch-summary',
  'generate-governance-brief',
  'generate-state-of-governance',
  'sync-alignment',
  'sync-drep-scores',
  'sync-spo-cc-votes',
  'sync-spo-scores',
  'check-snapshot-completeness',
];

async function checkRegistration(): Promise<void> {
  console.log('\n=== Function Registration Check ===\n');

  try {
    const res = await fetch(`${SITE_URL}/api/inngest`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.ok) {
      console.log(`PUT ${SITE_URL}/api/inngest — ${res.status} OK (functions synced)`);
    } else {
      const text = await res.text();
      console.log(`PUT ${SITE_URL}/api/inngest — ${res.status} ${text}`);
    }
  } catch (err) {
    console.log(`PUT ${SITE_URL}/api/inngest — FAILED (${err instanceof Error ? err.message : err})`);
  }

  console.log(`\nExpected functions (${EXPECTED_FUNCTIONS.length}):`);
  for (const fn of EXPECTED_FUNCTIONS) {
    console.log(`  - ${fn}`);
  }
}

async function checkRecentRuns(eventId: string): Promise<{ status: string; function_id: string; ended_at: string | null }[]> {
  try {
    const res = await fetch(`${INNGEST_API}/events/${eventId}/runs`, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}

async function checkSyncHealth(): Promise<void> {
  console.log('\n=== Sync Health (via Supabase sync_log) ===\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log('Supabase env vars not set — skipping sync_log check');
    return;
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/sync_log?select=sync_type,status,started_at,duration_ms,error&order=started_at.desc&limit=30`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );

    if (!res.ok) {
      console.log(`Failed to query sync_log: ${res.status}`);
      return;
    }

    const rows: { sync_type: string; status: string; started_at: string; duration_ms: number | null; error: string | null }[] = await res.json();

    if (rows.length === 0) {
      console.log('No sync_log entries found.');
      return;
    }

    const byType = new Map<string, typeof rows>();
    for (const row of rows) {
      const existing = byType.get(row.sync_type) || [];
      existing.push(row);
      byType.set(row.sync_type, existing);
    }

    const failuresOnly = process.argv.includes('--failures');

    console.log('| Sync Type | Last Status | Last Run | Duration | Error |');
    console.log('|-----------|-------------|----------|----------|-------|');

    for (const [syncType, typeRows] of byType) {
      const latest = typeRows[0];
      if (failuresOnly && latest.status === 'success') continue;

      const ago = timeSince(new Date(latest.started_at));
      const duration = latest.duration_ms ? `${(latest.duration_ms / 1000).toFixed(1)}s` : '-';
      const error = latest.error ? latest.error.substring(0, 60) : '-';
      const statusIcon = latest.status === 'success' ? 'OK' : 'FAIL';

      console.log(`| ${syncType.padEnd(28)} | ${statusIcon.padEnd(11)} | ${ago.padEnd(8)} | ${duration.padEnd(8)} | ${error} |`);
    }

    const failures = rows.filter((r) => r.status !== 'success');
    console.log(`\nTotal: ${rows.length} recent runs, ${failures.length} failures`);
  } catch (err) {
    console.log(`Error querying sync_log: ${err instanceof Error ? err.message : err}`);
  }
}

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function main() {
  console.log('Inngest Status Report');
  console.log('=====================');

  await checkRegistration();
  await checkSyncHealth();

  console.log('\nDashboard: https://app.inngest.com');
}

main().catch(console.error);
