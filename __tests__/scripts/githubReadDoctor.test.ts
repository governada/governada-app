import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  EXPECTED_READ_PERMISSIONS,
  EXPECTED_RETURNED_READ_PERMISSIONS,
  EXPECTED_REPO_NAME,
  buildInstallationTokenRequestBody,
  createGithubAppJwt,
  getGithubReadLaneConfig,
  githubReadPermissionFailures,
  redactSensitiveText,
  summarizeGithubReadPermissions,
  verifyGithubAppOwner,
} from '@/scripts/lib/github-app-auth.mjs';

function decodeJwtPart(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

describe('github read doctor guardrails', () => {
  it('classifies the autonomous lane as missing until all required inputs are present', () => {
    const config = getGithubReadLaneConfig({ NODE_ENV: 'test' });

    expect(config.missingKeys).toEqual([
      'GOVERNADA_GITHUB_APP_ID',
      'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
      'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
      'OP_SERVICE_ACCOUNT_TOKEN',
    ]);
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
    const redacted = redactSensitiveText(
      [
        'op://Governada-Automation/github-app/private-key',
        'github_pat_abc123',
        'ghs_abc123',
        'ops_abc123.service-account-token',
        'eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiIxMjMifQ.signature',
      ].join('\n'),
      ['service-account-token-value'],
    );

    expect(redacted).toContain('op://[redacted]');
    expect(redacted).toContain('github_pat_[redacted]');
    expect(redacted).toContain('[redacted-gh-installation-token]');
    expect(redacted).toContain('[redacted-op-service-account-token]');
    expect(redacted).toContain('[redacted-jwt]');
  });

  it('redacts the configured service-account token value exactly', () => {
    const redacted = redactSensitiveText(
      'op stderr echoed service-account-token-value during failure',
      ['service-account-token-value'],
    );

    expect(redacted).toBe('op stderr echoed [redacted-sensitive-value] during failure');
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
});
