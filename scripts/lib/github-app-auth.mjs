import { spawnSync } from 'node:child_process';
import { createSign } from 'node:crypto';

const OP_READ_TIMEOUT_MS = 15000;
const DEFAULT_GITHUB_API_VERSION = '2022-11-28';
const GITHUB_API_BASE_URL = 'https://api.github.com';
const RAW_GITHUB_TOKEN_KEYS = ['GH_TOKEN', 'GITHUB_TOKEN'];
const ISO_DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/u;
const ISO_TIMESTAMP_WITH_TIMEZONE_RE =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

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
export const EXPECTED_SHIP_PR_PERMISSIONS = Object.freeze({
  actions: 'read',
  checks: 'read',
  contents: 'write',
  pull_requests: 'write',
});
export const EXPECTED_RETURNED_SHIP_PR_PERMISSIONS = Object.freeze({
  ...EXPECTED_SHIP_PR_PERMISSIONS,
  metadata: 'read',
});
export const EXPECTED_MERGE_PERMISSIONS = Object.freeze({
  actions: 'read',
  checks: 'read',
  contents: 'write',
  pull_requests: 'write',
});
export const EXPECTED_RETURNED_MERGE_PERMISSIONS = Object.freeze({
  ...EXPECTED_MERGE_PERMISSIONS,
  metadata: 'read',
});
export const GITHUB_OPERATION_CLASSES = Object.freeze({
  read: 'github.read',
  writePr: 'github.write.pr',
  shipPr: 'github.ship.pr',
  merge: 'github.merge',
});

export const GITHUB_READ_ENV_KEYS = Object.freeze({
  appId: 'GOVERNADA_GITHUB_APP_ID',
  installationId: 'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
  privateKeyRef: 'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
  serviceAccountToken: 'OP_SERVICE_ACCOUNT_TOKEN',
});
export const GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS = Object.freeze({
  expiresAt: 'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT',
  rotateAfter: 'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER',
});
export const FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS = Object.freeze([
  GITHUB_READ_ENV_KEYS.serviceAccountToken,
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'OP_CONNECT_HOST',
  'OP_CONNECT_TOKEN',
]);
export const GITHUB_APP_LOCAL_ENV_KEYS = Object.freeze([
  GITHUB_READ_ENV_KEYS.appId,
  GITHUB_READ_ENV_KEYS.installationId,
  GITHUB_READ_ENV_KEYS.privateKeyRef,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter,
]);

const SERVICE_ACCOUNT_EXPIRY_BLOCKER_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    serviceAccountExpiresAt: env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt] || '',
    serviceAccountRotateAfter: env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter] || '',
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

export function evaluateGithubServiceAccountRuntime(env = process.env, now = new Date()) {
  const blockers = [];
  const advisories = [];
  const passes = [];
  const tokenPresent = Boolean(env[GITHUB_READ_ENV_KEYS.serviceAccountToken]);
  const expiresAtValue = env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt] || '';
  const rotateAfterValue = env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter] || '';
  const nowMs = now.getTime();

  if (tokenPresent) {
    passes.push('service-account token is present only in process env');
  } else {
    passes.push('service-account token is not present in this process');
  }

  const expiresAt = parseRuntimeDate(
    expiresAtValue,
    GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt,
    tokenPresent,
    blockers,
    advisories,
  );
  const rotateAfter = parseRuntimeDate(
    rotateAfterValue,
    GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter,
    tokenPresent,
    blockers,
    advisories,
  );

  if (expiresAt) {
    const expiresInMs = expiresAt.getTime() - nowMs;
    if (expiresInMs <= 0) {
      blockers.push(
        `service-account token metadata says token expired at ${expiresAt.toISOString()}`,
      );
    } else if (tokenPresent && expiresInMs <= SERVICE_ACCOUNT_EXPIRY_BLOCKER_WINDOW_MS) {
      blockers.push(
        `service-account token expires within 24 hours at ${expiresAt.toISOString()}; rotate before live GitHub App use`,
      );
    } else {
      passes.push(`service-account token expiry metadata is ${expiresAt.toISOString()}`);
    }
  }

  if (rotateAfter && expiresAt && rotateAfter.getTime() > expiresAt.getTime()) {
    blockers.push(
      `${GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter} must be on or before ${GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt}`,
    );
  } else if (rotateAfter) {
    if (rotateAfter.getTime() <= nowMs) {
      advisories.push(
        `service-account token rotation window opened at ${rotateAfter.toISOString()}; prepare human-executed rotation`,
      );
    } else {
      passes.push(`service-account token rotation window opens at ${rotateAfter.toISOString()}`);
    }
  }

  return {
    advisories,
    blockers,
    expiresAt: expiresAt?.toISOString() || '',
    passes,
    rotateAfter: rotateAfter?.toISOString() || '',
    tokenPresent,
  };
}

