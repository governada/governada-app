import { performance } from 'node:perf_hooks';

import { fetchWithTimeout, normalizeBaseUrl } from './lib/runtime.mjs';

const baseUrl = normalizeBaseUrl(process.argv[2] ?? 'https://governada.io');
const endpoints = [
  ['Health (readiness)', '/api/health/ready', 1000],
  ['Health (full)', '/api/health', 3000],
  ['Health (deep)', '/api/health/deep', 3000],
  ['DRep list', '/api/dreps', 3000],
  ['Public API v1 DReps', '/api/v1/dreps?limit=5', 3000],
  ['Public API v1 Gov Health', '/api/v1/governance/health', 3000],
  ['Auth nonce', '/api/auth/nonce', 1000],
  ['Proposals', '/api/proposals', 3000],
  ['Citizen briefing', '/api/briefing/citizen', 5000],
];

console.log('=== Deploy Health Check ===');
console.log(`Target: ${baseUrl}`);
console.log('');

let failed = 0;

for (const [name, route, maxMs] of endpoints) {
  const url = `${baseUrl}${route}`;
  const startedAt = performance.now();
  let status = 'PASS';
  let detail = '';

  try {
    const response = await fetchWithTimeout(url, {}, 10000);
    const durationMs = Math.round(performance.now() - startedAt);
    detail = `${response.status} ${durationMs}ms`;

    if (response.status !== 200) {
      status = 'FAIL';
      detail = `${response.status} (expected 200)`;
      failed += 1;
    } else if (durationMs > maxMs) {
      status = 'SLOW';
      detail = `${response.status} ${durationMs}ms (max: ${maxMs}ms)`;
      failed += 1;
    }
  } catch {
    status = 'FAIL';
    detail = '000 (request failed)';
    failed += 1;
  }

  console.log(`  [${status}] ${name.padEnd(35)} ${detail}`);
}

console.log('');
console.log(`${endpoints.length - failed}/${endpoints.length} checks passed.`);

if (failed > 0) {
  console.log('');
  console.log('DEPLOY HEALTH CHECK FAILED');
  process.exit(1);
}

console.log('');
console.log('DEPLOY HEALTHY');
