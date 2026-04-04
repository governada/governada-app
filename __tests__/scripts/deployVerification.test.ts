import { describe, expect, it, vi } from 'vitest';
import {
  getSmokeChecks,
  releaseMatchesExpected,
  runSmokeChecks,
  waitForReleaseReady,
} from '@/scripts/lib/deployVerification';

function response(body: unknown, status = 200, elapsedMs = 25) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
    elapsedMs,
  };
}

function createFetch(
  responses: Record<string, ReturnType<typeof response> | Array<ReturnType<typeof response>>>,
): typeof fetch {
  const seen = new Map<string, number>();

  return vi.fn(async (input: URL | RequestInfo) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const key = Object.keys(responses).find((candidate) => url.endsWith(candidate));
    if (!key) {
      throw new Error(`Unhandled URL ${url}`);
    }

    const value = responses[key];
    if (Array.isArray(value)) {
      const index = seen.get(key) ?? 0;
      seen.set(key, index + 1);
      return value[Math.min(index, value.length - 1)] as unknown as Response;
    }

    return value as unknown as Response;
  }) as unknown as typeof fetch;
}

describe('deploy verification helpers', () => {
  it('matches release SHAs by prefix or exact value', () => {
    expect(releaseMatchesExpected('abcdef1234567890', 'abcdef1234567890')).toBe(true);
    expect(releaseMatchesExpected('abcdef1234567890', 'abcdef12')).toBe(true);
    expect(releaseMatchesExpected('abcdef12', 'abcdef1234567890')).toBe(true);
    expect(releaseMatchesExpected('fedcba98', 'abcdef12')).toBe(false);
  });

  it('requires healthy health states in production smoke checks', async () => {
    const fetch = createFetch({
      '/api/health/ready': response({ status: 'ok', release: { commit_sha: 'abc123' } }),
      '/api/health/deep': response({ status: 'healthy' }),
      '/api/health': response({ status: 'degraded', syncs: [], snapshots: { status: 'healthy' } }),
      '/api/dreps': response({ dreps: [{ id: 'drep1' }] }),
      '/api/v1/dreps?limit=5': response({
        data: [{ id: 'drep1', score: 10 }],
        meta: { api_version: '1.0' },
      }),
      '/api/v1/governance/health': response({
        data: {
          total_registered_dreps: 200,
          total_votes: 5000,
          total_proposals: 20,
          score_distribution: {},
        },
      }),
      '/api/auth/nonce': response({ nonce: 'n', signature: 's' }),
      '/api/v1/dreps?limit=20': response({
        data: Array.from({ length: 20 }, (_, index) => ({ id: `drep${index}`, score: 10 })),
      }),
    });

    const result = await runSmokeChecks({
      baseUrl: 'https://governada.io',
      expectedSha: 'abc123',
      fetchImpl: fetch,
      profile: 'production',
      quiet: true,
      log: () => {},
    });

    expect(result.failed).toBe(2);
    expect(result.results.find((entry) => entry.name === 'Health (full)')?.detail).toContain(
      'outside allowed set',
    );
    expect(result.results.find((entry) => entry.name === 'Sync freshness')?.detail).toContain(
      'Health status is degraded',
    );
  });

  it('allows degraded health in preview smoke checks', async () => {
    const fetch = createFetch({
      '/api/health/ready': response({ status: 'ok', release: { commit_sha: 'abc123' } }),
      '/api/health/deep': response({ status: 'degraded' }),
      '/api/health': response({ status: 'degraded' }),
      '/api/dreps': response({ dreps: [{ id: 'drep1' }] }),
      '/api/v1/dreps?limit=5': response({
        data: [{ id: 'drep1', score: 10 }],
        meta: { api_version: '1.0' },
      }),
      '/api/v1/governance/health': response({
        data: { total_registered_dreps: 200, score_distribution: {} },
      }),
      '/api/auth/nonce': response({ nonce: 'n', signature: 's' }),
    });

    const result = await runSmokeChecks({
      baseUrl: 'https://preview.governada.io',
      expectedSha: 'abc123',
      fetchImpl: fetch,
      profile: 'preview',
      quiet: true,
      log: () => {},
    });

    expect(result.failed).toBe(0);
    expect(getSmokeChecks('preview')).toHaveLength(7);
  });

  it('polls readiness until the expected release is live', async () => {
    const fetch = createFetch({
      '/api/health/ready': [
        response({ status: 'ok', release: { commit_sha: 'oldsha000000' } }),
        response({ status: 'ok', release: { commit_sha: 'abc123deadbeef' } }),
      ],
    });

    const result = await waitForReleaseReady({
      baseUrl: 'https://governada.io',
      expectedSha: 'abc123',
      fetchImpl: fetch,
      intervalMs: 1,
      timeoutMs: 100,
      log: () => {},
    });

    expect(result.attempts).toBe(2);
    expect(result.releaseCommitSha).toBe('abc123deadbeef');
  });
});
