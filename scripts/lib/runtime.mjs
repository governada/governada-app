import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'dotenv';

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
  const candidates = [path.join(process.cwd(), '.env.local'), path.join(repoRoot, '.env.local')];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const parsed = parse(readFileSync(envPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!keyAllowed(key, keyFilter)) {
        continue;
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return envPath;
  }

  return null;
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
  const { allowFailure = false, cwd = process.cwd() } = options;

  try {
    return execFileSync(command, args, {
      cwd,
      encoding: 'utf8',
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

export function ghJson(args, options = {}) {
  const output = commandOutput('gh', args, options);
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
