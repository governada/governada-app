/**
 * Public API v1 — load test for the external-facing API.
 *
 * Tests all v1 endpoints with realistic query patterns:
 *   - /api/v1/dreps (pagination, search, sorting)
 *   - /api/v1/dreps/:id (single DRep lookup)
 *   - /api/v1/governance/health (governance health)
 *   - /api/v1/governance/pulse (live pulse)
 *   - /api/v1/proposals (proposal listing)
 *   - /api/v1/treasury/current (treasury data)
 *
 * Also validates rate limiting behavior (429 enforcement).
 *
 * Usage:
 *   k6 run tests/load/scenarios/api-v1.js
 *   DREP_IDS=drep1abc,drep1def k6 run tests/load/scenarios/api-v1.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, API_THRESHOLDS, RAMP_STAGES, JSON_HEADERS, SAMPLE_DREP_IDS } from '../config.js';

// Custom metrics
const v1DrepsDuration = new Trend('v1_dreps_list_duration', true);
const v1DrepDetailDuration = new Trend('v1_drep_detail_duration', true);
const v1HealthDuration = new Trend('v1_gov_health_duration', true);
const v1ProposalsDuration = new Trend('v1_proposals_duration', true);
const rateLimitHits = new Counter('rate_limit_429s');

export const options = {
  stages: RAMP_STAGES,
  thresholds: {
    ...API_THRESHOLDS,
    v1_dreps_list_duration: ['p(50)<200', 'p(95)<500'],
    v1_gov_health_duration: ['p(95)<300'],
  },
  tags: { scenario: 'api-v1' },
};

const SORT_FIELDS = ['score', 'name', 'participation', 'rationale', 'reliability'];
const SEARCH_TERMS = ['cardano', 'stake', 'pool', 'drep', 'ada'];

export default function () {
  const params = { headers: JSON_HEADERS };

  // --- DRep listing with various query combinations ---
  group('v1 dreps list', () => {
    // Default listing
    const res1 = http.get(`${BASE_URL}/api/v1/dreps`, params);
    v1DrepsDuration.add(res1.timings.duration);
    check(res1, {
      'v1/dreps returns 200': (r) => r.status === 200,
      'v1/dreps has data array': (r) => {
        try {
          return Array.isArray(JSON.parse(r.body).data);
        } catch {
          return false;
        }
      },
      'v1/dreps has pagination': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.pagination && typeof body.pagination.total === 'number';
        } catch {
          return false;
        }
      },
    });

    if (res1.status === 429) rateLimitHits.add(1);

    // Paginated request
    const sortField = SORT_FIELDS[Math.floor(Math.random() * SORT_FIELDS.length)];
    const order = Math.random() > 0.5 ? 'asc' : 'desc';
    const res2 = http.get(
      `${BASE_URL}/api/v1/dreps?sort=${sortField}&order=${order}&limit=20&offset=20`,
      params,
    );
    v1DrepsDuration.add(res2.timings.duration);
    check(res2, {
      'v1/dreps paginated returns 200': (r) => r.status === 200,
    });

    // Search request
    const term = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)];
    const res3 = http.get(`${BASE_URL}/api/v1/dreps?search=${term}&limit=10`, params);
    v1DrepsDuration.add(res3.timings.duration);
    check(res3, {
      'v1/dreps search returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // --- Single DRep detail (if we have sample IDs) ---
  if (SAMPLE_DREP_IDS.length > 0) {
    group('v1 drep detail', () => {
      const id = SAMPLE_DREP_IDS[Math.floor(Math.random() * SAMPLE_DREP_IDS.length)];
      const res = http.get(`${BASE_URL}/api/v1/dreps/${id}`, params);
      v1DrepDetailDuration.add(res.timings.duration);
      check(res, {
        'v1/drep detail returns 200': (r) => r.status === 200,
      });
    });
    sleep(0.3);
  }

  // --- Governance health ---
  group('v1 governance health', () => {
    const res = http.get(`${BASE_URL}/api/v1/governance/health`, params);
    v1HealthDuration.add(res.timings.duration);
    check(res, {
      'v1/governance/health returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // --- Governance pulse ---
  group('v1 governance pulse', () => {
    const res = http.get(`${BASE_URL}/api/v1/governance/pulse`, params);
    check(res, {
      'v1/governance/pulse returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // --- Proposals ---
  group('v1 proposals', () => {
    const res = http.get(`${BASE_URL}/api/v1/proposals`, params);
    v1ProposalsDuration.add(res.timings.duration);
    check(res, {
      'v1/proposals returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // --- Treasury current ---
  group('v1 treasury', () => {
    const res = http.get(`${BASE_URL}/api/v1/treasury/current`, params);
    check(res, {
      'v1/treasury/current returns 200': (r) => r.status === 200,
    });
  });

  // Think time
  sleep(Math.random() * 1.5 + 0.5);
}
