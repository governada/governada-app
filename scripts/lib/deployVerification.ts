import { performance } from 'node:perf_hooks';

export type VerificationProfile = 'production' | 'preview';

export interface VerificationCheck {
  name: string;
  path: string;
  expectedStatus: number;
  maxResponseMs?: number;
  validate?: (body: any) => string | null;
}

export interface VerificationResult {
  pass: boolean;
  name: string;
  detail: string;
}

interface SmokeOptions {
  apiKey?: string | null;
  baseUrl: string;
  expectedSha?: string | null;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  profile: VerificationProfile;
  quiet?: boolean;
}

interface ReadyOptions {
  baseUrl: string;
  expectedSha?: string | null;
  fetchImpl?: typeof fetch;
  intervalMs?: number;
  log?: (line: string) => void;
  timeoutMs?: number;
}

type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown' | 'ok';

function normalizeCommitSha(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function releaseMatchesExpected(
  actualCommitSha: string | null | undefined,
  expectedCommitSha: string | null | undefined,
): boolean {
  const actual = normalizeCommitSha(actualCommitSha);
  const expected = normalizeCommitSha(expectedCommitSha);

  if (!expected) return true;
  if (!actual) return false;

  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual);
}

function getHealthStatus(body: any): HealthStatus | null {
  return typeof body?.status === 'string' ? (body.status as HealthStatus) : null;
}

function validateRelease(body: any, expectedSha?: string | null): string | null {
  if (!expectedSha) return null;

  const actual = body?.release?.commit_sha;
  if (typeof actual !== 'string' || actual.length === 0) {
    return `Missing release.commit_sha (expected ${expectedSha.slice(0, 12)})`;
  }

  if (!releaseMatchesExpected(actual, expectedSha)) {
    return `Release commit ${actual.slice(0, 12)} does not match expected ${expectedSha.slice(0, 12)}`;
  }

  return null;
}

function validateHealthStatus(
  body: any,
  allowedStatuses: readonly HealthStatus[],
  label: string,
): string | null {
  const status = getHealthStatus(body);
  if (!status) return `Missing ${label} status`;
  if (!allowedStatuses.includes(status)) {
    return `${label} status ${status} is outside allowed set: ${allowedStatuses.join(', ')}`;
  }
  return null;
}

function validateProductionSyncFreshness(body: any): string | null {
  if (body?.status !== 'healthy') {
    return `Core sync status is ${body?.status ?? 'missing'}`;
  }

  if (!Array.isArray(body?.core_syncs)) return 'Missing core_syncs array';

  const degradedCoreSyncs = body.core_syncs.filter(
    (sync: any) => sync?.stale === true || sync?.lastSuccess === false,
  );

  if (degradedCoreSyncs.length > 0) {
    return `Non-healthy core syncs: ${degradedCoreSyncs.map((sync: any) => `${sync.type}:${sync.stale ? 'stale' : 'failed'}`).join(', ')}`;
  }

  return null;
}

export function getSmokeChecks(
  profile: VerificationProfile,
  expectedSha?: string | null,
): VerificationCheck[] {
  const readinessCheck: VerificationCheck = {
    name: 'Health (readiness)',
    path: '/api/health/ready',
    expectedStatus: 200,
    maxResponseMs: 1000,
    validate: (body) => validateRelease(body, expectedSha),
  };

  const baseChecks: VerificationCheck[] = [
    readinessCheck,
    {
      name: 'Health (deep)',
      path: '/api/health/deep',
      expectedStatus: 200,
      maxResponseMs: 3000,
      validate: (body) =>
        validateHealthStatus(
          body,
          profile === 'production' ? ['healthy'] : ['healthy', 'degraded'],
          'Deep health',
        ),
    },
    {
      name: 'DReps list',
      path: '/api/dreps',
      expectedStatus: 200,
      maxResponseMs: 6000,
      validate: (body) => {
        if (!Array.isArray(body?.dreps)) return 'Missing dreps array';
        if (body.dreps.length === 0) return 'Empty dreps array (expected data)';
        return null;
      },
    },
    {
      name: 'Public API v1 - DReps',
      path: '/api/v1/dreps?limit=20',
      expectedStatus: 200,
      maxResponseMs: 6000,
      validate: (body) => {
        if (!Array.isArray(body?.data)) return 'Missing data array';
        if (!body?.meta?.api_version) return 'Missing meta.api_version';
        if (profile === 'production') {
          const withScore = body.data.filter((d: any) => d.score != null && d.score > 0);
          if (withScore.length === 0) return 'No DReps have scores - scoring may be broken';
          const scorePct = (withScore.length / body.data.length) * 100;
          if (scorePct < 50) {
            return `Only ${scorePct.toFixed(0)}% of DReps have scores (expected >50%)`;
          }
        }
        return null;
      },
    },
    {
      name: 'Public API v1 - Governance Health',
      path: '/api/v1/governance/health',
      expectedStatus: 200,
      maxResponseMs: 6000,
      validate: (body) => {
        const data = body?.data;
        if (typeof data?.total_registered_dreps !== 'number') {
          return 'Missing total_registered_dreps';
        }
        if (!data?.score_distribution) return 'Missing score_distribution';
        if (profile === 'production') {
          if (data.total_registered_dreps < 100) {
            return `DRep count suspiciously low: ${data.total_registered_dreps}`;
          }
          if (data.total_votes < 1000) return `Vote count suspiciously low: ${data.total_votes}`;
          if (data.total_proposals < 10) {
            return `Proposal count suspiciously low: ${data.total_proposals}`;
          }
        }
        return null;
      },
    },
    {
      name: 'Auth nonce',
      path: '/api/auth/nonce',
      expectedStatus: 200,
      maxResponseMs: 1000,
      validate: (body) => {
        if (!body?.nonce || !body?.signature) return 'Missing nonce or signature';
        return null;
      },
    },
  ];

  if (profile === 'preview') {
    return baseChecks;
  }

  return [
    ...baseChecks,
    {
      name: 'Core sync health',
      path: '/api/health/sync',
      expectedStatus: 200,
      maxResponseMs: 3000,
      validate: (body) => {
        return validateProductionSyncFreshness(body);
      },
    },
  ];
}

