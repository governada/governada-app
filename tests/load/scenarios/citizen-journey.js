/**
 * Citizen Journey — anonymous read-only load test.
 *
 * Simulates a new visitor discovering the platform:
 *   health check → DRep list → briefing → governance pulse → proposal browse
 *
 * All endpoints are public / auth-optional, so no credentials needed.
 * Safe to run against any environment (read-only).
 *
 * Usage:
 *   k6 run tests/load/scenarios/citizen-journey.js
 *   BASE_URL=http://localhost:3000 k6 run tests/load/scenarios/citizen-journey.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, STANDARD_THRESHOLDS, RAMP_STAGES, JSON_HEADERS } from '../config.js';

// Custom metrics per endpoint
const briefingDuration = new Trend('briefing_citizen_duration', true);
const drepListDuration = new Trend('drep_list_duration', true);
const pulseDuration = new Trend('governance_pulse_duration', true);
const healthDuration = new Trend('health_check_duration', true);
const errorRate = new Rate('endpoint_errors');

export const options = {
  stages: RAMP_STAGES,
  thresholds: {
    ...STANDARD_THRESHOLDS,
    briefing_citizen_duration: ['p(95)<800'], // complex query, more lenient
    drep_list_duration: ['p(95)<400'],
    governance_pulse_duration: ['p(95)<500'],
    health_check_duration: ['p(95)<200'],
  },
  tags: { scenario: 'citizen-journey' },
};

export default function () {
  const params = { headers: JSON_HEADERS };

  // Step 1: Health check (first thing the app fetches)
  group('health check', () => {
    const res = http.get(`${BASE_URL}/api/health`, params);
    healthDuration.add(res.timings.duration);
    const ok = check(res, {
      'health returns 200': (r) => r.status === 200,
      'health has status field': (r) => {
        try {
          return JSON.parse(r.body).status !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // Step 2: Browse DRep list (Discover page)
  group('discover dreps', () => {
    const res = http.get(`${BASE_URL}/api/dreps`, params);
    drepListDuration.add(res.timings.duration);
    const ok = check(res, {
      'dreps returns 200': (r) => r.status === 200,
      'dreps has array': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.dreps);
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // Step 3: Citizen briefing (most complex query — 11+ Supabase calls)
  group('citizen briefing', () => {
    const res = http.get(`${BASE_URL}/api/briefing/citizen`, params);
    briefingDuration.add(res.timings.duration);
    const ok = check(res, {
      'briefing returns 200': (r) => r.status === 200,
      'briefing has epoch': (r) => {
        try {
          return typeof JSON.parse(r.body).epoch === 'number';
        } catch {
          return false;
        }
      },
      'briefing has treasury': (r) => {
        try {
          return JSON.parse(r.body).treasury !== undefined;
        } catch {
          return false;
        }
      },
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // Step 4: Governance pulse (live governance overview)
  group('governance pulse', () => {
    const res = http.get(`${BASE_URL}/api/governance/pulse`, params);
    pulseDuration.add(res.timings.duration);
    const ok = check(res, {
      'pulse returns 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  // Step 5: Governance health index
  group('governance health index', () => {
    const res = http.get(`${BASE_URL}/api/governance/health-index`, params);
    check(res, {
      'health-index returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // Step 6: Browse proposals
  group('proposals list', () => {
    const res = http.get(`${BASE_URL}/api/proposals`, params);
    check(res, {
      'proposals returns 200': (r) => r.status === 200,
    });
  });

  // Simulate think time between page views
  sleep(Math.random() * 2 + 1);
}
