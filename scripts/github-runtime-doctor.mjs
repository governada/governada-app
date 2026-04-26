import { createRequire } from 'node:module';

import {
  findEnvLocalKeyDefinitions,
  findFirstExisting,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  parseEnvEntries,
} from './lib/env-bootstrap.mjs';
import {
  EXPECTED_REPO,
  FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  evaluateGithubServiceAccountRuntime,
  getGithubReadLaneConfig,
  isValidOpReference,
} from './lib/github-app-auth.mjs';
import { githubBrokerSocketPath, isGithubBrokerAvailable } from './lib/github-broker-client.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_RUNTIME_REF_KEYS = new Set([
  GITHUB_READ_ENV_KEYS.appId,
  GITHUB_READ_ENV_KEYS.installationId,
  GITHUB_READ_ENV_KEYS.privateKeyRef,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter,
]);

function pass(message) {
  console.log(`OK: ${message}`);
}

function advisory(advisories, message) {
  advisories.push(message);
  console.log(`ADVISORY: ${message}`);
}

function block(blockers, message) {
  blockers.push(message);
  console.log(`BLOCKED: ${message}`);
}

function main() {
  const blockers = [];
  const advisories = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubRuntimeReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  console.log('GitHub runtime doctor: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log('Scope: service-account runtime posture and rotation metadata');

  if (refsPath) {
    pass('.env.local.refs was inspected for GitHub App runtime metadata without resolving values');

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous GitHub App lane`,
      );
    }
  } else {
    advisory(
      advisories,
      '.env.local.refs is absent; runtime metadata may only come from process env',
    );
  }

  if (forbiddenEnvLocalDefinitions.length > 0) {
    block(
      blockers,
      `.env.local must not define ${describeEnvLocalDefinitions(forbiddenEnvLocalDefinitions)} for the autonomous GitHub App lane`,
    );
  }

  if (context.GH_REPO === EXPECTED_REPO) {
    pass(`repo context is pinned to ${EXPECTED_REPO}`);
  } else {
    block(blockers, `repo context is ${context.GH_REPO || 'unset'}, expected ${EXPECTED_REPO}`);
  }

  if (context.OP_ACCOUNT === EXPECTED_OP_ACCOUNT) {
    pass(`1Password account is pinned to ${EXPECTED_OP_ACCOUNT}`);
  } else {
    block(
      blockers,
      `1Password account is ${context.OP_ACCOUNT || 'unset'}, expected ${EXPECTED_OP_ACCOUNT}`,
    );
  }

  if (config.rawGithubTokenKeys.length > 0) {
    block(
      blockers,
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; autonomous GitHub App lane must not use human or raw GitHub tokens`,
    );
  } else {
    pass('raw GitHub token env is not present');
  }

  if (config.opConnectKeys.length > 0) {
    block(
      blockers,
      `${config.opConnectKeys.join('/')} is present; clear 1Password Connect env before proving the service-account lane`,
    );
  } else {
    pass('1Password Connect env is not present');
  }

  if (config.appId) {
    pass(`${GITHUB_READ_ENV_KEYS.appId} is present`);
  } else {
    advisory(advisories, `${GITHUB_READ_ENV_KEYS.appId} is missing`);
  }

  if (config.installationId) {
    pass(`${GITHUB_READ_ENV_KEYS.installationId} is present`);
  } else {
    advisory(advisories, `${GITHUB_READ_ENV_KEYS.installationId} is missing`);
  }

  if (config.privateKeyRef && isValidOpReference(config.privateKeyRef)) {
    pass(`${GITHUB_READ_ENV_KEYS.privateKeyRef} is an op:// reference`);
  } else if (config.privateKeyRef) {
    block(blockers, `${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  } else {
    advisory(advisories, `${GITHUB_READ_ENV_KEYS.privateKeyRef} is missing`);
  }

  const runtime = evaluateGithubServiceAccountRuntime(env);
  for (const message of runtime.passes) {
    pass(message);
  }
  for (const message of runtime.advisories) {
    advisory(advisories, message);
  }
  for (const message of runtime.blockers) {
    block(blockers, message);
  }

  const brokerSocketPath = githubBrokerSocketPath(repoRoot, env);
  if (isGithubBrokerAvailable(repoRoot, env)) {
    pass(`GitHub runtime broker socket is available at ${brokerSocketPath}`);
  } else {
    advisory(
      advisories,
      `GitHub runtime broker socket is not running at ${brokerSocketPath}; live brokered GitHub App operations require Tim to start npm run github:runtime-broker from Terminal`,
    );
  }

  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub runtime doctor result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }

  if (advisories.length > 0) {
    console.log(`GitHub runtime doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub runtime doctor result: PASS');
}

function describeEnvLocalDefinitions(definitions) {
  return definitions.map((definition) => `${definition.key} (${definition.filePath})`).join(', ');
}

function loadGithubRuntimeReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_RUNTIME_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

main();
