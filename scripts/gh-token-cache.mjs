#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, userInfo } from 'node:os';

import {
  EXPECTED_OP_ACCOUNT,
  ensureKeychainCacheHelper,
  findClangCliPath,
  findOpCliPath,
  getKeychainCacheCSourcePath,
} from './lib/github-broker-service.mjs';
import { redactSensitiveText } from './lib/github-app-auth.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');
const {
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
} = require('./lib/gh-token-cache.js');

const EXPECTED_REPO = 'governada/app';
const EXPECTED_GH_USER = 'tim-governada';

function ok(message) {
  console.log(`OK: ${message}`);
}

function advisory(message) {
  console.log(`ADVISORY: ${message}`);
}

function blocked(message) {
  console.error(`BLOCKED: ${message}`);
}

function parseArgs(argv) {
  const result = {
    command: argv[0] || '',
    confirm: '',
    help: argv.includes('--help') || argv.includes('-h'),
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--confirm') {
      result.confirm = argv[index + 1] || '';
      index += 1;
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  npm run gh:token-cache -- doctor
  npm run gh:token-cache -- status
  npm run gh:token-cache -- cache-token --confirm ${HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION}
  npm run gh:token-cache -- clear-token-cache --confirm ${HUMAN_GITHUB_TOKEN_CLEAR_CONFIRMATION}

cache-token is a human-present setup or refresh command. It reads the configured
GH_TOKEN_OP_REF or GITHUB_TOKEN_OP_REF from 1Password and writes a repo-local
macOS Keychain runtime cache without printing the token. Repo gh wrappers then
prefer the Keychain helper path before falling back to a direct 1Password read.`);
}

function runtimeEnv() {
  loadLocalEnv(import.meta.url);
  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const { repoRoot } = getScriptContext(import.meta.url);
  resolveHumanGithubTokenRefFallback(env, { repoRoot });
  return env;
}

function detailFrom(result) {
  return redactSensitiveText(result.stderr || result.stdout || '').trim();
}

function validateCommon({ blockers, env, requireCache = false }) {
  const context = getContext();

  if (context.GH_REPO === EXPECTED_REPO) {
    ok(`repo context is pinned to ${EXPECTED_REPO}`);
  } else {
    blockers.push(`repo context is ${context.GH_REPO || 'unset'}, expected ${EXPECTED_REPO}`);
    blocked(blockers.at(-1));
  }

  if (context.OP_ACCOUNT === EXPECTED_OP_ACCOUNT) {
    ok(`1Password account is pinned to ${EXPECTED_OP_ACCOUNT}`);
  } else {
    blockers.push(
      `1Password account is ${context.OP_ACCOUNT || 'unset'}, expected ${EXPECTED_OP_ACCOUNT}`,
    );
    blocked(blockers.at(-1));
  }

  const tokenRefKey = getHumanGithubTokenRefKey(env);
  const tokenRef = getHumanGithubTokenRef(env);
  if (tokenRefKey && isSafeHumanGithubTokenOpRef(tokenRef)) {
    ok(`${tokenRefKey} is a full op:// pointer`);
  } else if (tokenRefKey) {
    blockers.push(`${tokenRefKey} is not a safe op:// pointer`);
    blocked(blockers.at(-1));
  } else {
    blockers.push('no 1Password GitHub token reference is configured');
    blocked(blockers.at(-1));
  }

  if (env.GH_TOKEN || env.GITHUB_TOKEN) {
    blockers.push(
      'raw GitHub token env is present; remove GH_TOKEN/GITHUB_TOKEN so this proves the repo-scoped runtime cache lane',
    );
    blocked(blockers.at(-1));
  } else {
    ok('raw GitHub token env is not present');
  }

  const opPath = findOpCliPath(env);
  if (opPath) {
    ok(`1Password CLI path is ${opPath}`);
  } else {
    blockers.push('1Password CLI path is missing');
    blocked(blockers.at(-1));
  }

  const clangPath = findClangCliPath(env);
  if (clangPath) {
    ok(`clang path for Keychain helper is ${clangPath}`);
  } else {
    blockers.push('clang is missing');
    blocked(blockers.at(-1));
  }

  const sourcePath = getKeychainCacheCSourcePath();
  if (existsSync(sourcePath)) {
    ok(`Keychain C helper source is ${sourcePath}`);
  } else {
    blockers.push(`Keychain C helper source is missing at ${sourcePath}`);
    blocked(blockers.at(-1));
  }

  const helper = inspectHumanGithubTokenCacheHelper();
  if (helper.ok && !helper.stale) {
    ok(`Keychain helper is present at ${helper.path}`);
  } else if (helper.ok && helper.stale) {
    const message =
      'Keychain helper is older than its source; cache-token rebuilds it during the human-present setup step';
    if (requireCache) {
      blockers.push(message);
      blocked(message);
    } else {
      advisory(message);
    }
  } else if (!helper.exists) {
    const message =
      'Keychain helper has not been built yet; cache-token builds it during the human-present setup step';
    if (requireCache) {
      blockers.push(message);
      blocked(message);
    } else {
      advisory(message);
    }
  } else {
    blockers.push(helper.error || 'Keychain helper is not usable');
    blocked(blockers.at(-1));
  }

  const cache = getHumanGithubTokenCacheStatus(env);
  if (cache.present) {
    ok('human GitHub token runtime cache is present in macOS Keychain');
  } else if (cache.error) {
    blockers.push(`human GitHub token runtime cache could not be inspected: ${cache.error}`);
    blocked(redactSensitiveText(blockers.at(-1)));
  } else {
    const message = `human GitHub token runtime cache is missing; run npm run gh:token-cache -- cache-token --confirm ${HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION} once with human approval`;
    if (requireCache) {
      blockers.push(message);
      blocked(message);
    } else {
      advisory(message);
    }
  }

  return {
    cache,
    helper,
    tokenRef,
  };
}

