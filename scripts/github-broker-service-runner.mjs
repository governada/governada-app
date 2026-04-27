#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import {
  GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION,
  GITHUB_BROKER_KEYCHAIN_ACCOUNT,
  GITHUB_BROKER_KEYCHAIN_SERVICE,
  GITHUB_BROKER_TOKEN_OP_REF_KEY,
  ensureKeychainCacheHelper,
  getBrokerServicePaths,
  getGithubBrokerStatus,
  getGithubBrokerTokenCacheStatus,
  isSafeServiceAccountTokenOpRef,
  readGithubBrokerRefs,
  resolveServiceAccountTokenOpRef,
} from './lib/github-broker-service.mjs';
import {
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  redactSensitiveText,
} from './lib/github-app-auth.mjs';

function ok(message) {
  console.log(`OK: ${message}`);
}

function block(message) {
  console.error(`BLOCKED: ${redactSensitiveText(message)}`);
}

const BROKER_HELPER_START_TIMEOUT_MS = 20000;
const BROKER_HELPER_START_POLL_MS = 250;
const BROKER_HELPER_FORCE_KILL_GRACE_MS = 2000;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.repoRoot) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const repoRoot = path.resolve(args.repoRoot);
  const paths = getBrokerServicePaths(repoRoot, process.env);
  if (!existsSync(paths.brokerScriptPath)) {
    block(`broker script is missing: ${paths.brokerScriptPath}`);
    process.exit(1);
  }

  const { refs, refsPath } = readGithubBrokerRefs(repoRoot);
  if (!refsPath) {
    block('.env.local.refs is missing; broker service cannot resolve GitHub App metadata');
    process.exit(1);
  }
  ok('.env.local.refs was inspected by the broker service without printing secret values');

  const tokenOpRef = resolveServiceAccountTokenOpRef({ repoRoot });
  if (!isSafeServiceAccountTokenOpRef(tokenOpRef)) {
    block(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} must be a full op://vault/item/field pointer`);
    process.exit(1);
  }

  const cacheStatus = getGithubBrokerTokenCacheStatus(process.env);
  if (!cacheStatus.present) {
    block(
      cacheStatus.error ||
        `macOS Keychain runtime cache is missing; run npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION} once with human approval`,
    );
    process.exit(1);
  }

  const helper = ensureKeychainCacheHelper(process.env);
  if (!helper.ok) {
    block(
      helper.error ||
        `macOS Keychain helper is not ready for promptless broker start; refresh the runtime cache with npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION}`,
    );
    process.exit(1);
  }

  const brokerEnv = {
    HOME: process.env.HOME || '',
    LANG: process.env.LANG || '',
    LC_ALL: process.env.LC_ALL || '',
    LOGNAME: process.env.LOGNAME || '',
    PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
    USER: process.env.USER || '',
    [GITHUB_READ_ENV_KEYS.appId]:
      refs[GITHUB_READ_ENV_KEYS.appId] || process.env[GITHUB_READ_ENV_KEYS.appId] || '',
    [GITHUB_READ_ENV_KEYS.installationId]:
      refs[GITHUB_READ_ENV_KEYS.installationId] ||
      process.env[GITHUB_READ_ENV_KEYS.installationId] ||
      '',
    [GITHUB_READ_ENV_KEYS.privateKeyRef]:
      refs[GITHUB_READ_ENV_KEYS.privateKeyRef] ||
      process.env[GITHUB_READ_ENV_KEYS.privateKeyRef] ||
      '',
    [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt]:
      refs[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt] ||
      process.env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt] ||
      '',
    [GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter]:
      refs[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter] ||
      process.env[GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter] ||
      '',
  };

  ok('launching broker through Keychain helper without returning the service-account token');
  const child = spawn(
    helper.path,
    ['run-broker', GITHUB_BROKER_KEYCHAIN_ACCOUNT, GITHUB_BROKER_KEYCHAIN_SERVICE],
    {
      cwd: repoRoot,
      env: brokerEnv,
      stdio: 'inherit',
    },
  );
  const startup = watchBrokerStartup({ child, repoRoot });

  const forwardSignal = (signal) => {
    child.kill(signal);
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    startup.settle();
    if (startup.timedOut()) {
      process.exit(1);
    }

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function watchBrokerStartup({ child, repoRoot }) {
  let forceKillTimer = null;
  let pollTimer = null;
  let settled = false;
  let timedOut = false;
  let timeoutTimer = null;

  const settle = () => {
    settled = true;
    clearInterval(pollTimer);
    clearTimeout(timeoutTimer);
    if (forceKillTimer) {
      clearTimeout(forceKillTimer);
    }
  };

  const terminateHungChild = () => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }

    child.kill('SIGTERM');
    forceKillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }, BROKER_HELPER_FORCE_KILL_GRACE_MS);
    forceKillTimer.unref?.();
  };

  pollTimer = setInterval(async () => {
    if (settled) {
      return;
    }

    try {
      const status = await getGithubBrokerStatus({ repoRoot });
      if (status.running) {
        ok('GitHub runtime broker socket became healthy');
        settle();
      }
    } catch {
      // Keep polling until the explicit timeout; startup diagnostics stay non-secret.
    }
  }, BROKER_HELPER_START_POLL_MS);

  timeoutTimer = setTimeout(() => {
    if (settled) {
      return;
    }

    timedOut = true;
    block(
      `GitHub broker Keychain helper did not start the broker within ${BROKER_HELPER_START_TIMEOUT_MS}ms. If a macOS Keychain prompt is visible, approve it once and retry. If prompts repeat, run npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION} as a human-present setup step; broker startup no longer rebuilds the helper.`,
    );
    terminateHungChild();
  }, BROKER_HELPER_START_TIMEOUT_MS);

  return {
    settle,
    timedOut: () => timedOut,
  };
}

function parseArgs(argv) {
  const result = {
    help: argv.includes('--help') || argv.includes('-h'),
    repoRoot: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo-root') {
      result.repoRoot = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--repo-root=')) {
      result.repoRoot = arg.slice('--repo-root='.length);
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  node scripts/github-broker-service-runner.mjs --repo-root <repo-root>

This script is intended to run under the Governada LaunchAgent. It resolves the
service-account token from the local macOS Keychain runtime cache through the
repo helper, then starts github-runtime-broker with that token only in the
broker process env. The
runtime cache is refreshed from ${GITHUB_BROKER_TOKEN_OP_REF_KEY} by the
human-present cache-token command.`);
}

main().catch((error) => {
  block(error?.message || String(error));
  process.exit(1);
});
