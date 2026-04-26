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
import { callGithubBroker, isGithubBrokerAvailable } from './lib/github-broker-client.mjs';
import {
  assertAllowedGithubMergePlan,
  buildGithubMergePlan,
  evaluateGithubChecksForMerge,
  evaluatePullRequestForMerge,
  parseGithubMergeArgs,
  printGithubMergeUsage,
  redactGithubMergePlan,
} from './lib/github-merge.mjs';
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
  const blockers = [];
  const advisories = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const parsedArgs = parseGithubMergeArgs(process.argv.slice(2));
  if (parsedArgs.help) {
    printGithubMergeUsage();
    return;
  }

  const plan = buildGithubMergePlan(parsedArgs, repoRoot);
  assertAllowedGithubMergePlan(plan);

  console.log('GitHub merge: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.merge}`);
  console.log(
    `Mutation policy: ${plan.execute ? 'execute explicitly requested with prompt approval' : 'dry-run only; no merge endpoint is called'}`,
  );
  console.log(`Planned operation: ${plan.description}`);
  console.log(`Planned request: ${plan.method} ${plan.path}`);
  console.log(`Planned payload: ${JSON.stringify(redactGithubMergePlan(plan).body)}`);

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
      `${config.opConnectKeys.join('/')} is present; clear 1Password Connect env before using the service-account lane`,
    );
  } else {
    pass('1Password Connect env is not present');
  }

  if (config.privateKeyRef && isValidOpReference(config.privateKeyRef)) {
    pass(`${GITHUB_READ_ENV_KEYS.privateKeyRef} is an op:// reference`);
  } else if (config.privateKeyRef) {
    block(blockers, `${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  }

  const runtime = evaluateGithubServiceAccountRuntime(env);
  const brokerAvailable = isGithubBrokerAvailable(repoRoot, env);
  if (brokerAvailable) {
    pass(
      'GitHub runtime broker socket is available; agent process does not need service-account token',
    );
  }
  if (plan.execute && config.serviceAccountTokenPresent) {
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
    'This wrapper is limited to human-approved PR merge after live PR state, checks, expected head, permission envelope, and Review Gate v0 pass. Deploy mutation, production sync, secret changes, billing/admin, branch protection, and credential rotation remain human-present.',
  );

  if (!plan.execute) {
    if (blockers.length > 0) {
      writeResult('DRY_RUN_BLOCKED', blockers, advisories);
      process.exit(1);
    }
    pass(
      'dry-run completed without resolving service-account secrets or calling the merge endpoint',
    );
    writeResult('DRY_RUN', blockers, advisories);
    return;
  }

  const missingKeys = brokerAvailable
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

  if (blockers.length > 0) {
    writeResult('BLOCKED', blockers, advisories);
    process.exit(1);
  }

  if (brokerAvailable) {
    await verifyAndExecuteGithubMergePlanWithBroker(plan, repoRoot, env, blockers);
    writeResult(blockers.length > 0 ? 'BLOCKED' : 'OK', blockers, advisories);
    process.exit(blockers.length > 0 ? 1 : 0);
  }

  const tokenResult = await mintMergeToken({ config, env, repoRoot, blockers });
  if (tokenResult.token && blockers.length === 0) {
    await verifyAndExecuteGithubMergePlan(plan, tokenResult.token, blockers);
  }

  writeResult(blockers.length > 0 ? 'BLOCKED' : 'OK', blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

async function mintMergeToken({ blockers, config, env, repoRoot }) {
  const privateKeyResult = readPrivateKeyFromOnePassword({
    privateKeyRef: config.privateKeyRef,
    env,
    cwd: repoRoot,
  });

  if (privateKeyResult.error) {
    block(blockers, privateKeyResult.error);
    return {};
  }
  pass('1Password service-account lane resolved the GitHub App private key reference');

  const appOwnerResult = await verifyGithubAppOwner({
    appId: config.appId,
    privateKey: privateKeyResult.privateKey,
  });
  if (appOwnerResult.error) {
    block(blockers, appOwnerResult.error);
    return {};
  }
  pass(`GitHub App owner is ${appOwnerResult.ownerLogin}`);

  const mintResult = await mintInstallationToken({
    appId: config.appId,
    installationId: config.installationId,
    permissions: EXPECTED_MERGE_PERMISSIONS,
    privateKey: privateKeyResult.privateKey,
  });
  if (mintResult.error) {
    block(blockers, mintResult.error);
    return {};
  }

  pass(`minted short-lived GitHub App installation token for ${GITHUB_OPERATION_CLASSES.merge}`);
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

  return blockers.length > 0 ? {} : { token: mintResult.token };
}

async function verifyAndExecuteGithubMergePlan(plan, token, blockers) {
  const pull = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/pulls/${plan.prNumber}`,
    token,
  });
  if (!pull.ok) {
    block(blockers, githubApiErrorMessage(pull, `PR #${plan.prNumber} read failed`));
    return;
  }

  const prEvaluation = evaluatePullRequestForMerge(pull.data, plan.expectedHead);
  for (const message of prEvaluation.passes) {
    pass(message);
  }
  for (const message of prEvaluation.blockers) {
    block(blockers, message);
  }

  if (prEvaluation.blockers.length > 0) {
    return;
  }

  const checkRuns = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${plan.expectedHead}/check-runs?per_page=100`,
    token,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }

  const combinedStatus = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${plan.expectedHead}/status`,
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

  if (checkEvaluation.blockers.length > 0) {
    return;
  }

  const response = await githubApiRequest({
    body: plan.body,
    method: plan.method,
    path: plan.path,
    token,
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, 'merge request failed'));
    return;
  }

  if (response.data?.sha) {
    pass(`merged PR #${plan.prNumber}: ${response.data.sha}`);
  } else {
    pass(`merged PR #${plan.prNumber}`);
  }
}