export async function runVerificationCheck(
  baseUrl: string,
  check: VerificationCheck,
  fetchImpl: typeof fetch = fetch,
  apiKey?: string | null,
): Promise<VerificationResult> {
  const url = `${baseUrl}${check.path}`;
  const maxMs = check.maxResponseMs;
  const headers: Record<string, string> = { 'User-Agent': 'Governada-DeployVerify/1.0' };
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const startedAt = performance.now();
    const response = await fetchImpl(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    const elapsed = Math.round(performance.now() - startedAt);

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

export async function runSmokeChecks({
  apiKey = process.env.DEPLOY_VERIFY_API_KEY || process.env.SMOKE_TEST_API_KEY || null,
  baseUrl,
  expectedSha,
  fetchImpl = fetch,
  log = console.log,
  profile,
  quiet = false,
}: SmokeOptions): Promise<{ failed: number; results: VerificationResult[] }> {
  const checks = getSmokeChecks(profile, expectedSha);
  const results: VerificationResult[] = [];

  for (const check of checks) {
    results.push(await runVerificationCheck(baseUrl, check, fetchImpl, apiKey));
  }

  let failed = 0;
  for (const result of results) {
    if (!result.pass) {
      log(`  [FAIL] ${result.name} - ${result.detail}`);
      failed += 1;
    } else if (!quiet) {
      log(`  [PASS] ${result.name} - ${result.detail}`);
    }
  }

  return { failed, results };
}

export async function waitForReleaseReady({
  baseUrl,
  expectedSha,
  fetchImpl = fetch,
  intervalMs = 10_000,
  log = console.log,
  timeoutMs = 10 * 60 * 1000,
}: ReadyOptions): Promise<{ attempts: number; releaseCommitSha: string | null }> {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastReleaseCommitSha: string | null = null;
  let lastStatus = 'unreachable';

  while (Date.now() < deadline) {
    attempts += 1;

    try {
      const response = await fetchImpl(`${baseUrl}/api/health/ready`, {
        headers: { 'User-Agent': 'Governada-DeployVerify/1.0' },
        signal: AbortSignal.timeout(Math.min(intervalMs, 10_000)),
      });

      lastStatus = String(response.status);
      if (response.status === 200) {
        const body = await response.json();
        lastReleaseCommitSha = normalizeCommitSha(body?.release?.commit_sha);

        if (!expectedSha || releaseMatchesExpected(lastReleaseCommitSha, expectedSha)) {
          return { attempts, releaseCommitSha: lastReleaseCommitSha };
        }
      }
    } catch (error) {
      lastStatus = error instanceof Error ? error.message : String(error);
    }

    const releaseLabel = lastReleaseCommitSha
      ? ` release ${lastReleaseCommitSha.slice(0, 12)}`
      : '';
    log(
      `Waiting for ${baseUrl} to serve${expectedSha ? ` ${expectedSha.slice(0, 12)}` : ' readiness'} (attempt ${attempts}, last status ${lastStatus}${releaseLabel})`,
    );
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    expectedSha
      ? `Timed out waiting for ${baseUrl} to serve release ${expectedSha.slice(0, 12)}. Last observed status: ${lastStatus}${lastReleaseCommitSha ? ` (${lastReleaseCommitSha.slice(0, 12)})` : ''}`
      : `Timed out waiting for ${baseUrl} readiness. Last observed status: ${lastStatus}`,
  );
}
