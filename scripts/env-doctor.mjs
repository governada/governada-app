#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  ENV_LOCAL_FILE,
  ENV_REFS_EXAMPLE,
  ENV_REFS_FILE,
  findFirstExisting,
  forbiddenLiteralEntries,
  getCheckoutKind,
  getEnvLocalCandidates,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  gitCheckIgnored,
  gitCheckTracked,
  parseEnvEntries,
  RAW_GITHUB_TOKEN_KEYS,
  runOpVersion,
} from './lib/env-bootstrap.mjs';
import { getScriptContext } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

function ok(message) {
  console.log(`OK: ${message}`);
}

function warn(warnings, message) {
  warnings.push(message);
  console.log(`WARN: ${message}`);
}

function block(blockers, message) {
  blockers.push(message);
  console.log(`BLOCKED: ${message}`);
}

function describePath(repoRoot, filePath) {
  const relative = path.relative(repoRoot, filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : filePath;
}

function checkIgnored(blockers, warnings, repoRoot, filePath, label) {
  const ignored = gitCheckIgnored(repoRoot, filePath);

  if (ignored === true) {
    ok(`${label} is ignored by Git`);
    return;
  }

  if (ignored === false) {
    block(blockers, `${label} is not ignored by Git`);
    return;
  }

  warn(warnings, `could not verify Git ignore status for ${label}`);
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

function main() {
  const blockers = [];
  const warnings = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };

  console.log('Env doctor: Governada local environment bootstrap');
  ok(`checkout kind: ${getCheckoutKind(repoRoot)}`);
  ok(`1Password account context: ${context.OP_ACCOUNT}`);

  const rawGitHubTokens = [...RAW_GITHUB_TOKEN_KEYS].filter((key) => process.env[key]);
  if (rawGitHubTokens.length > 0) {
    block(
      blockers,
      'raw GitHub token env is present; remove GH_TOKEN/GITHUB_TOKEN so repo wrappers prove the 1Password lane',
    );
  } else {
    ok('raw GitHub token env is not present');
  }

  const envLocalPath = findFirstExisting(getEnvLocalCandidates(repoRoot));
  const envRefsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  const examplePath = path.join(repoRoot, ENV_REFS_EXAMPLE);

  if (envLocalPath) {
    ok(`${ENV_LOCAL_FILE} is present (${describePath(repoRoot, envLocalPath)})`);
    checkIgnored(blockers, warnings, repoRoot, envLocalPath, ENV_LOCAL_FILE);

    const rawEnvLocalTokenKeys = getRawGitHubTokenKeys(envLocalPath);
    if (rawEnvLocalTokenKeys.length > 0) {
      block(
        blockers,
        `${ENV_LOCAL_FILE} contains raw GitHub token key(s); remove GH_TOKEN/GITHUB_TOKEN and keep GitHub auth on the 1Password reference lane`,
      );
    } else {
      ok(`${ENV_LOCAL_FILE} does not define raw GitHub token keys`);
    }

    if (!isLocalFile(repoRoot, envLocalPath)) {
      warn(
        warnings,
        `${ENV_LOCAL_FILE} exists only outside this checkout and will not be injected by env:run`,
      );
    }
  } else {
    warn(warnings, `${ENV_LOCAL_FILE} is absent`);
  }

  if (envRefsPath) {
    ok(`${ENV_REFS_FILE} is present (${describePath(repoRoot, envRefsPath)})`);
    checkIgnored(blockers, warnings, repoRoot, envRefsPath, ENV_REFS_FILE);

    const forbiddenKeys = getForbiddenGithubReferenceKeys(envRefsPath);
    if (forbiddenKeys.length > 0) {
      block(
        blockers,
        `${ENV_REFS_FILE} contains auth runtime key(s); keep GH_TOKEN_OP_REF/GITHUB_TOKEN_OP_REF/OP_SERVICE_ACCOUNT_TOKEN outside op-run style injection`,
      );
    } else {
      ok(`${ENV_REFS_FILE} does not define auth runtime reference keys`);
    }

    const entries = parseEnvEntries(envRefsPath);
    const forbiddenRawTokenKeys = entries
      .map((entry) => entry.key)
      .filter((key) => RAW_GITHUB_TOKEN_KEYS.has(key));
    if (forbiddenRawTokenKeys.length > 0) {
      block(
        blockers,
        `${ENV_REFS_FILE} contains raw GitHub token key(s); keep GH_TOKEN/GITHUB_TOKEN out of env injection`,
      );
    } else {
      ok(`${ENV_REFS_FILE} does not define raw GitHub token keys`);
    }

    const forbiddenLiterals = forbiddenLiteralEntries(entries);
    if (forbiddenLiterals.length > 0) {
      block(
        blockers,
        `${ENV_REFS_FILE} contains non-allowlisted literal env assignment(s); use op:// references for secret-bearing keys`,
      );
    } else {
      ok(`${ENV_REFS_FILE} literals are limited to allowlisted non-secret keys`);
    }

    const opVersion = runOpVersion(repoRoot, env);
    if (opVersion.error?.code === 'ENOENT') {
      block(blockers, '1Password CLI (`op`) is not installed or not on PATH');
    } else if (opVersion.error || opVersion.status !== 0) {
      block(blockers, '1Password CLI (`op`) is not runnable from this process');
    } else {
      ok(`1Password CLI is available (${opVersion.stdout.trim() || 'version unknown'})`);
    }
  } else {
    warn(
      warnings,
      `${ENV_REFS_FILE} is absent; commands can use process env or local ${ENV_LOCAL_FILE} fallback only when present in this checkout`,
    );
  }

  if (!existsSync(examplePath)) {
    block(blockers, `${ENV_REFS_EXAMPLE} is missing`);
  } else {
    ok(`${ENV_REFS_EXAMPLE} exists`);

    const exampleIgnored = gitCheckIgnored(repoRoot, examplePath);
    if (exampleIgnored === true) {
      block(blockers, `${ENV_REFS_EXAMPLE} is ignored by Git`);
    } else if (exampleIgnored === false) {
      ok(`${ENV_REFS_EXAMPLE} is eligible for Git tracking`);
    } else {
      warn(warnings, `could not verify Git ignore status for ${ENV_REFS_EXAMPLE}`);
    }

    if (gitCheckTracked(repoRoot, ENV_REFS_EXAMPLE)) {
      ok(`${ENV_REFS_EXAMPLE} is tracked or staged`);
    } else {
      warn(warnings, `${ENV_REFS_EXAMPLE} is not tracked yet`);
    }
  }

  if (blockers.length > 0) {
    console.log(`Env doctor result: BLOCKED (${blockers.length} blocker(s))`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log(`Env doctor result: PASS_WITH_ADVISORIES (${warnings.length} advisory item(s))`);
    return;
  }

  console.log('Env doctor result: PASS');
}

main();