function parseRuntimeDate(value, key, tokenPresent, blockers, advisories) {
  if (!value) {
    const message = `${key} is missing; record non-secret service-account rotation metadata`;
    if (tokenPresent) {
      blockers.push(`${message} before live GitHub App use`);
    } else {
      advisories.push(message);
    }
    return null;
  }

  const dateOnlyMatch = value.match(ISO_DATE_ONLY_RE);
  const timestampMatch = value.match(ISO_TIMESTAMP_WITH_TIMEZONE_RE);
  if (!dateOnlyMatch && !timestampMatch) {
    blockers.push(`${key} must be YYYY-MM-DD or a timezone-qualified ISO timestamp`);
    return null;
  }

  const match = dateOnlyMatch || timestampMatch;
  if (!isValidDateParts(match[1], match[2], match[3])) {
    blockers.push(`${key} must contain a real calendar date`);
    return null;
  }

  const normalized = dateOnlyMatch ? `${value}T00:00:00Z` : value;
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) {
    blockers.push(`${key} must be YYYY-MM-DD or a timezone-qualified ISO timestamp`);
    return null;
  }

  return new Date(timestamp);
}

function isValidDateParts(yearValue, monthValue, dayValue) {
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
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

export function githubShipPrPermissionFailures(permissions = {}) {
  return githubPermissionFailures(permissions, EXPECTED_RETURNED_SHIP_PR_PERMISSIONS);
}

export function summarizeGithubShipPrPermissions(permissions = {}) {
  return summarizeGithubPermissions(permissions, EXPECTED_RETURNED_SHIP_PR_PERMISSIONS);
}

export function githubMergePermissionFailures(permissions = {}) {
  return githubPermissionFailures(permissions, EXPECTED_RETURNED_MERGE_PERMISSIONS);
}

export function summarizeGithubMergePermissions(permissions = {}) {
  return summarizeGithubPermissions(permissions, EXPECTED_RETURNED_MERGE_PERMISSIONS);
}

export function githubPermissionsForOperationClass(operationClass) {
  if (operationClass === GITHUB_OPERATION_CLASSES.read) {
    return EXPECTED_READ_PERMISSIONS;
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.writePr) {
    return EXPECTED_WRITE_PR_PERMISSIONS;
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.shipPr) {
    return EXPECTED_SHIP_PR_PERMISSIONS;
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.merge) {
    return EXPECTED_MERGE_PERMISSIONS;
  }

  throw new Error(`Unsupported GitHub operation class: ${operationClass}`);
}

export function githubPermissionFailuresForOperationClass(operationClass, permissions = {}) {
  if (operationClass === GITHUB_OPERATION_CLASSES.read) {
    return githubReadPermissionFailures(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.writePr) {
    return githubWritePrPermissionFailures(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.shipPr) {
    return githubShipPrPermissionFailures(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.merge) {
    return githubMergePermissionFailures(permissions);
  }

  throw new Error(`Unsupported GitHub operation class: ${operationClass}`);
}

export function summarizeGithubPermissionsForOperationClass(operationClass, permissions = {}) {
  if (operationClass === GITHUB_OPERATION_CLASSES.read) {
    return summarizeGithubReadPermissions(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.writePr) {
    return summarizeGithubWritePrPermissions(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.shipPr) {
    return summarizeGithubShipPrPermissions(permissions);
  }

  if (operationClass === GITHUB_OPERATION_CLASSES.merge) {
    return summarizeGithubMergePermissions(permissions);
  }

  throw new Error(`Unsupported GitHub operation class: ${operationClass}`);
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
      : response.error
        ? `: ${response.error}`
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
