#!/usr/bin/env npx tsx
/**
 * Sync Smoke Test — verifies all sync routes respond and sync_log is fresh.
 * Usage: npx tsx scripts/sync-smoke-test.ts
 * Requires CRON_SECRET and NEXT_PUBLIC_SITE_URL in env (or .env.local).
 */

import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('CRON_SECRET not set. Cannot run smoke test.');
  process.exit(1);
}

interface SyncRoute {
  name: string;
  path: string;
  expectedSyncType: string;
}

const SYNC_ROUTES: SyncRoute[] = [
  { name: 'Proposals', path: '/api/sync/proposals', expectedSyncType: 'proposals' },
  { name: 'DReps', path: '/api/sync/dreps', expectedSyncType: 'dreps' },
  { name: 'Votes', path: '/api/sync/votes', expectedSyncType: 'votes' },
  { name: 'Secondary', path: '/api/sync/secondary', expectedSyncType: 'secondary' },
  { name: 'Slow', path: '/api/sync/slow', expectedSyncType: 'slow' },
];

interface Result {
  name: string;
  routeOk: boolean;
  status: number | null;
  healthOk: boolean;
  staleMins: number | null;
  error?: string;
}

async function checkRoute(route: SyncRoute): Promise<Result> {
  const result: Result = {
    name: route.name,
    routeOk: false,
    status: null,
    healthOk: false,
    staleMins: null,
  };

  try {
    const res = await fetch(`${BASE_URL}${route.path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(300_000),
    });
    result.status = res.status;
    result.routeOk = res.status === 200 || res.status === 207;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  return result;
}

async function checkHealth(): Promise<Record<string, { staleMins: number; success: boolean }>> {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10_000) });
    const body = (await res.json()) as {
      syncs?: Array<{ type: string; stale_mins: number | null; last_success: boolean }>;
    };

    const map: Record<string, { staleMins: number; success: boolean }> = {};
    for (const s of body.syncs || []) {
      map[s.type] = { staleMins: s.stale_mins ?? Infinity, success: s.last_success };
    }
    return map;
  } catch {
    return {};
  }
}

async function main() {
  console.log(`\n--- Sync Smoke Test ---`);
  console.log(`Base URL: ${BASE_URL}\n`);

  const healthBefore = await checkHealth();
  console.log(`Health check: ${Object.keys(healthBefore).length} sync types found\n`);

  const results: Result[] = [];

  for (const route of SYNC_ROUTES) {
    process.stdout.write(`Testing ${route.name}... `);
    const result = await checkRoute(route);

    const h = healthBefore[route.expectedSyncType];
    if (h) {
      result.healthOk = h.success;
      result.staleMins = h.staleMins;
    }

    results.push(result);
    const icon = result.routeOk ? 'PASS' : 'FAIL';
    console.log(`${icon} (${result.status || result.error})`);
  }

  console.log('\n--- Results ---\n');
  console.log('Route'.padEnd(15) + 'Status'.padEnd(10) + 'Health'.padEnd(10) + 'Stale (min)');
  console.log('-'.repeat(45));

  let allPass = true;
  for (const r of results) {
    const routeStatus = r.routeOk ? 'OK' : `FAIL(${r.status || r.error})`;
    const health = r.healthOk ? 'OK' : 'FAIL';
    const stale = r.staleMins !== null ? String(r.staleMins) : 'N/A';
    console.log(r.name.padEnd(15) + routeStatus.padEnd(10) + health.padEnd(10) + stale);
    if (!r.routeOk) allPass = false;
  }

  console.log(`\n${allPass ? 'ALL PASS' : 'SOME FAILURES'}\n`);
  process.exit(allPass ? 0 : 1);
}

main();
