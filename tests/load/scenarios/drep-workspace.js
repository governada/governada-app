/**
 * DRep Workspace — authenticated DRep flow load test.
 *
 * Simulates a DRep checking their command center:
 *   dashboard → score change → milestones → trajectory → votes → competitive
 *
 * Most endpoints are read-only but require or benefit from auth context.
 * Without AUTH_TOKEN, tests auth-optional endpoints only.
 *
 * Usage:
 *   k6 run tests/load/scenarios/drep-workspace.js
 *   AUTH_TOKEN=<jwt> DREP_IDS=drep1abc k6 run tests/load/scenarios/drep-workspace.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import {
  BASE_URL,
  STANDARD_THRESHOLDS,
  LIGHT_STAGES,
  JSON_HEADERS,
  SAMPLE_DREP_IDS,
} from '../config.js';

// Custom metrics
const dashboardDuration = new Trend('dashboard_main_duration', true);
const scoreChangeDuration = new Trend('dashboard_score_change_duration', true);
const milestonesDuration = new Trend('drep_milestones_duration', true);
const trajectoryDuration = new Trend('drep_trajectory_duration', true);
const votesDuration = new Trend('drep_votes_duration', true);
const endpointErrors = new Rate('endpoint_errors');

export const options = {
  // Use lighter ramp — DRep workspace is a smaller user segment
  stages: LIGHT_STAGES,
  thresholds: {
    ...STANDARD_THRESHOLDS,
    dashboard_main_duration: ['p(95)<600'],
    drep_milestones_duration: ['p(95)<400'],
    drep_votes_duration: ['p(95)<400'],
  },
  tags: { scenario: 'drep-workspace' },
};

const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const authHeaders = AUTH_TOKEN
    ? { ...JSON_HEADERS, Authorization: `Bearer ${AUTH_TOKEN}` }
    : JSON_HEADERS;

  const params = { headers: authHeaders };

  // Pick a DRep ID for per-DRep endpoint testing
  const drepId =
    SAMPLE_DREP_IDS.length > 0
      ? SAMPLE_DREP_IDS[Math.floor(Math.random() * SAMPLE_DREP_IDS.length)]
      : null;

  // --- Step 1: Dashboard overview (command center landing) ---
  group('dashboard overview', () => {
    const res = http.get(`${BASE_URL}/api/dashboard`, params);
    dashboardDuration.add(res.timings.duration);
    const ok = check(res, {
      'dashboard returns 200': (r) => r.status === 200,
    });
    endpointErrors.add(!ok);
  });

  sleep(0.3);

  // --- Step 2: Score change ---
  group('score change', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/score-change`, params);
    scoreChangeDuration.add(res.timings.duration);
    check(res, {
      'score-change returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // --- Step 3: DRep-specific endpoints (if we have an ID) ---
  if (drepId) {
    group('drep milestones', () => {
      const res = http.get(`${BASE_URL}/api/drep/${drepId}/milestones`, params);
      milestonesDuration.add(res.timings.duration);
      check(res, {
        'milestones returns 200': (r) => r.status === 200,
      });
    });

    sleep(0.3);

    group('drep trajectory', () => {
      const res = http.get(`${BASE_URL}/api/drep/${drepId}/trajectory`, params);
      trajectoryDuration.add(res.timings.duration);
      check(res, {
        'trajectory returns 200': (r) => r.status === 200,
      });
    });

    sleep(0.3);

    group('drep votes', () => {
      const res = http.get(`${BASE_URL}/api/drep/${drepId}/votes`, params);
      votesDuration.add(res.timings.duration);
      check(res, {
        'votes returns 200': (r) => r.status === 200,
      });
    });

    sleep(0.3);

    group('drep engagement', () => {
      const res = http.get(`${BASE_URL}/api/drep/${drepId}/engagement`, params);
      check(res, {
        'engagement returns 200': (r) => r.status === 200,
      });
    });

    sleep(0.3);
  }

  // --- Step 4: Competitive analysis ---
  group('competitive dashboard', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/competitive`, params);
    check(res, {
      'competitive returns 200': (r) => r.status === 200,
    });
  });

  sleep(0.3);

  // --- Step 5: Urgent items ---
  group('urgent items', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/urgent`, params);
    check(res, {
      'urgent returns 200': (r) => r.status === 200,
    });
  });

  // Think time — DReps read dashboards
  sleep(Math.random() * 2 + 1);
}
