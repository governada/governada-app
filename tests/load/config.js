/**
 * Shared k6 load test configuration.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 k6 run tests/load/scenarios/citizen-journey.js
 *
 * k6 is a standalone binary — install via:
 *   - Windows: winget install k6 --source winget
 *   - macOS:   brew install k6
 *   - Linux:   snap install k6
 *   - Docker:  docker run --rm -i grafana/k6 run - <script.js
 *
 * See: https://grafana.com/docs/k6/latest/set-up/install-k6/
 */

/** Base URL — defaults to local dev server */
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/** Standard thresholds for all scenarios */
export const STANDARD_THRESHOLDS = {
  http_req_failed: ['rate<0.01'], // <1% errors
  http_req_duration: ['p(95)<500'], // P95 under 500ms
};

/** Stricter thresholds for critical API endpoints */
export const API_THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
};

/**
 * Standard ramp-up profile: 1 → 10 → 50 → 100 VUs over 5 minutes.
 * Suitable for most scenarios.
 */
export const RAMP_STAGES = [
  { duration: '30s', target: 1 },
  { duration: '1m', target: 10 },
  { duration: '1m', target: 50 },
  { duration: '1m30s', target: 100 },
  { duration: '1m', target: 0 }, // ramp-down
];

/**
 * Light ramp-up for write-path or rate-limited scenarios.
 */
export const LIGHT_STAGES = [
  { duration: '30s', target: 5 },
  { duration: '1m', target: 20 },
  { duration: '1m', target: 50 },
  { duration: '30s', target: 0 },
];

/** Common headers */
export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

/**
 * Check response and tag for k6 reporting.
 * @param {import('k6/http').RefinedResponse} res
 * @param {string} name - Human-readable endpoint name
 * @param {number} [expectedStatus=200]
 */
export function checkResponse(res, name, expectedStatus = 200) {
  const checks = {};
  checks[`${name} status ${expectedStatus}`] = res.status === expectedStatus;
  checks[`${name} < 500ms`] = res.timings.duration < 500;
  return checks;
}

/**
 * Sample DRep IDs for testing. These are well-known active DReps
 * that should exist in any non-empty dataset.
 * Override via DREP_IDS env var (comma-separated).
 */
export const SAMPLE_DREP_IDS = (__ENV.DREP_IDS || '').split(',').filter(Boolean);

/**
 * Sample proposal tx hashes for engagement testing.
 * Override via PROPOSAL_TX_HASHES env var (comma-separated).
 */
export const SAMPLE_PROPOSALS = (__ENV.PROPOSAL_TX_HASHES || '').split(',').filter(Boolean);
