import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { commandOutput } from './runtime.mjs';

export const ENV_REFS_FILE = '.env.local.refs';
export const ENV_LOCAL_FILE = '.env.local';
export const ENV_REFS_EXAMPLE = path.join('docs', 'examples', 'env-local-refs.example.md');
export const GITHUB_REFERENCE_KEYS = new Set([
  'GH_TOKEN_OP_REF',
  'GITHUB_TOKEN_OP_REF',
  'OP_SERVICE_ACCOUNT_TOKEN',
]);
export const RAW_GITHUB_TOKEN_KEYS = new Set(['GH_TOKEN', 'GITHUB_TOKEN']);
export const OP_READ_TIMEOUT_MS = 15000;
export const LITERAL_ENV_ALLOWLIST = new Set([
  'DEV_MOCK_AUTH',
  'GOVERNADA_GITHUB_APP_ID',
  'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
  'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT',
  'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER',
  'NODE_ENV',
  'NEXT_PUBLIC_KOIOS_BASE_URL',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_SITE_URL',
]);

function uniquePaths(paths) {
  const seen = new Set();
  const result = [];

  for (const filePath of paths.filter(Boolean)) {
    const resolved = path.resolve(filePath);
    if (seen.has(resolved)) {
      continue;
    }

    seen.add(resolved);
    result.push(resolved);
  }

  return result;
}

export function getCheckoutKind(repoRoot) {
  try {
    const gitEntry = lstatSync(path.join(repoRoot, '.git'));
    return gitEntry.isDirectory() ? 'shared checkout' : 'worktree';
  } catch {
    return 'unknown';
  }
}

export function getSharedCheckoutRoot(repoRoot) {
  const commonDir = commandOutput(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    {
      allowFailure: true,
      cwd: repoRoot,
    },
  );

  if (!commonDir) {
    return '';
  }

  const sharedRoot = path.dirname(commonDir);
  return path.resolve(sharedRoot);
}

export function getEnvLocalCandidates(repoRoot, cwd = process.cwd()) {
  const sharedRoot = getSharedCheckoutRoot(repoRoot);
  return uniquePaths([
    path.join(cwd, ENV_LOCAL_FILE),
    path.join(repoRoot, ENV_LOCAL_FILE),
    sharedRoot ? path.join(sharedRoot, ENV_LOCAL_FILE) : '',
  ]);
}

export function getEnvRefsCandidates(repoRoot, cwd = process.cwd()) {
  const sharedRoot = getSharedCheckoutRoot(repoRoot);
  return uniquePaths([
    path.join(cwd, ENV_REFS_FILE),
    path.join(repoRoot, ENV_REFS_FILE),
    sharedRoot ? path.join(sharedRoot, ENV_REFS_FILE) : '',
  ]);
}

export function findFirstExisting(paths) {
  return paths.find((filePath) => existsSync(filePath)) || '';
}

export function findRepoRootForPath(repoRoot, filePath) {
  const sharedRoot = getSharedCheckoutRoot(repoRoot);
  const candidates = uniquePaths([repoRoot, sharedRoot]);
  const resolvedFile = path.resolve(filePath);

  return (
    candidates.find((candidate) => {
      const relative = path.relative(candidate, resolvedFile);
      return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
    }) || repoRoot
  );
}

export function parseEnvKeys(filePath) {
  return parseEnvKeyDefinitions(filePath).map((entry) => entry.key);
}

export function parseEnvKeyDefinitions(filePath) {
  const keys = [];
  const contents = readFileSync(filePath, 'utf8');

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
    if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      keys.push({ key });
    }
  }

  return keys;
}

export function findEnvLocalKeyDefinitions(repoRoot, keys, cwd = process.cwd()) {
  const keySet = new Set(keys);
  const definitions = [];

  for (const filePath of getEnvLocalCandidates(repoRoot, cwd)) {
    if (!existsSync(filePath)) {
      continue;
    }

    for (const entry of parseEnvKeyDefinitions(filePath)) {
      if (keySet.has(entry.key)) {
        definitions.push({
          filePath,
          key: entry.key,
        });
      }
    }
  }

  return definitions;
}

export function parseEnvEntries(filePath) {
  const keys = [];
  const contents = readFileSync(filePath, 'utf8');

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
    if (/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      keys.push({
        key,
        value: normalizeEnvValue(normalizedLine.slice(separatorIndex + 1).trim()),
      });
    }
  }

  return keys;
}

function normalizeEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value.replace(/\s+#.*$/u, '').trim();
}

export function isOpReference(value) {
  return value.startsWith('op://');
}

export function literalEntries(entries) {
  return entries.filter((entry) => entry.value && !isOpReference(entry.value));
}

export function forbiddenLiteralEntries(entries) {
  return literalEntries(entries).filter((entry) => !LITERAL_ENV_ALLOWLIST.has(entry.key));
}

export function getForbiddenGithubReferenceKeys(filePath) {
  if (!filePath || !existsSync(filePath)) {
    return [];
  }

  return parseEnvKeys(filePath).filter((key) => GITHUB_REFERENCE_KEYS.has(key));
}

export function gitCheckIgnored(repoRoot, filePath) {
  const root = findRepoRootForPath(repoRoot, filePath);
  const relativePath = path.relative(root, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  const result = spawnSync('git', ['check-ignore', '--quiet', '--', relativePath], {
    cwd: root,
    stdio: 'ignore',
  });

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  return null;
}

export function gitCheckTracked(repoRoot, relativePath) {
  const result = spawnSync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  return result.status === 0;
}

export function runOpVersion(repoRoot, env = process.env) {
  return spawnSync('op', ['--version'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  });
}

export function runOpRead(repoRoot, reference, env = process.env) {
  return spawnSync('op', ['read', reference], {
    cwd: repoRoot,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: OP_READ_TIMEOUT_MS,
  });
}