function runDoctor({ env }) {
  const blockers = [];
  console.log('GitHub human token cache: doctor');
  const { cache } = validateCommon({ blockers, env, requireCache: true });

  if (cache.present) {
    const user = runGhWithCachedToken(['api', 'user', '--jq', '.login'], { env });
    if (!user.usedCache) {
      blockers.push(user.reason || 'cached gh token lane was not usable');
      blocked(blockers.at(-1));
    } else if (user.result.status !== 0) {
      const detail = detailFrom(user.result);
      blockers.push(`cached gh API auth failed${detail ? `: ${detail}` : ''}`);
      blocked(blockers.at(-1));
    } else {
      const login = user.result.stdout.trim();
      if (login === EXPECTED_GH_USER) {
        ok(`cached gh API auth works as ${EXPECTED_GH_USER}`);
      } else {
        blockers.push(
          `cached gh API auth returned ${login || 'unknown'}, expected ${EXPECTED_GH_USER}`,
        );
        blocked(blockers.at(-1));
      }
    }

    const repo = runGhWithCachedToken(['api', `repos/${EXPECTED_REPO}`, '--jq', '.full_name'], {
      env,
    });
    if (!repo.usedCache) {
      blockers.push(repo.reason || 'cached repo access lane was not usable');
      blocked(blockers.at(-1));
    } else if (repo.result.status !== 0) {
      const detail = detailFrom(repo.result);
      blockers.push(`cached repo access failed${detail ? `: ${detail}` : ''}`);
      blocked(blockers.at(-1));
    } else {
      ok(`cached repo access works for ${repo.result.stdout.trim() || EXPECTED_REPO}`);
    }
  }

  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub human token cache doctor result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }

  console.log('GitHub human token cache doctor result: PASS');
}

function runStatus({ env }) {
  const blockers = [];
  console.log('GitHub human token cache: status');
  validateCommon({ blockers, env, requireCache: false });
  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub human token cache status result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }
  console.log('GitHub human token cache status result: OK');
}

