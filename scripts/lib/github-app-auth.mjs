import { spawnSync } from 'node:child_process';
import { createSign } from 'node:crypto';

const OP_READ_TIMEOUT_MS = 15000;
const DEFAULT_GITHUB_API_VERSION = '2022-11-28';
const GITHUB_API_BASE_URL = 'https://api.github.com';
const RAW_GITHUB_TOKEN_KEYS = ['GH_TOKEN', 'GITHUB_TOKEN'];

export const EXPECTED_REPO = 'governada/app';
export const EXPECTED_OWNER = 'governada';
export const EXPECTED_REPO_NAME = 'app';
export const EXPECTED_READ_PERMISSIONS = Object.freeze({
  actions: 'read',
  checks: 'read',
  contents: 'read',
  pull_requests: 'read',
});
export const EXPECTED_RETURNED_READ_PERMISSIONS = Object.freeze({
  ...EXPECTED_READ_PERMISSIONS,
  metadata: 'read',
});
export const EXPECTED_WRITE_PR_PERMISSIONS = Object.freeze({
  pull_requests: 'write',
});
export const EXPECTED_RETURNED_WRITE_PR_PERMISSIONS = Object.freeze({
  ...EXPECTED_WRITE_PR_PERMISSIONS,
  metadata: 'read',
});

