/**
 * Post-deploy smoke test — hits production endpoints, verifies status + response shape.
 * Usage: npx tsx scripts/smoke-test.ts [base-url]
 * Exit 0 = all pass, non-zero = failure details printed.
 */

const BASE_URL = process.argv[2] || process.env.SMOKE_TEST_URL || 'https://drepscore.io';

interface Check {
  name: string;
  path: string;
  method?: string;
  expectedStatus: number;
  validate?: (body: any) => string | null; // return error string or null
}

const checks: Check[] = [
  {
    name: 'Health endpoint',
    path: '/api/health',
    expectedStatus: 200,
    validate: (b) => {
      if (!b.status) return 'Missing status field';
      if (b.status === 'error') return `Health reports error: ${b.message}`;
      return null;
    },
  },
  {
    name: 'DReps list',
    path: '/api/dreps',
    expectedStatus: 200,
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
    validate: (b) => {
      if (!b.nonce || !b.signature) return 'Missing nonce or signature';
      return null;
    },
  },
];

async function runCheck(check: Check): Promise<{ pass: boolean; name: string; detail: string }> {
  const url = `${BASE_URL}${check.path}`;
  try {
    const res = await fetch(url, {
      method: check.method || 'GET',
      headers: { 'User-Agent': 'DRepScore-SmokeTest/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (res.status !== check.expectedStatus) {
      return {
        pass: false,
        name: check.name,
        detail: `Expected ${check.expectedStatus}, got ${res.status}`,
      };
    }

    if (check.validate) {
      const body = await res.json();
      const err = check.validate(body);
      if (err) return { pass: false, name: check.name, detail: err };
    }

    return { pass: true, name: check.name, detail: `${res.status} OK` };
  } catch (err) {
    return {
      pass: false,
      name: check.name,
      detail: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function main() {
  console.log(`\nSmoke testing: ${BASE_URL}\n`);

  const results = await Promise.all(checks.map(runCheck));
  let failed = 0;

  for (const r of results) {
    const icon = r.pass ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.name} — ${r.detail}`);
    if (!r.pass) failed++;
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