function runCacheToken({ env, parsed }) {
  if (parsed.confirm !== HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION) {
    blocked(
      `caching the human GitHub token requires --confirm ${HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION}`,
    );
    process.exit(1);
  }

  const blockers = [];
  console.log('GitHub human token cache: cache-token');
  const { tokenRef } = validateCommon({ blockers, env, requireCache: false });
  if (blockers.length > 0) {
    console.log(`GitHub human token cache-token result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }

  const read = readHumanGithubTokenFrom1Password({ env, tokenRef });
  if (!read.ok) {
    blocked(read.error || '1Password GitHub token read failed');
    process.exit(1);
  }
  ok('human GitHub token was resolved from 1Password without printing its value');

  const write = writeHumanGithubTokenKeychainCache({ env, token: read.token });
  if (!write.ok) {
    blocked(write.error || 'macOS Keychain runtime cache write failed');
    process.exit(1);
  }

  const cacheStatus = getHumanGithubTokenCacheStatus(env);
  if (!cacheStatus.present) {
    blocked(
      cacheStatus.error || 'macOS Keychain runtime cache write did not leave a readable cache item',
    );
    process.exit(1);
  }

  ok('human GitHub token runtime cache was written to macOS Keychain');
  console.log('GitHub human token cache-token result: OK');
}

function runClearTokenCache({ env, parsed }) {
  if (parsed.confirm !== HUMAN_GITHUB_TOKEN_CLEAR_CONFIRMATION) {
    blocked(
      `clearing the human GitHub token cache requires --confirm ${HUMAN_GITHUB_TOKEN_CLEAR_CONFIRMATION}`,
    );
    process.exit(1);
  }

  console.log('GitHub human token cache: clear-token-cache');
  const result = deleteHumanGithubTokenKeychainCache(env);
  if (!result.ok) {
    blocked(result.error || 'macOS Keychain runtime cache clear failed');
    process.exit(1);
  }

  ok(
    result.removed
      ? 'human GitHub token runtime cache was removed from macOS Keychain'
      : 'human GitHub token runtime cache was already absent',
  );
  console.log('GitHub human token clear-token-cache result: OK');
}

function readHumanGithubTokenFrom1Password({ env, tokenRef, timeoutMs = 60000 }) {
  const opPath = findOpCliPath(env);
  if (!opPath) {
    return {
      error: '1Password CLI was not found',
      ok: false,
      token: '',
    };
  }

  const result = spawnSync(
    opPath,
    ['read', tokenRef, '--account', EXPECTED_OP_ACCOUNT, '--no-newline', '--force'],
    {
      encoding: 'utf8',
      env: {
        ...env,
        OP_ACCOUNT: EXPECTED_OP_ACCOUNT,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    },
  );

  if (result.status !== 0) {
    const output = redactSensitiveText(
      [
        result.error?.message,
        result.signal ? `signal=${result.signal}` : '',
        result.status === null ? 'status=null' : `status=${result.status}`,
        result.stdout || '',
        result.stderr || '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim(),
    );
    return {
      error:
        output ||
        '1Password GitHub token read failed; unlock/approve 1Password and retry this human-present setup command',
      ok: false,
      token: '',
    };
  }

  const token = result.stdout || '';
  if (!token.trim()) {
    return {
      error: '1Password returned an empty GitHub token',
      ok: false,
      token: '',
    };
  }

  return {
    ok: true,
    token,
  };
}

function writeHumanGithubTokenKeychainCache({ env, token }) {
  const helper = ensureKeychainCacheHelper(env, { forceBuild: true });
  if (!helper.ok) {
    return {
      error: helper.error,
      ok: false,
    };
  }

  if (!token?.trim()) {
    return {
      error: 'refusing to cache an empty human GitHub token',
      ok: false,
    };
  }

  const result = spawnSync(
    helper.path,
    [
      'write',
      HUMAN_GITHUB_TOKEN_KEYCHAIN_ACCOUNT,
      HUMAN_GITHUB_TOKEN_KEYCHAIN_SERVICE,
      HUMAN_GITHUB_TOKEN_KEYCHAIN_LABEL,
      'Governada human GitHub token runtime cache; source of truth is 1Password.',
    ],
    {
      encoding: 'utf8',
      env: sanitizedHelperWriteEnv(env),
      input: `${token}\n`,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  if (result.status !== 0) {
    const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
    return {
      error: output || `Keychain write helper exited with status ${result.status}`,
      ok: false,
    };
  }

  return {
    ok: true,
  };
}

function sanitizedHelperWriteEnv(env) {
  const safeEnv = {
    HOME: env.HOME || homedir(),
    LANG: env.LANG || 'C',
    LC_ALL: env.LC_ALL || '',
    LOGNAME: env.LOGNAME || safeUsername(),
    PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    USER: env.USER || safeUsername(),
  };

  return safeEnv;
}

function safeUsername() {
  try {
    return userInfo().username || '';
  } catch {
    return '';
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help || !parsed.command) {
    printUsage();
    return;
  }

  const { repoRoot } = getScriptContext(import.meta.url);
  const env = runtimeEnv();

  if (repoRoot !== process.cwd()) {
    env.PWD = process.cwd();
  }

  if (parsed.command === 'doctor') {
    runDoctor({ env });
    return;
  }

  if (parsed.command === 'status') {
    runStatus({ env });
    return;
  }

  if (parsed.command === 'cache-token') {
    runCacheToken({ env, parsed });
    return;
  }

  if (parsed.command === 'clear-token-cache') {
    runClearTokenCache({ env, parsed });
    return;
  }

  blocked(`unknown GitHub human token cache command: ${parsed.command}`);
  printUsage();
  process.exit(1);
}

main();
