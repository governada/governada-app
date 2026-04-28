const { spawnSync } = require('node:child_process');
const { existsSync, lstatSync, readFileSync, statSync } = require('node:fs');
const { homedir, userInfo } = require('node:os');
const path = require('node:path');

const { redactSensitiveText } = require('./gh-auth');

const HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION = 'gh.runtime.cache-token';
const HUMAN_GITHUB_TOKEN_CLEAR_CONFIRMATION = 'gh.runtime.clear-token-cache';
const HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT = 'governada/app';
const HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE = 'io.governada.github.human-token';
const HUMAN_GITHUB_TOKEN_KEYCHAIN_LABEL = 'Governada human GitHub token runtime cache';
const SECURITY_PATH = '/usr/bin/security';
const FIXED_RUNTIME_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');

function getHumanGithubTokenRef(env = process.env) {
  return env.GH_TOKEN_OP_REF || env.GITHUB_TOKEN_OP_REF || '';
}

function getHumanGithubTokenRefKey(env = process.env) {
  if (env.GH_TOKEN_OP_REF) {
    return 'GH_TOKEN_OP_REF';
  }
  if (env.GITHUB_TOKEN_OP_REF) {
    return 'GITHUB_TOKEN_OP_REF';
  }
  return '';
}

function resolveHumanGithubTokenRefFallback(
  env,
  { cwd = process.cwd(), repoRoot = DEFAULT_REPO_ROOT } = {},
) {
  if (env.GH_TOKEN_OP_REF || env.GITHUB_TOKEN_OP_REF) {
    return env;
  }

  for (const envPath of getEnvLocalCandidates(repoRoot, cwd)) {
    if (!existsSync(envPath)) {
      continue;
    }

    const entries = parseEnvEntries(envPath);
    if (entries.GH_TOKEN_OP_REF) {
      env.GH_TOKEN_OP_REF = entries.GH_TOKEN_OP_REF;
      return env;
    }
    if (entries.GITHUB_TOKEN_OP_REF) {
      env.GITHUB_TOKEN_OP_REF = entries.GITHUB_TOKEN_OP_REF;
      return env;
    }
  }

  return env;
}

