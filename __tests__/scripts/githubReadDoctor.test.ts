import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EXPECTED_READ_PERMISSIONS,
  EXPECTED_RETURNED_MERGE_PERMISSIONS,
  EXPECTED_RETURNED_READ_PERMISSIONS,
  EXPECTED_RETURNED_SHIP_PR_PERMISSIONS,
  EXPECTED_RETURNED_WRITE_PR_PERMISSIONS,
  EXPECTED_REPO_NAME,
  EXPECTED_SHIP_PR_PERMISSIONS,
  EXPECTED_WRITE_PR_PERMISSIONS,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  buildInstallationTokenRequestBody,
  createGithubAppJwt,
  evaluateGithubServiceAccountRuntime,
  getGithubReadLaneConfig,
  githubApiRequest,
  githubMergePermissionFailures,
  githubReadPermissionFailures,
  githubShipPrPermissionFailures,
  githubWritePrPermissionFailures,
  mintInstallationToken,
  redactSensitiveText,
  summarizeGithubMergePermissions,
  summarizeGithubReadPermissions,
  summarizeGithubShipPrPermissions,
  summarizeGithubWritePrPermissions,
  verifyGithubAppOwner,
} from '@/scripts/lib/github-app-auth.mjs';

function decodeJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

describe('github read doctor guardrails', () => {
  it('routes the app wrapper through the stable agent-runtime host with explicit legacy fallback', () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const wrapper = readFileSync(
      path.join(process.cwd(), 'scripts/github-read-doctor.mjs'),
      'utf8',
    );

    expect(packageJson.scripts['github:read-doctor']).toBe('node scripts/github-read-doctor.mjs');
    expect(packageJson.scripts['github:read-doctor:legacy']).toBe(
      'node scripts/github-read-doctor.mjs --legacy',
    );
    expect(wrapper).toContain('/Users/tim/dev/agent-runtime/bin/agent-runtime');
    expect(wrapper).toContain("'github'");
    expect(wrapper).toContain("'doctor'");
    expect(wrapper).toContain("'--domain'");
    expect(wrapper).toContain("'governada'");
    expect(wrapper).toContain("'--operation'");
    expect(wrapper).toContain("'github.read'");
    expect(wrapper).toContain('github-read-doctor-app.mjs');
    expect(wrapper).toContain('Compatibility fallback');
    expect(wrapper).not.toContain('readPrivateKeyFromOnePassword');
    expect(wrapper).not.toContain('mintInstallationToken');
  });

  it('classifies the autonomous lane as missing until all required inputs are present', () => {
    const config = getGithubReadLaneConfig({ NODE_ENV: 'test' });

    expect(config.missingKeys).toEqual([
      'GOVERNADA_GITHUB_APP_ID',
      'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
      'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
      'OP_SERVICE_ACCOUNT_TOKEN',
    ]);
  });

  it('blocks live service-account use when rotation metadata is missing', () => {
    const runtime = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
      },
      new Date('2026-04-25T12:00:00Z'),
    );

    expect(runtime.tokenPresent).toBe(true);
    expect(runtime.blockers).toEqual([
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT is missing; record non-secret service-account rotation metadata before live GitHub App use',
      'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER is missing; record non-secret service-account rotation metadata before live GitHub App use',
    ]);
  });

  it('allows absent service-account token with advisory-only rotation metadata gaps', () => {
    const runtime = evaluateGithubServiceAccountRuntime(
      { NODE_ENV: 'test' },
      new Date('2026-04-25T12:00:00Z'),
    );

    expect(runtime.tokenPresent).toBe(false);
    expect(runtime.blockers).toEqual([]);
    expect(runtime.advisories).toEqual([
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT is missing; record non-secret service-account rotation metadata',
      'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER is missing; record non-secret service-account rotation metadata',
    ]);
  });

  it('advises when the service-account rotation window is open but token is not expired', () => {
    const runtime = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]: '2026-05-01T00:00:00Z',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]: '2026-04-24T00:00:00Z',
      },
      new Date('2026-04-25T12:00:00Z'),
    );

    expect(runtime.blockers).toEqual([]);
    expect(runtime.advisories).toEqual([
      'service-account token rotation window opened at 2026-04-24T00:00:00.000Z; prepare human-executed rotation',
    ]);
  });

  it('blocks expired or near-expiry service-account metadata during live use', () => {
    const expired = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]: '2026-04-25T11:59:59Z',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]: '2026-04-18T00:00:00Z',
      },
      new Date('2026-04-25T12:00:00Z'),
    );
    const nearExpiry = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]: '2026-04-26T11:00:00Z',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]: '2026-04-18T00:00:00Z',
      },
      new Date('2026-04-25T12:00:00Z'),
    );

    expect(expired.blockers).toContain(
      'service-account token metadata says token expired at 2026-04-25T11:59:59.000Z',
    );
    expect(nearExpiry.blockers).toContain(
      'service-account token expires within 24 hours at 2026-04-26T11:00:00.000Z; rotate before live GitHub App use',
    );
  });

  it('rejects ambiguous or impossible service-account metadata dates', () => {
    const ambiguous = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]: '2026-05-25T00:00:00',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]: '2026-05-18',
      },
      new Date('2026-04-25T12:00:00Z'),
    );
    const impossible = evaluateGithubServiceAccountRuntime(
      {
        NODE_ENV: 'test',
        [GITHUB_READ_ENV_KEYS.serviceAccountToken]: 'ops_example.service-account-token',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]: '2026-02-31',
        [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]: '2026-02-30T00:00:00Z',
      },
      new Date('2026-04-25T12:00:00Z'),
    );

    expect(ambiguous.blockers).toContain(
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT must be YYYY-MM-DD or a timezone-qualified ISO timestamp',
    );
    expect(impossible.blockers).toContain(
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT must contain a real calendar date',
    );
    expect(impossible.blockers).toContain(
      'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER must contain a real calendar date',
    );
  });

  it('rejects inherited raw GitHub token env for the autonomous lane', () => {
    const config = getGithubReadLaneConfig({
      GH_TOKEN: 'ghp_example',
      GITHUB_TOKEN: 'github_pat_example',
      NODE_ENV: 'test',
    });

    expect(config.rawGithubTokenKeys).toEqual(['GH_TOKEN', 'GITHUB_TOKEN']);
  });

  it('requests only the expected repository and read permissions for installation tokens', () => {
    const body = buildInstallationTokenRequestBody();

    expect(body.repositories).toEqual([EXPECTED_REPO_NAME]);
    expect(body.permissions).toEqual(EXPECTED_READ_PERMISSIONS);
    expect(Object.values(body.permissions).every((permission) => permission === 'read')).toBe(true);
    expect(body).not.toHaveProperty('repository_ids');
  });

  it('requests only the expected repository and bounded PR-write permissions for write-lane tokens', () => {
    const body = buildInstallationTokenRequestBody(
      EXPECTED_REPO_NAME,
      EXPECTED_WRITE_PR_PERMISSIONS,
    );

    expect(body.repositories).toEqual([EXPECTED_REPO_NAME]);
    expect(body.permissions).toEqual(EXPECTED_WRITE_PR_PERMISSIONS);
    expect(body.permissions).toEqual({
      pull_requests: 'write',
    });
    expect(body.permissions).not.toHaveProperty('administration');
    expect(body.permissions).not.toHaveProperty('deployments');
    expect(body.permissions).not.toHaveProperty('secrets');
    expect(body.permissions).not.toHaveProperty('workflows');
    expect(body).not.toHaveProperty('repository_ids');
  });

  it('requests only the expected repository and bounded ship-lane permissions', () => {
    const body = buildInstallationTokenRequestBody(
      EXPECTED_REPO_NAME,
      EXPECTED_SHIP_PR_PERMISSIONS,
    );

    expect(body.repositories).toEqual([EXPECTED_REPO_NAME]);
    expect(body.permissions).toEqual({
      actions: 'read',
      checks: 'read',
      contents: 'write',
      pull_requests: 'write',
    });
    expect(body.permissions).not.toHaveProperty('administration');
    expect(body.permissions).not.toHaveProperty('deployments');
    expect(body.permissions).not.toHaveProperty('secrets');
    expect(body.permissions).not.toHaveProperty('workflows');
    expect(body).not.toHaveProperty('repository_ids');
  });

  it('rejects extra or elevated installation-token permissions', () => {
    const failures = githubReadPermissionFailures({
      ...EXPECTED_RETURNED_READ_PERMISSIONS,
      contents: 'write',
      administration: 'write',
    });

    expect(failures).toEqual([
      'contents=write (expected read)',
      'administration=write (unexpected permission)',
    ]);
    expect(
      summarizeGithubReadPermissions({
        ...EXPECTED_RETURNED_READ_PERMISSIONS,
        administration: 'write',
      }),
    ).toContain('administration=write (unexpected permission)');
  });

  it('accepts GitHub metadata read as an implicit returned installation-token permission', () => {
    expect(githubReadPermissionFailures(EXPECTED_RETURNED_READ_PERMISSIONS)).toEqual([]);
    expect(summarizeGithubReadPermissions(EXPECTED_RETURNED_READ_PERMISSIONS)).toContain(
      'metadata=read (expected read)',
    );
  });

  it('accepts GitHub metadata read as an implicit returned write-lane permission', () => {
    expect(githubWritePrPermissionFailures(EXPECTED_RETURNED_WRITE_PR_PERMISSIONS)).toEqual([]);
    expect(summarizeGithubWritePrPermissions(EXPECTED_RETURNED_WRITE_PR_PERMISSIONS)).toContain(
      'metadata=read (expected read)',
    );
  });

  it('accepts GitHub metadata read as an implicit returned ship-lane permission', () => {
    expect(githubShipPrPermissionFailures(EXPECTED_RETURNED_SHIP_PR_PERMISSIONS)).toEqual([]);
    expect(summarizeGithubShipPrPermissions(EXPECTED_RETURNED_SHIP_PR_PERMISSIONS)).toContain(
      'metadata=read (expected read)',
    );
  });

  it('accepts GitHub metadata read as an implicit returned merge-lane permission', () => {
    expect(githubMergePermissionFailures(EXPECTED_RETURNED_MERGE_PERMISSIONS)).toEqual([]);
    expect(summarizeGithubMergePermissions(EXPECTED_RETURNED_MERGE_PERMISSIONS)).toContain(
      'metadata=read (expected read)',
    );
  });

  it('rejects missing, extra, or elevated write-lane installation-token permissions', () => {
    const failures = githubWritePrPermissionFailures({
      ...EXPECTED_RETURNED_WRITE_PR_PERMISSIONS,
      checks: 'write',
      administration: 'write',
    });

    expect(failures).toEqual([
      'checks=write (unexpected permission)',
      'administration=write (unexpected permission)',
    ]);
    expect(
      githubWritePrPermissionFailures({
        pull_requests: 'write',
        metadata: 'read',
      }),
    ).toEqual([]);
  });

  it('rejects admin, secrets, deployments, workflows, or elevated ship-lane permissions', () => {
    const failures = githubShipPrPermissionFailures({
      ...EXPECTED_RETURNED_SHIP_PR_PERMISSIONS,
      actions: 'write',
      administration: 'write',
      deployments: 'write',
      secrets: 'write',
      workflows: 'write',
    });

    expect(failures).toEqual([
      'actions=write (expected read)',
      'administration=write (unexpected permission)',
      'deployments=write (unexpected permission)',
      'secrets=write (unexpected permission)',
      'workflows=write (unexpected permission)',
    ]);
  });

  it('rejects admin, secrets, deployments, workflows, or elevated merge-lane permissions', () => {
    const failures = githubMergePermissionFailures({
      ...EXPECTED_RETURNED_MERGE_PERMISSIONS,
      checks: 'write',
      administration: 'write',
      deployments: 'write',
      secrets: 'write',
      workflows: 'write',
    });

    expect(failures).toEqual([
      'checks=write (expected read)',
      'administration=write (unexpected permission)',
      'deployments=write (unexpected permission)',
      'secrets=write (unexpected permission)',
      'workflows=write (unexpected permission)',
    ]);
  });

  it('creates a short-lived GitHub App JWT without embedding secret material in claims', () => {
    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const jwt = createGithubAppJwt({
      appId: '12345',
      now: 1_700_000_000,
      privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    });
    const [headerPart, payloadPart, signaturePart] = jwt.split('.');

    expect(headerPart).toBeTruthy();
    expect(payloadPart).toBeTruthy();
    expect(signaturePart).toBeTruthy();
    expect(decodeJwtPart(headerPart)).toMatchObject({ alg: 'RS256', typ: 'JWT' });
    expect(decodeJwtPart(payloadPart)).toMatchObject({
      exp: 1_700_000_540,
      iat: 1_699_999_940,
      iss: '12345',
    });
  });

  it('redacts token-like values and op references from diagnostic output', () => {
    const privateKeyLabel = 'PRIVATE KEY';
    const pemBlock = [
      `-----BEGIN ${privateKeyLabel}-----`,
      'secret',
      `-----END ${privateKeyLabel}-----`,
    ].join('\n');
    const redacted = redactSensitiveText(
      [
        'op://Governada-Automation/github-app/private-key',
        'github_pat_abc123',
        'ghs_abc123',
        'ops_abc123.service-account-token',
        'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIxMjMifQ.signature',
        pemBlock,
      ].join('\n'),
      ['service-account-token-value'],
    );

    expect(redacted).toContain('op://[redacted]');
    expect(redacted).toContain('github_pat_[redacted]');
    expect(redacted).toContain('[redacted-gh-installation-token]');
    expect(redacted).toContain('[redacted-op-service-account-token]');
    expect(redacted).toContain('[redacted-jwt]');
    expect(redacted).toContain('[redacted-pem-block]');
    expect(redacted).not.toContain('secret');
  });

  it('redacts the configured service-account token value exactly', () => {
    const redacted = redactSensitiveText(
      'op stderr echoed service-account-token-value during failure',
      ['service-account-token-value'],
    );

    expect(redacted).toBe('op stderr echoed [redacted-sensitive-value] during failure');
  });

  it('uses non-interactive op read flags for GitHub App private key reads', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'scripts/lib/github-app-auth.mjs'),
      'utf8',
    );

    expect(source).toContain("['read', privateKeyRef, '--no-newline', '--force']");
  });

  it('keeps the broker private key cache process-local', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'scripts/github-runtime-broker.mjs'),
      'utf8',
    );

    expect(source).toContain('let privateKeyCache = null');
    expect(source).toContain('readCachedPrivateKeyFromOnePassword');
    expect(source).not.toContain('writeFileSync(privateKey');
  });

  it('rejects GitHub Apps owned outside the expected Governada org', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          owner: {
            login: 'tim-governada',
          },
        }),
        {
          status: 200,
        },
      );

    try {
      const { privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const result = await verifyGithubAppOwner({
        appId: '12345',
        expectedOwner: 'governada',
        privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      });

      expect(result.error).toBe('GitHub App owner is tim-governada, expected governada');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('classifies GitHub API fetch failures without throwing', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new DOMException('network unavailable for test', 'AbortError');
    };

    try {
      const result = await githubApiRequest({
        path: '/repos/governada/app',
        token: 'ghs_example',
      });

      expect(result).toMatchObject({
        ok: false,
        status: 0,
      });
      expect(result.data?.message).toContain('AbortError');
      expect(result.data?.message).toContain('network unavailable for test');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('classifies malformed private keys before minting installation tokens', async () => {
    const result = await mintInstallationToken({
      appId: '12345',
      installationId: '67890',
      privateKey: 'not a pem key',
    });

    expect(result.status).toBe(0);
    expect(result.error).toContain('GitHub App installation token mint failed before API request');
  });
});
