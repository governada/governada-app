import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { getContext } = require('../set-gh-context.js');
const { withGhTokenFromOnePassword } = require('./gh-auth.js');
const { runGhWithCachedToken } = require('./gh-token-cache.js');

function findRepoRoot(startDir) {
  let current = startDir;

  while (true) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Unable to locate repo root from ${startDir}`);
    }

    current = parent;
  }
}

export function getScriptContext(metaUrl) {
  const scriptPath = fileURLToPath(metaUrl);
  const scriptDir = path.dirname(scriptPath);
  const repoRoot = findRepoRoot(scriptDir);

  return { repoRoot, scriptDir, scriptPath };
}

function keyAllowed(key, keyFilter) {
  if (!keyFilter) {
    return true;
  }

  return keyFilter.some((entry) => {
    if (entry.endsWith('*')) {
      return key.startsWith(entry.slice(0, -1));
    }

    return key === entry;
  });
}

export function loadLocalEnv(metaUrl, keyFilter = null) {
  const { repoRoot } = getScriptContext(metaUrl);
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(repoRoot, '.env.local'),
  ].filter(Boolean);
  const seen = new Set();

  for (const envPath of candidates) {
    const resolved = path.resolve(envPath);
    if (seen.has(resolved) || !existsSync(resolved)) {
      continue;
    }

    seen.add(resolved);
    const parsed = parseEnvFile(readFileSync(resolved, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!keyAllowed(key, keyFilter)) {
        continue;
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return resolved;
  }

  return null;
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

export function requireArg(args, index, usage) {
  const value = args[index];
  if (!value) {
    console.error(`Usage: ${usage}`);
    process.exit(1);
  }

  return value;
}

export function commandOutput(command, args, options = {}) {
  const { allowFailure = false, cwd = process.cwd(), env = process.env } = options;

  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    const stdout = error.stdout?.toString?.() ?? '';
    const stderr = error.stderr?.toString?.() ?? '';
    const output = `${stdout}${stderr}`.trim();

    if (allowFailure) {
      return output;
    }

    if (output) {
      console.error(output);
    }

    throw error;
  }
}

export function ghOutput(args, options = {}) {
  loadLocalEnv(import.meta.url);
  const context = getContext();
  const { GH_HOST: _ghHost, ...ghEnvContext } = context;
  const runtimeEnv = {
    ...process.env,
    ...ghEnvContext,
    ...(options.env || {}),
  };
  const cached = runGhWithCachedToken(args, {
    cwd: options.cwd || process.cwd(),
    env: runtimeEnv,
  });
  if (cached.usedCache) {
    if (cached.result.status !== 0) {
      const detail = (cached.result.stderr || cached.result.stdout || '').trim();
      throw new Error(detail || 'cached gh command failed.');
    }

    return (cached.result.stdout || '').trim();
  }

  const auth = withGhTokenFromOnePassword(runtimeEnv, options.cwd || process.cwd());

  if (auth.error) {
    throw new Error(auth.error);
  }

  return commandOutput('gh', args, {
    ...options,
    env: auth.env,
  });
}

export function ghJson(args, options = {}) {
  const output = ghOutput(args, options);
  return output ? JSON.parse(output) : [];
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export function utcTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}