function isSafeHumanGithubTokenOpRef(value) {
  return /^op:\/\/[^/\r\n'";`$\\]+\/[^/\r\n'";`$\\]+\/[^/\r\n'";`$\\]+$/u.test(value || '');
}

function getKeychainCacheHelperPath(repoRoot = DEFAULT_REPO_ROOT) {
  return path.join(repoRoot, '.agents', 'runtime', 'github-keychain-cache');
}

function getKeychainCacheCSourcePath(repoRoot = DEFAULT_REPO_ROOT) {
  return path.join(repoRoot, 'scripts', 'github-keychain-cache.c');
}

function getHumanGithubTokenCacheStatus(env = process.env) {
  if (!existsSync(SECURITY_PATH)) {
    return {
      error: `macOS security CLI is missing at ${SECURITY_PATH}`,
      present: false,
    };
  }

  const result = spawnSync(
    SECURITY_PATH,
    [
      'find-generic-password',
      '-a',
      HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT,
      '-s',
      HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE,
    ],
    {
      encoding: 'utf8',
      env: sanitizedKeychainCliEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  if (result.status === 0) {
    return { present: true };
  }

  const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
  if (isKeychainItemMissing(output, result.status)) {
    return { present: false };
  }

  return {
    error: output || `macOS security keychain status exited with status ${result.status}`,
    present: false,
  };
}

function deleteHumanGithubTokenKeychainCache(env = process.env) {
  const before = getHumanGithubTokenCacheStatus(env);
  if (before.error) {
    return {
      error: before.error,
      ok: false,
    };
  }

  const result = spawnSync(
    SECURITY_PATH,
    [
      'delete-generic-password',
      '-a',
      HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT,
      '-s',
      HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE,
    ],
    {
      encoding: 'utf8',
      env: sanitizedKeychainCliEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
  if (result.status === 0) {
    return {
      ok: true,
      removed: before.present,
    };
  }

  if (isKeychainItemMissing(output, result.status)) {
    return {
      ok: true,
      removed: false,
    };
  }

  return {
    error: output || `macOS security keychain delete exited with status ${result.status}`,
    ok: false,
  };
}

function inspectHumanGithubTokenCacheHelper(repoRoot = DEFAULT_REPO_ROOT) {
  const helperPath = getKeychainCacheHelperPath(repoRoot);
  const sourcePath = getKeychainCacheCSourcePath(repoRoot);
  if (!existsSync(sourcePath)) {
    return {
      error: `Keychain cache C helper source is missing at ${sourcePath}`,
      exists: false,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  if (!existsSync(helperPath)) {
    return {
      error: `Keychain cache helper has not been built at ${helperPath}`,
      exists: false,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  const helperStat = lstatSync(helperPath);
  if (!helperStat.isFile() || helperStat.isSymbolicLink()) {
    return {
      error: `Keychain cache helper must be a regular file, not a symlink or special file: ${helperPath}`,
      exists: true,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  if ((helperStat.mode & 0o077) !== 0) {
    return {
      error: `Keychain cache helper permissions must not grant group/other access: ${helperPath}`,
      exists: true,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  const sourceStat = statSync(sourcePath);
  const stale = helperStat.mtimeMs < sourceStat.mtimeMs;
  return {
    exists: true,
    ok: true,
    path: helperPath,
    sourcePath,
    stale,
  };
}

function runGhWithCachedToken(args, options = {}) {
  const repoRoot = options.repoRoot || DEFAULT_REPO_ROOT;
  const cacheStatus = getHumanGithubTokenCacheStatus(options.env || process.env);
  if (!cacheStatus.present) {
    return {
      cacheStatus,
      reason: cacheStatus.error || 'human GitHub token runtime cache is not present',
      usedCache: false,
    };
  }

  const helper = inspectHumanGithubTokenCacheHelper(repoRoot);
  if (!helper.ok || helper.stale) {
    return {
      cacheStatus,
      helper,
      reason:
        helper.error || `Keychain cache helper is older than its source at ${helper.sourcePath}`,
      usedCache: false,
    };
  }

  const result = spawnSync(
    helper.path,
    ['run-gh', HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT, HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE, ...args],
    {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      env: sanitizedGithubHelperEnv(options.env || process.env),
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
      timeout: options.timeoutMs || 120000,
    },
  );

  return {
    cacheStatus,
    helper,
    result: {
      status: result.status ?? 1,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
    },
    usedCache: true,
  };
}

function sanitizedKeychainCliEnv(env = process.env) {
  return sanitizedEnvFromKeys(env, ['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL']);
}

function sanitizedGithubHelperEnv(env = process.env) {
  return sanitizedEnvFromKeys(env, [
    'HOME',
    'USER',
    'LOGNAME',
    'LANG',
    'LC_ALL',
    'GH_CONFIG_DIR',
    'GH_HOST',
    'GH_REPO',
  ]);
}

function sanitizedEnvFromKeys(env, keys) {
  const safeEnv = {
    PATH: FIXED_RUNTIME_PATH,
  };

  for (const key of keys) {
    if (env[key]) {
      safeEnv[key] = env[key];
    }
  }

  if (!safeEnv.HOME) {
    safeEnv.HOME = homedir();
  }

  const username = safeUsername();
  if (!safeEnv.USER && username) {
    safeEnv.USER = username;
  }
  if (!safeEnv.LOGNAME && username) {
    safeEnv.LOGNAME = username;
  }

  return safeEnv;
}

function safeUsername() {
  try {
    return userInfo().username || '';
  } catch {
    return '';
  }
}

function isKeychainItemMissing(output, status) {
  return (
    status === 44 ||
    /could not be found|The specified item could not be found|SecKeychainSearchCopyNext/iu.test(
      output || '',
    )
  );
}

function getEnvLocalCandidates(repoRoot, cwd) {
  const sharedRoot = getSharedCheckoutRoot(repoRoot);
  return uniquePaths([
    path.join(cwd, '.env.local'),
    path.join(repoRoot, '.env.local'),
    sharedRoot ? path.join(sharedRoot, '.env.local') : '',
  ]);
}

function getSharedCheckoutRoot(repoRoot) {
  const result = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
  if (result.status !== 0) {
    return '';
  }

  const commonDir = (result.stdout || '').trim();
  return commonDir ? path.dirname(commonDir) : '';
}

function parseEnvEntries(filePath) {
  const parsed = {};
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
    if (key !== 'GH_TOKEN_OP_REF' && key !== 'GITHUB_TOKEN_OP_REF') {
      continue;
    }

    parsed[key] = normalizeEnvValue(normalizedLine.slice(separatorIndex + 1).trim());
  }

  return parsed;
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

module.exports = {
  HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION,
  HUMAN_GITHUB_TOKEN_CLEAR_CONFIRMATION,
  HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT,
  HUMAN_GITHUB_TOKEN_KEYCHAIN_LABEL,
  HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE,
  deleteHumanGithubTokenKeychainCache,
  getHumanGithubTokenCacheStatus,
  getHumanGithubTokenRef,
  getHumanGithubTokenRefKey,
  inspectHumanGithubTokenCacheHelper,
  isSafeHumanGithubTokenOpRef,
  resolveHumanGithubTokenRefFallback,
  runGhWithCachedToken,
};
