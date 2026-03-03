/**
 * Seed Staging — copies production Supabase data to staging.
 * Run locally: npx tsx scripts/seed-staging.ts
 * Or via GitHub Action: npm run seed:staging
 *
 * Requires .env.staging (or GitHub Secrets) with:
 *   PROD_SUPABASE_URL, PROD_SUPABASE_KEY,
 *   STAGING_SUPABASE_URL, STAGING_SUPABASE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.staging') });

import { createClient } from '@supabase/supabase-js';

const BATCH_SIZE = 1000;

const TABLES_TO_COPY = [
  'dreps',
  'proposals',
  'drep_votes',
  'vote_rationales',
  'drep_power_snapshots',
  'drep_score_history',
  'proposal_voting_summary',
  'social_link_checks',
  'integrity_snapshots',
] as const;

const HEALTH_METRICS = [
  { label: 'DRep count', table: 'dreps', type: 'count' },
  { label: 'Avg DRep score', table: 'dreps', type: 'avg', column: 'score' },
  { label: 'Vote records', table: 'drep_votes', type: 'count' },
  { label: 'Proposals', table: 'proposals', type: 'count' },
  { label: 'Score history rows', table: 'drep_score_history', type: 'count' },
] as const;

function createAdminClient(url: string, key: string) {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getEnvOrFail(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

async function verifyTableExists(
  client: ReturnType<typeof createClient>,
  table: string,
  label: string,
): Promise<boolean> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`  [${label}] Table "${table}" not accessible: ${error.message}`);
    return false;
  }
  console.log(`  [${label}] ${table}: ${count ?? 0} rows`);
  return true;
}

async function getStagingColumns(
  staging: ReturnType<typeof createClient>,
  table: string,
): Promise<string[] | null> {
  const { data, error } = await staging.from(table).select('*').limit(0);
  if (error) return null;
  // When limit=0, PostgREST returns empty array but the response headers
  // don't expose column names. Instead, do a head request for 1 row.
  const { data: sample, error: sampleErr } = await staging.from(table).select('*').limit(1);
  if (sampleErr) return null;
  if (sample && sample.length > 0) return Object.keys(sample[0]);
  // Empty table — infer from production sample
  return null;
}

function filterColumns(
  rows: Record<string, unknown>[],
  columns: string[],
): Record<string, unknown>[] {
  const colSet = new Set(columns);
  return rows.map((row) => {
    const filtered: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      if (colSet.has(key)) filtered[key] = row[key];
    }
    return filtered;
  });
}

async function clearTable(
  staging: ReturnType<typeof createClient>,
  table: string,
): Promise<boolean> {
  // Try different "match-all" conditions depending on table schema
  const attempts = [
    () => staging.from(table).delete().gte('id', ''),
    () => staging.from(table).delete().neq('drep_id', '__IMPOSSIBLE__'),
    () => staging.from(table).delete().neq('tx_hash', '__IMPOSSIBLE__'),
    () => staging.from(table).delete().neq('vote_tx_hash', '__IMPOSSIBLE__'),
    () => staging.from(table).delete().neq('snapshot_date', '1900-01-01'),
    () => staging.from(table).delete().neq('proposal_tx_hash', '__IMPOSSIBLE__'),
  ];

  for (const attempt of attempts) {
    const { error } = await attempt();
    if (!error) return true;
  }
  return false;
}

async function copyTable(
  prod: ReturnType<typeof createClient>,
  staging: ReturnType<typeof createClient>,
  table: string,
): Promise<number> {
  console.log(`\n── Copying ${table} ──`);

  const stagingCols = await getStagingColumns(staging, table);

  const cleared = await clearTable(staging, table);
  if (!cleared) {
    console.error(`  Could not clear ${table}. Skipping.`);
    return 0;
  }
  console.log(`  Cleared staging ${table}`);

  const selectCols = stagingCols ? stagingCols.join(',') : '*';
  let totalCopied = 0;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await prod
      .from(table)
      .select(selectCols)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`  Read error at offset ${offset}: ${error.message}`);
      // If column selection failed (prod missing a staging column), fall back to *
      if (stagingCols && error.message.includes('column')) {
        console.log(`  Falling back to select * with column filtering...`);
        return await copyTableWithFiltering(prod, staging, table, stagingCols);
      }
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    const rows = stagingCols ? filterColumns(data, stagingCols) : data;
    const { error: writeErr } = await staging.from(table).insert(rows);
    if (writeErr) {
      console.error(`  Write error at offset ${offset}: ${writeErr.message}`);
      break;
    }

    totalCopied += data.length;
    offset += data.length;

    if (data.length < BATCH_SIZE) hasMore = false;
    if (totalCopied % 5000 === 0) console.log(`  ... ${totalCopied} rows copied`);
  }

  console.log(`  ✓ ${table}: ${totalCopied} rows copied`);
  return totalCopied;
}

async function copyTableWithFiltering(
  prod: ReturnType<typeof createClient>,
  staging: ReturnType<typeof createClient>,
  table: string,
  stagingCols: string[],
): Promise<number> {
  let totalCopied = 0;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await prod
      .from(table)
      .select('*')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`  Read error at offset ${offset}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    const rows = filterColumns(data, stagingCols);
    const { error: writeErr } = await staging.from(table).insert(rows);
    if (writeErr) {
      console.error(`  Write error at offset ${offset}: ${writeErr.message}`);
      break;
    }

    totalCopied += data.length;
    offset += data.length;
    if (data.length < BATCH_SIZE) hasMore = false;
    if (totalCopied % 5000 === 0) console.log(`  ... ${totalCopied} rows copied`);
  }

  console.log(`  ✓ ${table}: ${totalCopied} rows copied`);
  return totalCopied;
}

async function getMetricValue(
  client: ReturnType<typeof createClient>,
  metric: (typeof HEALTH_METRICS)[number],
): Promise<number> {
  if (metric.type === 'count') {
    const { count, error } = await client
      .from(metric.table)
      .select('*', { count: 'exact', head: true });
    if (error) return -1;
    return count ?? 0;
  }

  if (metric.type === 'avg' && 'column' in metric) {
    const { data, error } = await client.from(metric.table).select(metric.column);
    if (error || !data || data.length === 0) return -1;
    const values = data
      .map((r: Record<string, unknown>) => Number(r[metric.column]))
      .filter((n: number) => !isNaN(n));
    if (values.length === 0) return 0;
    return values.reduce((a: number, b: number) => a + b, 0) / values.length;
  }

  return -1;
}

async function runHealthCheck(
  prod: ReturnType<typeof createClient>,
  staging: ReturnType<typeof createClient>,
): Promise<boolean> {
  console.log('\n══ Post-Seed Health Check ══\n');

  let allPassed = true;
  const results: { label: string; prod: number; staging: number; status: string }[] = [];

  for (const metric of HEALTH_METRICS) {
    const [prodVal, stagingVal] = await Promise.all([
      getMetricValue(prod, metric),
      getMetricValue(staging, metric),
    ]);

    let status = '✓ OK';
    if (prodVal <= 0 && stagingVal <= 0) {
      status = '⚠ Empty';
    } else if (prodVal > 0) {
      const divergence = Math.abs(prodVal - stagingVal) / prodVal;
      if (divergence > 0.1) {
        status = `✗ FAIL (${(divergence * 100).toFixed(1)}% divergence)`;
        allPassed = false;
      }
    }

    results.push({
      label: metric.label,
      prod: Math.round(prodVal * 100) / 100,
      staging: Math.round(stagingVal * 100) / 100,
      status,
    });
  }

  const labelW = Math.max(...results.map((r) => r.label.length), 5);
  console.log(
    `${'Metric'.padEnd(labelW)}  ${'Prod'.padStart(10)}  ${'Staging'.padStart(10)}  Status`,
  );
  console.log('─'.repeat(labelW + 36));
  for (const r of results) {
    console.log(
      `${r.label.padEnd(labelW)}  ${String(r.prod).padStart(10)}  ${String(r.staging).padStart(10)}  ${r.status}`,
    );
  }

  console.log();
  return allPassed;
}

async function main() {
  console.log('═══ Seed Staging from Production ═══\n');

  const prodUrl = getEnvOrFail('PROD_SUPABASE_URL');
  const prodKey = getEnvOrFail('PROD_SUPABASE_KEY');
  const stagingUrl = getEnvOrFail('STAGING_SUPABASE_URL');
  const stagingKey = getEnvOrFail('STAGING_SUPABASE_KEY');

  const prod = createAdminClient(prodUrl, prodKey);
  const staging = createAdminClient(stagingUrl, stagingKey);

  console.log('Verifying table access...\n');
  console.log('Production:');
  let schemaOk = true;
  for (const table of TABLES_TO_COPY) {
    const ok = await verifyTableExists(prod, table, 'prod');
    if (!ok) schemaOk = false;
  }

  console.log('\nStaging:');
  for (const table of TABLES_TO_COPY) {
    const ok = await verifyTableExists(staging, table, 'staging');
    if (!ok) schemaOk = false;
  }

  if (!schemaOk) {
    console.error('\n✗ Schema verification failed. Apply all migrations to staging first.');
    process.exit(1);
  }

  console.log('\n✓ Schema verified on both environments.\n');

  const startTime = Date.now();
  const summary: { table: string; rows: number }[] = [];

  for (const table of TABLES_TO_COPY) {
    const rows = await copyTable(prod, staging, table);
    summary.push({ table, rows });
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══ Copy Summary ══\n');
  for (const s of summary) {
    console.log(`  ${s.table.padEnd(30)} ${s.rows} rows`);
  }
  console.log(`\n  Total time: ${elapsed}s`);

  const healthy = await runHealthCheck(prod, staging);

  if (!healthy) {
    console.error('\n✗ Health check FAILED — staging data diverges >10% from production.');
    process.exit(1);
  }

  console.log('✓ Staging seeded successfully. Data parity confirmed.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
