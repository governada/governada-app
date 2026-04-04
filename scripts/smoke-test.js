/**
 * Unified post-deploy verification: health checks, smoke tests, and response time assertions.
 * Replaces the need to run check-deploy-health.mjs separately.
 *
 * Usage: node scripts/smoke-test.js [base-url] [--quiet]
 * Exit 0 = all pass, non-zero = failure details printed.
 *
 * --quiet: Only print failures and the summary line.
 */

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const BASE_URL =
  args.find((arg) => !arg.startsWith('--')) || process.env.SMOKE_TEST_URL || 'https://governada.io';

const checks = [
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
    validate: (body) => {
      if (!body.status) return 'Missing status field';
      if (body.status === 'error') return `Health reports error: ${body.message}`;
      return null;
    },
  },
  {
    name: 'DReps list',
    path: '/api/dreps',
    expectedStatus: 200,
    maxResponseMs: 6000,
    validate: (body) => {
      if (!Array.isArray(body.dreps)) return 'Missing dreps array';
      if (body.dreps.length === 0) return 'Empty dreps array (expected data)';
      return null;
    },
  },
  {
    name: 'Public API v1 - DReps',
    path: '/api/v1/dreps?limit=5',
    expectedStatus: 200,
    maxResponseMs: 6000,
    validate: (body) => {
      if (!body.data || !Array.isArray(body.data)) return 'Missing data array';
      if (!body.meta?.api_version) return 'Missing meta.api_version';
      return null;
    },
  },
  {
    name: 'Public API v1 - Governance Health',
    path: '/api/v1/governance/health',
    expectedStatus: 200,
    maxResponseMs: 6000,
    validate: (body) => {
      if (typeof body.data?.total_registered_dreps !== 'number') {
        return 'Missing total_registered_dreps';
      }
      if (!body.data?.score_distribution) return 'Missing score_distribution';
      return null;
    },
  },
  {
    name: 'Auth nonce',
    path: '/api/auth/nonce',
    expectedStatus: 200,
    maxResponseMs: 1000,
    validate: (body) => {
      if (!body.nonce || !body.signature) return 'Missing nonce or signature';
      return null;
    },
  },
  {
    name: 'DRep data completeness',
    path: '/api/v1/dreps?limit=20',
    expectedStatus: 200,
    validate: (body) => {
      if (!body.data?.length) return 'No DRep data returned';
      const withScore = body.data.filter((drep) => drep.score != null && drep.score > 0);
      if (withScore.length === 0) return 'No DReps have scores - scoring may be broken';
      const scorePct = (withScore.length / body.data.length) * 100;
      if (scorePct < 50) {
        return `Only ${scorePct.toFixed(0)}% of DReps have scores (expected >50%)`;
      }
      return null;
    },
  },
  {
    name: 'Governance health - data counts',
    path: '/api/v1/governance/health',
    expectedStatus: 200,
    validate: (body) => {
      const data = body.data;
      if (!data) return 'Missing data';
      if (data.total_registered_dreps < 100) {
        return `DRep count suspiciously low: ${data.total_registered_dreps}`;
      }
      if (data.total_votes < 1000) return `Vote count suspiciously low: ${data.total_votes}`;
      if (data.total_proposals < 10)
        return `Proposal count suspiciously low: ${data.total_proposals}`;
      return null;
    },
  },
  {
    name: 'Sync freshness',
    path: '/api/health',
    expectedStatus: 200,
    validate: (body) => {
      if (!body.sync) return null;
      const staleThresholds = {
        proposals: 90,
        dreps: 720,
        votes: 720,
        scoring: 480,
      };

      for (const [type, maxMins] of Object.entries(staleThresholds)) {
        const syncInfo = body.sync?.[type];
        if (syncInfo?.stale_mins && syncInfo.stale_mins > maxMins) {
          return `${type} sync is ${syncInfo.stale_mins}min stale (threshold: ${maxMins}min)`;
        }
      }

      return null;
    },
  },
];

async function runCheck(check) {
  const url = `${BASE_URL}${check.path}`;
  const maxMs = check.maxResponseMs;

  try {
    const start = performance.now();
    const response = await fetch(url, {
      method: check.method || 'GET',
      headers: { 'User-Agent': 'Governada-SmokeTest/1.0' },
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Math.round(performance.now() - start);

    if (response.status !== check.expectedStatus) {
      return {
        pass: false,
        name: check.name,
        detail: `Expected ${check.expectedStatus}, got ${response.status} (${elapsed}ms)`,
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
      const body = await response.json();
      const error = check.validate(body);
      if (error) {
        return {
          pass: false,
          name: check.name,
          detail: `${error} (${elapsed}ms)`,
        };
      }
    }

    return {
      pass: true,
      name: check.name,
      detail: `${response.status} OK (${elapsed}ms)`,
    };
  } catch (error) {
    return {
      pass: false,
      name: check.name,
      detail: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
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
  for (const result of results) {
    if (!result.pass) {
      console.log(`  [FAIL] ${result.name} - ${result.detail}`);
      failed += 1;
    } else if (!QUIET) {
      console.log(`  [PASS] ${result.name} - ${result.detail}`);
    }
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
