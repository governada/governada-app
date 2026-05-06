#!/usr/bin/env node

import { createSign } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const REQUIRED_ENV = [
  'GOVERNADA_GITHUB_CLIENT_ID',
  'GOVERNADA_GITHUB_INSTALLATION_ID',
  'GOVERNADA_GITHUB_APP_PRIVATE_KEY',
];

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('=', '')
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

function redactSensitiveText(text) {
  return String(text || '')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{12,}\b/gu, '[redacted-github-token]')
    .replace(/-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gu, '[redacted-pem]')
    .replace(/"token"\s*:\s*"[^"]+"/gu, '"token":"[redacted-github-token]"');
}

export function normalizePrivateKey(privateKey) {
  const normalized = privateKey.replace(/\\n/gu, '\n').replace(/\\r/gu, '\r').trim();
  if (normalized.includes('\n')) {
    return normalized;
  }

  const match = normalized.match(/^(-----BEGIN [^-]+-----)(.+)(-----END [^-]+-----)$/u);
  if (!match) {
    return normalized;
  }

  const [, begin, body, end] = match;
  const wrappedBody = body
    .replace(/\s/gu, '')
    .match(/.{1,64}/gu)
    ?.join('\n');

  return `${begin}\n${wrappedBody || body}\n${end}`;
}

export function mintAppJwt({ clientId, privateKey, now = Math.floor(Date.now() / 1000) }) {
  const normalizedPrivateKey = normalizePrivateKey(privateKey);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientId,
    iat: now - 60,
    exp: now + 540,
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(normalizedPrivateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

function validateEnv(env) {
  for (const key of REQUIRED_ENV) {
    if (!env[key]) {
      throw new Error(`${key} is missing.`);
    }
  }
}

export async function requestInstallationToken({
  clientId,
  installationId,
  privateKey,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('global fetch is not available.');
  }

  const jwt = mintAppJwt({ clientId, privateKey });
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'governada-agent-app-token-minter',
      },
    },
  );

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error(
      `GitHub installation-token response was not JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (response.status !== 201) {
    const detail = redactSensitiveText(JSON.stringify(body));
    throw new Error(
      `GitHub installation-token mint failed with HTTP ${response.status}: ${detail}`,
    );
  }

  if (!body?.token || typeof body.token !== 'string') {
    throw new Error('GitHub installation-token response did not include a token.');
  }

  return body.token;
}

export async function main(env = process.env, fetchImpl = globalThis.fetch) {
  validateEnv(env);
  const token = await requestInstallationToken({
    clientId: env.GOVERNADA_GITHUB_CLIENT_ID,
    installationId: env.GOVERNADA_GITHUB_INSTALLATION_ID,
    privateKey: env.GOVERNADA_GITHUB_APP_PRIVATE_KEY,
    fetchImpl,
  });
  process.stdout.write(`${token}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(redactSensitiveText(`BLOCKED: ${message}`));
    process.exit(1);
  });
}
