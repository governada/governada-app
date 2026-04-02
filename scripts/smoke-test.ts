/**
 * Unified post-deploy verification — health checks + smoke tests + response time assertions.
 * Replaces the need to run check-deploy-health.mjs separately.
 *
 * Usage: npx tsx scripts/smoke-test.ts [base-url] [--quiet]
 * Exit 0 = all pass, non-zero = failure details printed.
 *
 * --quiet: Only print failures and the summary line (saves ~800 lines of agent context)
 */

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const BASE_URL =
  args.find((a) => !a.startsWith('--')) || process.env.SMOKE_TEST_URL || 'https://governada.io';

interface Check {
  name: string;
  path: string;
  method?: string;
  expectedStatus: number;
  maxResponseMs?: number; // response time budget (default: 5000ms)
  validate?: (body: any) => string | null; // return error string or null
}

const checks: Check[] = [
  // --- Deploy health checks (subsumes check-deploy-health.mjs) ---
  {
    name: 'Health (readiness)',
    path: '/api/health/ready',
    expectedStatus: 200,
    maxResponseMs: 1000,
  },
  {
    name: 'Health (deep)',
    path: '/api/health/deep',
    expectedStatus: 200,
    maxResponseMs: 3000,
  },
  {
    name: 'Health (full)',
    path: '/api/health',
    expectedStatus: 200,
    maxResponseMs: 5000,
    validate: (b) => {
      if (!b.status) return 'Missing status field';
      if (b.status === 'error') return `Health reports error: ${b.message}`;
      return null;
    },
  },
  // --- Endpoint smoke tests ---
  {
    name: 'DReps list',
    path: '/api/dreps',
    expectedStatus: 200,
    // First-hit reads can be cold right after deploy even when the endpoint is healthy.
    maxResponseMs: 6000,
    validate: (b) => {
      if (!Array.isArray(b.dreps)) return 'Missing dreps array';
      if (b.dreps.length === 0) return 'Empty dreps array (expected data)';
      return null;
    },
  },
  {
    name: 'Public API v1 - DReps',
    path: '/api/v1/dreps?limit=5',
    expectedStatus: 200,
    maxResponseMs: 6000,
    validate: (b) => {
      if (!b.data || !Array.isArray(b.data)) return 'Missing data array';
      if (!b.meta?.api_version) return 'Missing meta.api_version';
      return null;
    },
  },
  {
    name: 'Public API v1 - Governance Health',
    path: '/api/v1/governance/health',
    expectedStatus: 200,
    maxResponseMs: 6000,
    validate: (b) => {
      if (typeof b.data?.total_registered_dreps !== 'number')
        return 'Missing total_registered_dreps';
      if (!b.data?.score_distribution) return 'Missing score_distribution';
      return null;
    },
  },
  {
    name: 'Auth nonce',
    path: '/api/auth/nonce',
    expectedStatus: 200,
    maxResponseMs: 1000,
    validate: (b) => {
      if (!b.nonce || !b.signature) return 'Missing nonce or signature';
      return null;
    },
  },
  // Data integrity checks
  {
    name: 'DRep data completeness',
    path: '/api/v1/dreps?limit=20',
    expectedStatus: 200,
    validate: (b) => {
      if (!b.data?.length) return 'No DRep data returned';
      const withScore = b.data.filter((d: any) => d.score != null && d.score > 0);
      if (withScore.length === 0) return 'No DReps have scores — scoring may be broken';
      const scorePct = (withScore.length / b.data.length) * 100;
      if (scorePct < 50) return `Only ${scorePct.toFixed(0)}% of DReps have scores (expected >50%)`;
      return null;
    },
  },
  {
    name: 'Governance health - data counts',
    path: '/api/v1/governance/health',
    expectedStatus: 200,
    validate: (b) => {
      const d = b.data;
      if (!d) return 'Missing data';
      if (d.total_registered_dreps < 100)
        return `DRep count suspiciously low: ${d.total_registered_dreps}`;
      if (d.total_votes < 1000) return `Vote count suspiciously low: ${d.total_votes}`;
      if (d.total_proposals < 10) return `Proposal count suspiciously low: ${d.total_proposals}`;
      return null;
    },
  },
  {
    name: 'Sync freshness',
    path: '/api/health',
    expectedStatus: 200,
    validate: (b) => {
      if (!b.sync) return null; // sync info not in health endpoint, skip
      const staleThresholds: Record<string, number> = {
        proposals: 90,
        dreps: 720,
        votes: 720,
        scoring: 480,
      };
      for (const [type, maxMins] of Object.entries(staleThresholds)) {
        const syncInfo = b.sync?.[type];
        if (syncInfo?.stale_mins && syncInfo.stale_mins > maxMins) {
          return `${type} sync is ${syncInfo.stale_mins}min stale (threshold: ${maxMins}min)`;
        }
      }
      return null;
    },
  },
];

async function runCheck(check: Check): Promise<{ pass: boolean; name: string; detail: string }> {
  const url = `${BASE_URL}${check.path}`;
  const maxMs = check.maxResponseMs;
  try {
    const start = performance.now();
    const res = await fetch(url, {
      method: check.method || 'GET',
      headers: { 'User-Agent': 'Governada-SmokeTest/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Math.round(performance.now() - start);

    if (res.status !== check.expectedStatus) {
      return {
        pass: false,
        name: check.name,
        detail: `Expected ${check.expectedStatus}, got ${res.status} (${elapsed}ms)`,
      };
    }

    if (typeof maxMs === 'number' && elapsed > maxMs) {
      return {
        pass: false,
        name: check.name,
        detail: `SLOW: ${elapsed}ms exceeds ${maxMs}ms budget`,
      };
    }

    if (check.validate) {
      const body = await res.json();
      const err = check.validate(body);
      if (err) return { pass: false, name: check.name, detail: `${err} (${elapsed}ms)` };
    }

    return { pass: true, name: check.name, detail: `${res.status} OK (${elapsed}ms)` };
  } catch (err) {
    return {
      pass: false,
      name: check.name,
      detail: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function main() {
  console.log(`\nSmoke testing: ${BASE_URL}${QUIET ? ' (quiet mode)' : ''}\n`);

  const results = [];
  for (const check of checks) {
    results.push(await runCheck(check));
  }
  let failed = 0;

  for (const r of results) {
    if (!r.pass) {
      console.log(`  [FAIL] ${r.name} — ${r.detail}`);
      failed++;
    } else if (!QUIET) {
      console.log(`  [PASS] ${r.name} — ${r.detail}`);
    }
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
