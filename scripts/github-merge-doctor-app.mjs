import { createRequire } from 'node:module';

import {
  findEnvLocalKeyDefinitions,
  findFirstExisting,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  parseEnvEntries,
} from './lib/env-bootstrap.mjs';
import {
  EXPECTED_MERGE_PERMISSIONS,
  EXPECTED_REPO,
  FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_OPERATION_CLASSES,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  evaluateGithubServiceAccountRuntime,
  getGithubReadLaneConfig,
  githubApiErrorMessage,
  githubApiRequest,
  githubMergePermissionFailures,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubMergePermissions,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
import { callGithubBroker } from './lib/github-broker-client.mjs';
import { getGithubBrokerStatus } from './lib/github-broker-service.mjs';
import { evaluateGithubChecksForMerge, evaluatePullRequestForMerge } from './lib/github-merge.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_MERGE_REF_KEYS = new Set([
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const blockers = [];
  const advisories = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubMergeReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  console.log('GitHub merge doctor: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.merge}`);
  console.log('Mutation policy: no merge endpoint is called by this doctor');

  if (refsPath) {
    pass(
      `.env.local.refs was inspected for ${GITHUB_OPERATION_CLASSES.merge} reference metadata without resolving values`,
    );

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous merge lane`,
      );
    }
  } else {
    advisory(
      advisories,
      '.env.local.refs is absent; merge lane metadata may only come from process env',
    );
  }

  if (forbiddenEnvLocalDefinitions.length > 0) {
    block(
      blockers,
      `.env.local must not define ${describeEnvLocalDefinitions(forbiddenEnvLocalDefinitions)} for the autonomous merge lane`,
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
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; autonomous ${GITHUB_OPERATION_CLASSES.merge} must not use human or raw GitHub tokens`,
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

  let brokerCanProveFallback = false;
  if (!config.serviceAccountTokenPresent && blockers.length === 0) {
    const status = await getGithubBrokerStatus({ env, repoRoot });
    if (status.running === true) {
      pass('GitHub runtime broker is running');
      if (status.repo === EXPECTED_REPO) {
        pass(`GitHub runtime broker is scoped to ${EXPECTED_REPO}`);
      } else {
        advisory(
          advisories,
          `legacy merge fallback status not live-proven: broker is scoped to ${status.repo || 'unknown'}, expected ${EXPECTED_REPO}`,
        );
      }
      if (status.supportedOperationClasses?.includes(GITHUB_OPERATION_CLASSES.merge)) {
        pass(`GitHub runtime broker advertises ${GITHUB_OPERATION_CLASSES.merge}`);
        brokerCanProveFallback = status.repo === EXPECTED_REPO;
      } else {
        advisory(
          advisories,
          `legacy merge fallback status not live-proven: broker does not advertise ${GITHUB_OPERATION_CLASSES.merge}`,
        );
      }
    } else {
      advisory(
        advisories,
        `legacy merge fallback status not live-proven: GitHub runtime broker is not running${status.error ? `: ${status.error}` : ''}`,
      );
    }
  }

  const missingKeys = !config.serviceAccountTokenPresent
    ? config.missingKeys.filter((key) => key !== GITHUB_READ_ENV_KEYS.serviceAccountToken)
    : config.missingKeys;
  if (missingKeys.length > 0) {
    block(
      blockers,
      `autonomous ${GITHUB_OPERATION_CLASSES.merge} lane is not configured; missing ${missingKeys.join(', ')}`,
    );
  } else {
    pass(`all autonomous ${GITHUB_OPERATION_CLASSES.merge} configuration keys are present`);
  }

  if (config.privateKeyRef && isValidOpReference(config.privateKeyRef)) {
    pass(`${GITHUB_READ_ENV_KEYS.privateKeyRef} is an op:// reference`);
  } else if (config.privateKeyRef) {
    block(blockers, `${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  }

  const runtime = evaluateGithubServiceAccountRuntime(env);
  if (config.serviceAccountTokenPresent) {
    for (const message of runtime.passes) {
      pass(message);
    }
    for (const message of runtime.advisories) {
      advisory(advisories, message);
    }
    for (const message of runtime.blockers) {
      block(blockers, message);
    }
  }

  advisory(
    advisories,
    'This doctor proves token minting, permission scope, and read probes only; merge execution still requires a current prompt approval naming repo, PR, operation, expected head SHA, green checks, and unchanged head.',
  );

  if (blockers.length > 0) {
    writeResult(blockers, advisories);
    process.exit(1);
  }

  if (!config.serviceAccountTokenPresent) {
    if (brokerCanProveFallback) {
      pass(
        'No service-account token is present; proving legacy fallback through the existing broker',
      );
      try {
        await verifyNonMutatingMergeLaneAccessWithBroker(repoRoot, env, blockers, args);
      } catch (error) {
        block(
          blockers,
          `legacy merge fallback broker proof failed: ${redactSensitiveText(error?.message || String(error))}`,
        );
      }
    } else {
      advisory(
        advisories,
        'No service-account token is present and no scoped merge-capable broker is available, so the legacy merge doctor stopped before resolving secrets or calling GitHub',
      );
    }
    writeResult(blockers, advisories);
    process.exit(blockers.length > 0 ? 1 : 0);
  }

  const privateKeyResult = readPrivateKeyFromOnePassword({
    privateKeyRef: config.privateKeyRef,
    env,
    cwd: repoRoot,
  });

  if (privateKeyResult.error) {
    block(blockers, privateKeyResult.error);
  } else {
    pass('1Password service-account lane resolved the GitHub App private key reference');
  }

  if (blockers.length === 0) {
    const appOwnerResult = await verifyGithubAppOwner({
      appId: config.appId,
      privateKey: privateKeyResult.privateKey,
    });

    if (appOwnerResult.error) {
      block(blockers, appOwnerResult.error);
    } else {
      pass(`GitHub App owner is ${appOwnerResult.ownerLogin}`);
    }
  }

  if (blockers.length === 0) {
    const mintResult = await mintInstallationToken({
      appId: config.appId,
      installationId: config.installationId,
      permissions: EXPECTED_MERGE_PERMISSIONS,
      privateKey: privateKeyResult.privateKey,
    });

    if (mintResult.error) {
      block(blockers, mintResult.error);
    } else {
      pass(
        `minted short-lived GitHub App installation token for ${GITHUB_OPERATION_CLASSES.merge} proof`,
      );
      if (mintResult.expiresAt) {
        pass(`installation token includes expiry ${mintResult.expiresAt}`);
      }

      const repoNames = mintResult.repositories.map((repo) => repo.full_name || repo.name);
      if (repoNames.length === 1 && repoNames[0] === EXPECTED_REPO) {
        pass(`installation token is narrowed to ${EXPECTED_REPO}`);
      } else {
        block(
          blockers,
          `installation token repository set is ${repoNames.join(', ') || 'not returned'}, expected only ${EXPECTED_REPO}`,
        );
      }

      const permissionFailures = githubMergePermissionFailures(mintResult.permissions);
      if (permissionFailures.length === 0) {
        pass(
          `installation token permissions satisfy ${GITHUB_OPERATION_CLASSES.merge}: ${summarizeGithubMergePermissions(mintResult.permissions)}`,
        );
      } else {
        block(
          blockers,
          `installation token permissions do not satisfy ${GITHUB_OPERATION_CLASSES.merge}: ${summarizeGithubMergePermissions(mintResult.permissions)}`,
        );
      }

      if (blockers.length === 0) {
        await verifyNonMutatingMergeLaneAccess(mintResult.token, blockers, args);
      }
    }
  }

  writeResult(blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const args = {
    expectedHead: '',
    prNumber: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--expected-head') {
      args.expectedHead = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--expected-head=')) {
      args.expectedHead = value.slice('--expected-head='.length);
    } else if (value === '--pr') {
      args.prNumber = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--pr=')) {
      args.prNumber = value.slice('--pr='.length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if ((args.prNumber && !args.expectedHead) || (!args.prNumber && args.expectedHead)) {
    throw new Error('--pr and --expected-head must be provided together.');
  }

  return args;
}

function requireNextValue(argv, index, flag) {
  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return nextValue;
}

function printUsage() {
  console.log(`Usage:
  npm run github:merge-doctor
  npm run github:merge-doctor -- --pr <number> --expected-head <40-char-sha>

This doctor never calls the merge endpoint.`);
}

function writeResult(blockers, advisories) {
  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub merge doctor result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub merge doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub merge doctor result: OK');
}

function describeEnvLocalDefinitions(definitions) {
  return definitions.map((definition) => `${definition.key} (${definition.filePath})`).join(', ');
}

function loadGithubMergeReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_MERGE_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

async function verifyNonMutatingMergeLaneAccess(token, blockers, args) {
  const repo = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}`,
    token,
  });
  if (!repo.ok || repo.data?.full_name !== EXPECTED_REPO) {
    block(blockers, githubApiErrorMessage(repo, `repo read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass(`repo read works for ${EXPECTED_REPO}`);

  const pulls = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/pulls?state=open&per_page=1`,
    token,
  });
  if (!pulls.ok) {
    block(blockers, githubApiErrorMessage(pulls, `pull request read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('pull request read works with merge-capable token');

  if (!args.prNumber) {
    return;
  }

  const pull = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/pulls/${args.prNumber}`,
    token,
  });
  if (!pull.ok) {
    block(blockers, githubApiErrorMessage(pull, `PR #${args.prNumber} read failed`));
    return;
  }

  const prEvaluation = evaluatePullRequestForMerge(pull.data, args.expectedHead);
  for (const message of prEvaluation.passes) {
    pass(message);
  }
  for (const message of prEvaluation.blockers) {
    block(blockers, message);
  }

  const checkRuns = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${args.expectedHead}/check-runs?per_page=100`,
    token,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }

  const combinedStatus = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${args.expectedHead}/status`,
    token,
  });
  if (!combinedStatus.ok) {
    block(
      blockers,
      githubApiErrorMessage(combinedStatus, `commit status read failed for ${EXPECTED_REPO}`),
    );
    return;
  }

  const checkEvaluation = evaluateGithubChecksForMerge({
    checkRuns: checkRuns.data?.check_runs || [],
    checkRunsTotalCount: checkRuns.data?.total_count,
    combinedStatus: combinedStatus.data || {},
  });
  for (const message of checkEvaluation.passes) {
    pass(message);
  }
  for (const message of checkEvaluation.blockers) {
    block(blockers, message);
  }
}

async function verifyNonMutatingMergeLaneAccessWithBroker(repoRoot, env, blockers, args) {
  const repo = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}`,
    repoRoot,
  });
  if (!repo.ok || repo.data?.full_name !== EXPECTED_REPO) {
    block(blockers, githubApiErrorMessage(repo, `repo read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass(`repo read works for ${EXPECTED_REPO} through broker`);

  const pulls = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/pulls?state=open&per_page=1`,
    repoRoot,
  });
  if (!pulls.ok) {
    block(blockers, githubApiErrorMessage(pulls, `pull request read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('pull request read works through broker');

  if (!args.prNumber) {
    return;
  }

  const pull = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/pulls/${args.prNumber}`,
    repoRoot,
  });
  if (!pull.ok) {
    block(blockers, githubApiErrorMessage(pull, `PR #${args.prNumber} read failed`));
    return;
  }

  const prEvaluation = evaluatePullRequestForMerge(pull.data, args.expectedHead);
  for (const message of prEvaluation.passes) {
    pass(message);
  }
  for (const message of prEvaluation.blockers) {
    block(blockers, message);
  }

  const checkRuns = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/commits/${args.expectedHead}/check-runs?per_page=100`,
    repoRoot,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }

  const combinedStatus = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/commits/${args.expectedHead}/status`,
    repoRoot,
  });
  if (!combinedStatus.ok) {
    block(
      blockers,
      githubApiErrorMessage(combinedStatus, `commit status read failed for ${EXPECTED_REPO}`),
    );
    return;
  }

  const checkEvaluation = evaluateGithubChecksForMerge({
    checkRuns: checkRuns.data?.check_runs || [],
    checkRunsTotalCount: checkRuns.data?.total_count,
    combinedStatus: combinedStatus.data || {},
  });
  for (const message of checkEvaluation.passes) {
    pass(message);
  }
  for (const message of checkEvaluation.blockers) {
    block(blockers, message);
  }
}

async function githubBrokerApiRequest({ body = undefined, env, method = 'GET', path, repoRoot }) {
  return callGithubBroker({
    env,
    repoRoot,
    request: {
      body,
      kind: 'github-api',
      method,
      operationClass: GITHUB_OPERATION_CLASSES.merge,
      path,
    },
  });
}

main().catch((error) => {
  console.error(redactSensitiveText(error?.message || String(error)));
  process.exit(1);
});
