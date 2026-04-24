#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  ENV_LOCAL_FILE,
  ENV_REFS_FILE,
  findFirstExisting,
  forbiddenLiteralEntries,
  getEnvLocalCandidates,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  isOpReference,
  parseEnvEntries,
  RAW_GITHUB_TOKEN_KEYS,
  runOpRead,
  runOpVersion,
} from './lib/env-bootstrap.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const usage = 'npm run env:run -- <command> [args...]';

function parseArgs(argv) {
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.error(`Usage: ${usage}`);
    process.exit(args.length === 0 ? 1 : 0);
  }

  return args;
}

function fail(message) {
  console.error(`BLOCKED: ${message}`);
  process.exit(1);
}

function isLocalFile(repoRoot, filePath) {
  if (!filePath) {
    return false;
  }

  const relative = path.relative(repoRoot, filePath);
  return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function getRawGitHubTokenKeys(filePath) {
  return parseEnvEntries(filePath)
    .map((entry) => entry.key)
    .filter((key) => RAW_GITHUB_TOKEN_KEYS.has(key));
}

function resolveReference(repoRoot, entry, env) {
  if (!isOpReference(entry.value)) {
    return entry.value;
  }

  const result = runOpRead(repoRoot, entry.value, env);
  if (result.error?.code === 'ENOENT') {
    fail('1Password CLI (`op`) is not installed or not on PATH');
  }

  if (result.error?.code === 'ETIMEDOUT' || result.signal) {
    fail(`1Password timed out while resolving ${entry.key}`);
  }

  if (result.error || result.status !== 0) {
    fail(`1Password could not resolve ${entry.key}; unlock 1Password or check the reference`);
  }

  return result.stdout.replace(/\r?\n$/u, '');
}

function runCommand(command, env) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
  });

  if (result.error?.code === 'ENOENT') {
    fail(`command not found: ${command[0]}`);
  }

  if (result.error) {
    fail(`command failed to start: ${result.error.message}`);
  }

  if (result.signal) {
    console.error(`Command terminated by signal ${result.signal}`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

function main() {
  const command = parseArgs(process.argv.slice(2));
  const { repoRoot } = getScriptContext(import.meta.url);
  const context = getContext();
  const baseEnv = { ...process.env };
  for (const key of RAW_GITHUB_TOKEN_KEYS) {
    delete baseEnv[key];
  }
  Object.assign(baseEnv, context);

  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  const envLocalPath = findFirstExisting(getEnvLocalCandidates(repoRoot));

  if (envLocalPath && isLocalFile(repoRoot, envLocalPath)) {
    const rawEnvLocalTokenKeys = getRawGitHubTokenKeys(envLocalPath);
    if (rawEnvLocalTokenKeys.length > 0) {
      fail(`${ENV_LOCAL_FILE} must not define GH_TOKEN or GITHUB_TOKEN`);
    }
  }

  if (!refsPath) {
    if (envLocalPath && isLocalFile(repoRoot, envLocalPath)) {
      console.error(
        `${ENV_REFS_FILE}: absent; running command directly so existing ${ENV_LOCAL_FILE} fallback behavior can apply.`,
      );
      runCommand(command, baseEnv);
    }

    if (envLocalPath) {
      fail(
        `${ENV_REFS_FILE} is absent and ${ENV_LOCAL_FILE} exists only outside this checkout; create ignored ${ENV_REFS_FILE} instead of copying plaintext env files`,
      );
    }

    fail(`no ${ENV_REFS_FILE} or ${ENV_LOCAL_FILE} found; run npm run env:doctor`);
  }

  const forbiddenKeys = getForbiddenGithubReferenceKeys(refsPath);
  if (forbiddenKeys.length > 0) {
    fail(
      `${ENV_REFS_FILE} must not define GH_TOKEN_OP_REF, GITHUB_TOKEN_OP_REF, or OP_SERVICE_ACCOUNT_TOKEN`,
    );
  }

  const entries = parseEnvEntries(refsPath);
  const forbiddenRawTokenKeys = entries
    .map((entry) => entry.key)
    .filter((key) => RAW_GITHUB_TOKEN_KEYS.has(key));
  if (forbiddenRawTokenKeys.length > 0) {
    fail(`${ENV_REFS_FILE} must not define GH_TOKEN or GITHUB_TOKEN`);
  }

  const forbiddenLiterals = forbiddenLiteralEntries(entries);
  if (forbiddenLiterals.length > 0) {
    fail(`${ENV_REFS_FILE} contains non-allowlisted literal env assignment(s)`);
  }

  const opVersion = runOpVersion(repoRoot, baseEnv);
  if (opVersion.error?.code === 'ENOENT') {
    fail('1Password CLI (`op`) is not installed or not on PATH');
  }

  if (opVersion.error || opVersion.status !== 0) {
    fail('1Password CLI (`op`) is not runnable from this process');
  }

  const injectedEnv = { ...baseEnv };
  for (const entry of entries) {
    injectedEnv[entry.key] = resolveReference(repoRoot, entry, baseEnv);
  }

  runCommand(command, injectedEnv);
}

main();
