import { describe, expect, it, vi } from 'vitest';

import {
  normalizeInngestDoctorBaseUrl,
  parseInngestFunctionFile,
  parseInngestRouteRegistration,
  runInngestDoctor,
} from '@/scripts/lib/inngestDoctor';

type MockFetch = typeof globalThis.fetch & {
  mock: { calls: Array<[URL | RequestInfo, RequestInit?]> };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}

function healthySyncBody() {
  return {
    status: 'healthy',
    core_syncs: [
      { type: 'proposals', stale: false, staleMins: 20, lastSuccess: true },
      { type: 'dreps', stale: false, staleMins: 60, lastSuccess: true },
      { type: 'scoring', stale: false, staleMins: 120, lastSuccess: true },
      { type: 'alignment', stale: false, staleMins: 90, lastSuccess: true },
    ],
  };
}

function createFetch(responses: Record<string, Response>) {
  const mockFetch = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const key = Object.keys(responses).find((candidate) => url.endsWith(candidate));
    if (!key) {
      throw new Error(`Unhandled URL ${url}`);
    }
    return responses[key];
  }) as unknown as MockFetch;

  return { fetch: mockFetch as typeof globalThis.fetch, mockFetch };
}

function expectReadOnlyDoctorFetches(mockFetch: MockFetch) {
  expect(mockFetch).toHaveBeenCalledTimes(2);
  expect(
    mockFetch.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
    ),
  ).toEqual(['https://governada.io/api/inngest', 'https://governada.io/api/health/sync']);
  expect(mockFetch.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'GET']);
}

describe('inngest doctor', () => {
  it('normalizes the base URL without a trailing slash', () => {
    expect(normalizeInngestDoctorBaseUrl('https://governada.io/')).toBe('https://governada.io');
  });

  it('parses the local Inngest route and core triggers', () => {
    const route = parseInngestRouteRegistration(process.cwd());
    const proposals = parseInngestFunctionFile(process.cwd(), 'sync-proposals');
    const guard = parseInngestFunctionFile(process.cwd(), 'sync-freshness-guard');

    expect(route.functionCount).toBeGreaterThan(0);
    expect(route.registeredFiles).toContain('sync-proposals');
    expect(route.registeredFiles).toContain('sync-freshness-guard');
    expect(proposals.functionIds).toContain('sync-proposals');
    expect(proposals.triggers).toContainEqual({ cron: '7,37 * * * *', event: undefined });
    expect(proposals.triggers).toContainEqual({
      cron: undefined,
      event: 'drepscore/sync.proposals',
    });
    expect(guard.triggers).toContainEqual({ cron: '14,44 * * * *', event: undefined });
  });

  it('passes with an advisory when read-only checks are healthy', async () => {
    const localRoute = parseInngestRouteRegistration(process.cwd());
    const { fetch, mockFetch } = createFetch({
      '/api/inngest': jsonResponse({
        function_count: localRoute.configFunctionCount,
        has_event_key: true,
        has_signing_key: true,
      }),
      '/api/health/sync': jsonResponse(healthySyncBody()),
    });

    const report = await runInngestDoctor({ fetchImpl: fetch });

    expect(report.status).toBe('PASS_WITH_ADVISORIES');
    expect(report.checks.some((entry) => entry.level === 'BLOCKED')).toBe(false);
    expect(
      report.checks.find((entry) => entry.label === 'Inngest server registration freshness')?.level,
    ).toBe('ADVISORY');
    expect(
      report.checks.find((entry) => entry.label === 'Live Inngest served function count')?.level,
    ).toBe('OK');
    expectReadOnlyDoctorFetches(mockFetch);
  });

  it('reports a live function count mismatch as advisory outside post-deploy strict mode', async () => {
    const localRoute = parseInngestRouteRegistration(process.cwd());
    const { fetch, mockFetch } = createFetch({
      '/api/inngest': jsonResponse({
        function_count: localRoute.configFunctionCount - 1,
        has_event_key: true,
        has_signing_key: true,
      }),
      '/api/health/sync': jsonResponse(healthySyncBody()),
    });

    const report = await runInngestDoctor({ fetchImpl: fetch });

    expect(report.status).toBe('PASS_WITH_ADVISORIES');
    expect(
      report.checks.find((entry) => entry.label === 'Live Inngest served function count')?.level,
    ).toBe('ADVISORY');
    expectReadOnlyDoctorFetches(mockFetch);
  });

  it('blocks when post-deploy live function count matching is required and mismatched', async () => {
    const localRoute = parseInngestRouteRegistration(process.cwd());
    const { fetch, mockFetch } = createFetch({
      '/api/inngest': jsonResponse({
        function_count: localRoute.configFunctionCount - 1,
        has_event_key: true,
        has_signing_key: true,
      }),
      '/api/health/sync': jsonResponse(healthySyncBody()),
    });

    const report = await runInngestDoctor({
      fetchImpl: fetch,
      requireLiveFunctionCountMatch: true,
    });

    expect(report.status).toBe('BLOCKED');
    expect(
      report.checks.find((entry) => entry.label === 'Live Inngest served function count')?.level,
    ).toBe('BLOCKED');
    expectReadOnlyDoctorFetches(mockFetch);
  });

  it('blocks when a core sync is stale or failed', async () => {
    const localRoute = parseInngestRouteRegistration(process.cwd());
    const { fetch, mockFetch } = createFetch({
      '/api/inngest': jsonResponse({
        function_count: localRoute.configFunctionCount,
        has_event_key: true,
        has_signing_key: true,
      }),
      '/api/health/sync': jsonResponse(
        {
          ...healthySyncBody(),
          status: 'critical',
          core_syncs: [
            { type: 'proposals', stale: true, staleMins: 180, lastSuccess: true },
            { type: 'dreps', stale: false, staleMins: 60, lastSuccess: true },
            { type: 'scoring', stale: false, staleMins: 120, lastSuccess: true },
            { type: 'alignment', stale: false, staleMins: 90, lastSuccess: true },
          ],
        },
        503,
      ),
    });

    const report = await runInngestDoctor({ fetchImpl: fetch });

    expect(report.status).toBe('BLOCKED');
    expect(report.checks.find((entry) => entry.label === 'Core sync proposals')?.level).toBe(
      'BLOCKED',
    );
    expectReadOnlyDoctorFetches(mockFetch);
  });
});