export const GITHUB_READ_ENV_KEYS = Object.freeze({
  appId: 'GOVERNADA_GITHUB_APP_ID',
  installationId: 'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
  privateKeyRef: 'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
  serviceAccountToken: 'OP_SERVICE_ACCOUNT_TOKEN',
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactSensitiveText(
  value,
  sensitiveValues = [process.env.OP_SERVICE_ACCOUNT_TOKEN],
) {
  const explicitSensitiveValues = sensitiveValues.filter(Boolean);
  let redacted = String(value || '');

  for (const sensitiveValue of explicitSensitiveValues) {
    redacted = redacted.replace(
      new RegExp(escapeRegExp(String(sensitiveValue)), 'g'),
      '[redacted-sensitive-value]',
    );
  }

  return redacted
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g, '[redacted-pem-block]')
    .replace(/op:\/\/[^\r\n'"]+/g, 'op://[redacted]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_[redacted]')
    .replace(/\bghs_[A-Za-z0-9_]+\b/g, '[redacted-gh-installation-token]')
    .replace(/\bgh[pour]_[A-Za-z0-9_]+\b/g, '[redacted-gh-token]')
    .replace(/\bops_[A-Za-z0-9._-]+\b/g, '[redacted-op-service-account-token]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]');
}

export function getGithubReadLaneConfig(env = process.env) {
  const config = {
    appId: env[GITHUB_READ_ENV_KEYS.appId] || '',
    installationId: env[GITHUB_READ_ENV_KEYS.installationId] || '',
    privateKeyRef: env[GITHUB_READ_ENV_KEYS.privateKeyRef] || '',
    serviceAccountTokenPresent: Boolean(env[GITHUB_READ_ENV_KEYS.serviceAccountToken]),
    rawGithubTokenKeys: RAW_GITHUB_TOKEN_KEYS.filter((key) => Boolean(env[key])),
    opConnectKeys: ['OP_CONNECT_HOST', 'OP_CONNECT_TOKEN'].filter((key) => Boolean(env[key])),
  };

  return {
    ...config,
    missingKeys: missingGithubReadLaneKeys(config),
  };
}

export function missingGithubReadLaneKeys(config) {
  const missing = [];

  if (!config.appId) {
    missing.push(GITHUB_READ_ENV_KEYS.appId);
  }

  if (!config.installationId) {
    missing.push(GITHUB_READ_ENV_KEYS.installationId);
  }

  if (!config.privateKeyRef) {
    missing.push(GITHUB_READ_ENV_KEYS.privateKeyRef);
  }

  if (!config.serviceAccountTokenPresent) {
    missing.push(GITHUB_READ_ENV_KEYS.serviceAccountToken);
  }

  return missing;
}

export function isValidOpReference(value) {
  return /^op:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+/.test(value);
}

/**
 * @param {string} repoName
 * @param {Record<string, string>} permissions
 */
export function buildInstallationTokenRequestBody(
  repoName = EXPECTED_REPO_NAME,
  permissions = EXPECTED_READ_PERMISSIONS,
) {
  return {
    repositories: [repoName],
    permissions,
  };
}

export function githubPermissionFailures(permissions = {}, expectedPermissions = {}) {
  const expectedKeys = new Set(Object.keys(expectedPermissions));
  const failures = [];

  for (const [key, value] of Object.entries(permissions)) {
    if (!expectedKeys.has(key)) {
      failures.push(`${key}=${value} (unexpected permission)`);
    } else if (value !== expectedPermissions[key]) {
      failures.push(`${key}=${value} (expected ${expectedPermissions[key]})`);
    }
  }

  for (const [key, expected] of Object.entries(expectedPermissions)) {
    if (permissions[key] === undefined) {
      failures.push(`${key}=missing (expected ${expected})`);
    }
  }

  return failures;
}

export function summarizeGithubPermissions(permissions = {}, expectedPermissions = {}) {
  const expected = Object.entries(expectedPermissions).map(
    ([key, expectedPermission]) =>
      `${key}=${permissions[key] || 'missing'} (expected ${expectedPermission})`,
  );
  const unexpected = Object.entries(permissions)
    .filter(([key]) => !Object.hasOwn(expectedPermissions, key))
    .map(([key, value]) => `${key}=${value} (unexpected permission)`);

  return [...expected, ...unexpected].join(', ');
}

export function githubReadPermissionFailures(permissions = {}) {
  return githubPermissionFailures(permissions, EXPECTED_RETURNED_READ_PERMISSIONS);
}

export function summarizeGithubReadPermissions(permissions = {}) {
  return summarizeGithubPermissions(permissions, EXPECTED_RETURNED_READ_PERMISSIONS);
}

export function githubWritePrPermissionFailures(permissions = {}) {
  return githubPermissionFailures(permissions, EXPECTED_RETURNED_WRITE_PR_PERMISSIONS);
}

export function summarizeGithubWritePrPermissions(permissions = {}) {
  return summarizeGithubPermissions(permissions, EXPECTED_RETURNED_WRITE_PR_PERMISSIONS);
}

export function base64UrlEncodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function createGithubAppJwt({ appId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };
  const payload = {
    iat: now - 60,
    exp: now + 540,
    iss: appId,
  };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(privateKey, 'base64url');

  return `${signingInput}.${signature}`;
}

export function readPrivateKeyFromOnePassword({ privateKeyRef, env, cwd }) {
  const result = spawnSync('op', ['read', privateKeyRef], {
    cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: OP_READ_TIMEOUT_MS,
  });

  if (result.error?.code === 'ENOENT') {
    return {
      error: '1Password CLI (`op`) is not installed or not on PATH.',
    };
  }

  if (result.error?.code === 'ETIMEDOUT' || result.signal) {
    return {
      error:
        '1Password service-account read timed out. Verify OP_SERVICE_ACCOUNT_TOKEN and the narrow automation vault before using the autonomous GitHub lane.',
    };
  }

  if (result.status !== 0) {
    const detail = redactSensitiveText(result.stderr || result.stdout || '').trim();
    return {
      error: `1Password service-account read failed${detail ? `: ${detail}` : ''}`,
    };
  }

  const privateKey = result.stdout.trim();
  if (!privateKey) {
    return {
      error: 'GitHub App private key reference resolved to an empty value.',
    };
  }

  return { privateKey };
}

export async function githubApiRequest({
  path,
  token,
  method = 'GET',
  body = undefined,
  tokenType = 'Bearer',
  timeoutMs = 15000,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `${tokenType} ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'governada-agent-auth-doctor',
        'X-GitHub-Api-Version': DEFAULT_GITHUB_API_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message ? `: ${error.message}` : '';
    return {
      ok: false,
      status: 0,
      data: {
        message: redactSensitiveText(`${errorName}${errorMessage}`),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function githubGraphqlRequest({ query, variables = {}, token, timeoutMs = 15000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${GITHUB_API_BASE_URL}/graphql`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'governada-agent-auth-doctor',
        'X-GitHub-Api-Version': DEFAULT_GITHUB_API_VERSION,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    return {
      ok: response.ok && !data?.errors?.length,
      status: response.status,
      data,
    };
  } catch (error) {
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message ? `: ${error.message}` : '';
    return {
      ok: false,
      status: 0,
      data: {
        message: redactSensitiveText(`${errorName}${errorMessage}`),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function mintInstallationToken({
  appId,
  installationId,
  privateKey,
  permissions = EXPECTED_READ_PERMISSIONS,
}) {
  let jwt;
  try {
    jwt = createGithubAppJwt({ appId, privateKey });
  } catch (error) {
    return {
      error: redactSensitiveText(
        `GitHub App installation token mint failed before API request: ${error?.message || String(error)}`,
      ),
      status: 0,
    };
  }

  const response = await githubApiRequest({
    path: `/app/installations/${installationId}/access_tokens`,
    token: jwt,
    method: 'POST',
    body: buildInstallationTokenRequestBody(EXPECTED_REPO_NAME, permissions),
  });

  if (!response.ok) {
    return {
      error: githubApiErrorMessage(response, 'GitHub App installation token mint failed'),
      status: response.status,
    };
  }

  if (!response.data?.token) {
    return {
      error: 'GitHub App installation token mint response did not include a token.',
      status: response.status,
    };
  }

  return {
    expiresAt: response.data.expires_at || '',
    permissions: response.data.permissions || {},
    repositories: response.data.repositories || [],
    token: response.data.token,
  };
}

export function githubApiErrorMessage(response, prefix) {
  const graphQlErrors = response.data?.errors
    ?.map((error) => error?.message)
    .filter(Boolean)
    .join('; ');
  const detail = response.data?.message
    ? `: ${response.data.message}`
    : graphQlErrors
      ? `: ${graphQlErrors}`
      : '';
  return redactSensitiveText(`${prefix} (${response.status})${detail}`);
}

export async function verifyGithubAppOwner({ appId, privateKey, expectedOwner = EXPECTED_OWNER }) {
  let jwt;
  try {
    jwt = createGithubAppJwt({ appId, privateKey });
  } catch (error) {
    return {
      error: redactSensitiveText(
        `GitHub App metadata read failed before API request: ${error?.message || String(error)}`,
      ),
      status: 0,
    };
  }

  const response = await githubApiRequest({
    path: '/app',
    token: jwt,
  });

  if (!response.ok) {
    return {
      error: githubApiErrorMessage(response, 'GitHub App metadata read failed'),
      status: response.status,
    };
  }

  const ownerLogin = response.data?.owner?.login || '';
  if (ownerLogin !== expectedOwner) {
    return {
      error: `GitHub App owner is ${ownerLogin || 'unknown'}, expected ${expectedOwner}`,
      ownerLogin,
      status: response.status,
    };
  }

  return {
    ownerLogin,
  };
}