async function verifyAndExecuteGithubMergePlanWithBroker(plan, repoRoot, env, blockers) {
  const pull = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/pulls/${plan.prNumber}`,
    repoRoot,
  });
  if (!pull.ok) {
    block(blockers, githubApiErrorMessage(pull, `PR #${plan.prNumber} read failed`));
    return;
  }

  const prEvaluation = evaluatePullRequestForMerge(pull.data, plan.expectedHead);
  for (const message of prEvaluation.passes) {
    pass(message);
  }
  for (const message of prEvaluation.blockers) {
    block(blockers, message);
  }

  if (prEvaluation.blockers.length > 0) {
    return;
  }

  const checkRuns = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/commits/${plan.expectedHead}/check-runs?per_page=100`,
    repoRoot,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }

  const combinedStatus = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/commits/${plan.expectedHead}/status`,
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

  if (checkEvaluation.blockers.length > 0) {
    return;
  }

  const response = await githubBrokerApiRequest({
    body: plan.body,
    env,
    mergeApproval: {
      approvalText: plan.approvalText,
      expectedHead: plan.expectedHead,
      prNumber: plan.prNumber,
    },
    method: plan.method,
    path: plan.path,
    repoRoot,
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, 'merge request failed'));
    return;
  }

  if (response.data?.sha) {
    pass(`merged PR #${plan.prNumber} through broker: ${response.data.sha}`);
  } else {
    pass(`merged PR #${plan.prNumber} through broker`);
  }
}

async function githubBrokerApiRequest({
  body = undefined,
  env,
  mergeApproval = undefined,
  method = 'GET',
  path,
  repoRoot,
}) {
  return callGithubBroker({
    env,
    repoRoot,
    request: {
      body,
      kind: 'github-api',
      mergeApproval,
      method,
      operationClass: GITHUB_OPERATION_CLASSES.merge,
      path,
    },
  });
}

function writeResult(status, blockers, advisories) {
  console.log('');
  if (status === 'DRY_RUN') {
    console.log('GitHub merge result: DRY_RUN');
    return;
  }

  if (status === 'DRY_RUN_BLOCKED') {
    console.log(`GitHub merge result: DRY_RUN_BLOCKED (${blockers.length})`);
    return;
  }

  if (blockers.length > 0) {
    console.log(`GitHub merge result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub merge result: OK_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub merge result: OK');
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

main().catch((error) => {
  console.error(`BLOCKED: ${redactSensitiveText(error?.message || String(error))}`);
  console.error('');
  console.error('GitHub merge result: BLOCKED (1)');
  process.exit(1);
});
