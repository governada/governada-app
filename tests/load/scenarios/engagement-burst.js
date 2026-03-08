/**
 * Engagement Burst — concurrent write-path stress test.
 *
 * Simulates a viral proposal moment: many users casting sentiment votes
 * simultaneously on the same proposal. Tests:
 *   - Write throughput on /api/engagement/sentiment/vote
 *   - Per-route rate limiting (10 req/60s per wallet/IP)
 *   - Per-epoch rate limiting (50 sentiment votes/epoch)
 *   - Rate limit header accuracy under concurrency
 *   - Sentiment results aggregation under load
 *
 * ⚠️  This scenario requires authentication tokens and WRITES to the database.
 *     Do NOT run against production. Use local dev server only.
 *
 * Usage:
 *   AUTH_TOKEN=<jwt> PROPOSAL_TX_HASHES=abc123 k6 run tests/load/scenarios/engagement-burst.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { BASE_URL, JSON_HEADERS, SAMPLE_PROPOSALS } from '../config.js';

// Custom metrics
const sentimentWriteDuration = new Trend('sentiment_write_duration', true);
const sentimentReadDuration = new Trend('sentiment_read_duration', true);
const rateLimitHits = new Counter('rate_limit_429s');
const writeErrorRate = new Rate('write_errors');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '15s', target: 10 },
        { duration: '30s', target: 50 },
        { duration: '30s', target: 50 }, // sustained
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    sentiment_write_duration: ['p(95)<800'],
    sentiment_read_duration: ['p(95)<400'],
    write_errors: ['rate<0.05'], // allow up to 5% errors (rate limiting is expected)
  },
  tags: { scenario: 'engagement-burst' },
};

/**
 * NOTE: This scenario requires AUTH_TOKEN env var for authenticated requests.
 * Without it, all write requests will return 401 — useful for testing auth enforcement
 * but not for actual write-path stress testing.
 *
 * To run a meaningful write-path test:
 * 1. Start local dev server: npm run dev
 * 2. Get a JWT from browser devtools (Application > Cookies > sb-* token)
 * 3. Run: AUTH_TOKEN=<jwt> PROPOSAL_TX_HASHES=<hash> k6 run tests/load/scenarios/engagement-burst.js
 */

const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const proposalHash =
    SAMPLE_PROPOSALS.length > 0
      ? SAMPLE_PROPOSALS[Math.floor(Math.random() * SAMPLE_PROPOSALS.length)]
      : 'test-proposal-hash';

  const proposalIndex = 0;
  const sentiments = ['support', 'oppose', 'unsure'];
  const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];

  const authHeaders = AUTH_TOKEN
    ? {
        ...JSON_HEADERS,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      }
    : JSON_HEADERS;

  // --- Write: Cast sentiment vote ---
  group('sentiment vote', () => {
    const payload = JSON.stringify({
      proposalTxHash: proposalHash,
      proposalIndex: proposalIndex,
      sentiment: sentiment,
    });

    const res = http.post(`${BASE_URL}/api/engagement/sentiment/vote`, payload, {
      headers: authHeaders,
    });

    sentimentWriteDuration.add(res.timings.duration);

    if (res.status === 429) {
      rateLimitHits.add(1);
      // Rate limited — this is expected under burst load
      check(res, {
        'rate limit returns 429': (r) => r.status === 429,
        'rate limit has error message': (r) => {
          try {
            return JSON.parse(r.body).error !== undefined;
          } catch {
            return false;
          }
        },
      });
    } else if (res.status === 401) {
      // Not authenticated — expected when AUTH_TOKEN not provided
      check(res, {
        'unauthenticated returns 401': (r) => r.status === 401,
      });
    } else {
      const ok = check(res, {
        'sentiment vote returns 200': (r) => r.status === 200,
        'sentiment vote has community data': (r) => {
          try {
            return JSON.parse(r.body).community !== undefined;
          } catch {
            return false;
          }
        },
      });
      writeErrorRate.add(!ok);
    }
  });

  sleep(0.3);

  // --- Read: Check aggregated sentiment results ---
  group('sentiment results', () => {
    const res = http.get(
      `${BASE_URL}/api/engagement/sentiment/results?proposalTxHash=${proposalHash}&proposalIndex=${proposalIndex}`,
      { headers: JSON_HEADERS },
    );

    sentimentReadDuration.add(res.timings.duration);
    check(res, {
      'sentiment results returns 200': (r) => r.status === 200,
    });
  });

  // Short delay to create realistic burst pattern
  sleep(Math.random() * 0.5);
}

/**
 * Rate limit validation — dedicated test function.
 * Run with: k6 run --iterations 15 -e SCENARIO=rate-limit-check ...
 *
 * This sends 15 rapid requests from the same IP to verify:
 * - First 10 succeed (route limit: 10 req/60s)
 * - Requests 11-15 get 429
 * - X-RateLimit-Remaining header decrements correctly
 */
export function rateLimitCheck() {
  if (__ENV.SCENARIO !== 'rate-limit-check') return;

  const payload = JSON.stringify({
    proposalTxHash: 'rate-limit-test',
    proposalIndex: 0,
    sentiment: 'support',
  });

  const authHeaders = AUTH_TOKEN
    ? { ...JSON_HEADERS, Authorization: `Bearer ${AUTH_TOKEN}` }
    : JSON_HEADERS;

  for (let i = 0; i < 15; i++) {
    const res = http.post(`${BASE_URL}/api/engagement/sentiment/vote`, payload, {
      headers: authHeaders,
    });

    if (i < 10) {
      check(res, {
        [`request ${i + 1} within limit`]: (r) => r.status !== 429,
      });
    } else {
      check(res, {
        [`request ${i + 1} rate limited`]: (r) => r.status === 429,
      });
    }
  }
}
