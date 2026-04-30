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
  EXPECTED_SHIP_PR_PERMISSIONS,
  FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_APP_LOCAL_ENV_KEYS,
  GITHUB_OPERATION_CLASSES,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  evaluateGithubServiceAccountRuntime,
  getGithubReadLaneConfig,
  githubApiErrorMessage,
  githubApiRequest,
  githubGraphqlRequest,
  githubShipPrPermissionFailures,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubShipPrPermissions,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
import { callGithubBroker, isGithubBrokerAvailable } from './lib/github-broker-client.mjs';
import { ensureGithubBrokerRunning } from './lib/github-broker-service.mjs';
import { hasReviewGateRecord } from './lib/github-merge.mjs';
import {
  assertAllowedGithubPrWritePlan,
  buildGithubPrWritePlan,
  isCompletedReviewGateBodyOnlyUpdate,
  parseGithubPrWriteArgs,
  printGithubPrWriteUsage,
  redactGithubPrWritePlan,
} from './lib/github-pr-write.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_WRITE_REF_KEYS = new Set([
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
  const parsedArgs = parseGithubPrWriteArgs(process.argv.slice(2));
  if (parsedArgs.help) {
    printGithubPrWriteUsage();
    return;
  }

  const plan = buildGithubPrWritePlan(parsedArgs, repoRoot);
  assertAllowedGithubPrWritePlan(plan);

  console.log('GitHub PR write: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.shipPr}`);
  console.log(
    `Mutation policy: ${plan.execute ? 'execute explicitly requested' : 'dry-run only; no repository write endpoint is called'}`,
  );
  console.log(`Planned operation: ${plan.description}`);
  console.log(`Planned request: ${plan.method} ${plan.path}`);
  console.log(`Planned payload: ${JSON.stringify(redactGithubPrWritePlan(plan).body)}`);

  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubWriteReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  if (refsPath) {
    pass(
      `.env.local.refs was inspected for ${GITHUB_OPERATION_CLASSES.shipPr} reference metadata without resolving values`,
    );

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous write lane`,
      );
    }
  }

  if (forbiddenEnvLocalDefinitions.length > 0) {
    block(
      blockers,
      `.env.local must not define ${describeEnvLocalDefinitions(forbiddenEnvLocalDefinitions)} for the autonomous write lane`,
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
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; autonomous ${GITHUB_OPERATION_CLASSES.shipPr} must not use human or raw GitHub tokens`,
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
  let brokerAvailable = false;
  if (plan.execute) {
    const ensureResult = await ensureGithubBrokerRunning({ env, repoRoot });
    if (!ensureResult.ok) {
      for (const message of ensureResult.blockers || []) {
        block(blockers, message);
      }
    } else if (ensureResult.started) {
      pass('GitHub runtime broker service was started for live PR write');
      brokerAvailable = true;
    } else {
      brokerAvailable = true;
    }
  } else {
    brokerAvailable = isGithubBrokerAvailable(repoRoot, env);
  }

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
    'This wrapper is limited to draft PR creation, title/body update on draft PRs, completed Review Gate v0 body-only updates on ready PRs, or marking draft PRs ready for review; merge, deploy mutation, production sync, secret changes, billing/admin, branch protection, and credential rotation remain separately gated.',
  );

  if (!plan.execute) {
    if (blockers.length > 0) {
      writeResult('DRY_RUN_BLOCKED', blockers, advisories);
      process.exit(1);
    }
    pass(
      'dry-run completed without resolving service-account secrets or calling repository write endpoints',
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
      `autonomous ${GITHUB_OPERATION_CLASSES.shipPr} lane is not configured; missing ${missingKeys.join(', ')}`,
    );
  } else {
    pass(`all autonomous ${GITHUB_OPERATION_CLASSES.shipPr} configuration keys are present`);
  }

  if (blockers.length > 0) {
    writeResult('BLOCKED', blockers, advisories);
    process.exit(1);
  }

  if (brokerAvailable) {
    await executeGithubPrWritePlanWithBroker(plan, repoRoot, env, blockers);
    writeResult(blockers.length > 0 ? 'BLOCKED' : 'OK', blockers, advisories);
    process.exit(blockers.length > 0 ? 1 : 0);
  }

  const tokenResult = await mintWritePrToken({ config, env, repoRoot, blockers });
  if (tokenResult.token && blockers.length === 0) {
    await executeGithubPrWritePlan(plan, tokenResult.token, blockers);
  }

  writeResult(blockers.length > 0 ? 'BLOCKED' : 'OK', blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

async function mintWritePrToken({ blockers, config, env, repoRoot }) {
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
    permissions: EXPECTED_SHIP_PR_PERMISSIONS,
    privateKey: privateKeyResult.privateKey,
  });
  if (mintResult.error) {
    block(blockers, mintResult.error);
    return {};
  }

  pass(`minted short-lived GitHub App installation token for ${GITHUB_OPERATION_CLASSES.shipPr}`);
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

  const permissionFailures = githubShipPrPermissionFailures(mintResult.permissions);
  if (permissionFailures.length === 0) {
    pass(
      `installation token permissions satisfy ${GITHUB_OPERATION_CLASSES.shipPr}: ${summarizeGithubShipPrPermissions(mintResult.permissions)}`,
    );
  } else {
    block(
      blockers,
      `installation token permissions do not satisfy ${GITHUB_OPERATION_CLASSES.shipPr}: ${summarizeGithubShipPrPermissions(mintResult.permissions)}`,
    );
  }

  return blockers.length > 0 ? {} : { token: mintResult.token };
}

async function executeGithubPrWritePlan(plan, token, blockers) {
  if (plan.operation === 'ready') {
    await executeReadyPullRequestPlan(plan, token, blockers);
    return;
  }

  if (plan.operation === 'update') {
    const existingPull = await githubApiRequest({
      path: plan.path,
      token,
    });

    if (!existingPull.ok) {
      block(blockers, githubApiErrorMessage(existingPull, 'target PR read failed before update'));
      return;
    }

    const allowReadyReviewGateUpdate = isCompletedReviewGateBodyOnlyUpdate(plan, existingPull.data);
    if (existingPull.data?.draft !== true && !allowReadyReviewGateUpdate) {
      block(blockers, `target PR #${plan.prNumber} is not a draft; live update is not allowed`);
      return;
    }

    pass(
      allowReadyReviewGateUpdate
        ? `target PR #${plan.prNumber} is ready; completed Review Gate body update may proceed`
        : `target PR #${plan.prNumber} is draft; live update may proceed`,
    );
  }

  const response = await githubApiRequest({
    body: plan.body,
    method: plan.method,
    path: plan.path,
    token,
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, `${plan.operation} PR request failed`));
    return;
  }

  if (plan.operation === 'create') {
    pass(
      `created draft PR #${response.data?.number || 'unknown'}: ${response.data?.html_url || 'url unavailable'}`,
    );
    return;
  }

  pass(`updated PR #${response.data?.number || plan.prNumber}`);
}

async function executeGithubPrWritePlanWithBroker(plan, repoRoot, env, blockers) {
  if (plan.operation === 'ready') {
    await executeReadyPullRequestPlanWithBroker(plan, repoRoot, env, blockers);
    return;
  }

  if (plan.operation === 'update') {
    const existingPull = await githubBrokerApiRequest({
      env,
      path: plan.path,
      repoRoot,
    });

    if (!existingPull.ok) {
      block(blockers, githubApiErrorMessage(existingPull, 'target PR read failed before update'));
      return;
    }

    const allowReadyReviewGateUpdate = isCompletedReviewGateBodyOnlyUpdate(plan, existingPull.data);
    if (existingPull.data?.draft !== true && !allowReadyReviewGateUpdate) {
      block(blockers, `target PR #${plan.prNumber} is not a draft; live update is not allowed`);
      return;
    }

    pass(
      allowReadyReviewGateUpdate
        ? `target PR #${plan.prNumber} is ready; completed Review Gate body update may proceed`
        : `target PR #${plan.prNumber} is draft; live update may proceed`,
    );
  }

  const response = await githubBrokerApiRequest({
    body: plan.body,
    env,
    method: plan.method,
    path: plan.path,
    repoRoot,
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, `${plan.operation} PR request failed`));
    return;
  }

  if (plan.operation === 'create') {
    pass(
      `created draft PR #${response.data?.number || 'unknown'} through broker: ${response.data?.html_url || 'url unavailable'}`,
    );
    return;
  }

  pass(`updated PR #${response.data?.number || plan.prNumber} through broker`);
}

async function executeReadyPullRequestPlan(plan, token, blockers) {
  const existingPull = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/pulls/${plan.prNumber}`,
    token,
  });

  if (!existingPull.ok) {
    block(blockers, githubApiErrorMessage(existingPull, 'target PR read failed before ready'));
    return;
  }

  if (existingPull.data?.state !== 'open') {
    block(blockers, `target PR #${plan.prNumber} is not open; ready transition is not allowed`);
    return;
  }

  if (existingPull.data?.draft !== true) {
    pass(`target PR #${plan.prNumber} is already ready for review`);
    return;
  }

  if (!hasReviewGateRecord(existingPull.data?.body || '')) {
    block(
      blockers,
      `target PR #${plan.prNumber} body does not record completed Review Gate v0; ready transition is not allowed`,
    );
    return;
  }

  if (!existingPull.data?.node_id) {
    block(blockers, `target PR #${plan.prNumber} did not include a GraphQL node ID`);
    return;
  }

  const response = await githubGraphqlRequest({
    query: `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
        pullRequest {
          number
          isDraft
          url
        }
      }
    }`,
    token,
    variables: {
      pullRequestId: existingPull.data.node_id,
    },
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, 'mark PR ready request failed'));
    return;
  }

  const pullRequest = response.data?.data?.markPullRequestReadyForReview?.pullRequest;
  pass(
    `marked PR #${pullRequest?.number || plan.prNumber} ready for review: ${pullRequest?.url || existingPull.data.html_url || 'url unavailable'}`,
  );
}

async function executeReadyPullRequestPlanWithBroker(plan, repoRoot, env, blockers) {
  const existingPull = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/pulls/${plan.prNumber}`,
    repoRoot,
  });

  if (!existingPull.ok) {
    block(blockers, githubApiErrorMessage(existingPull, 'target PR read failed before ready'));
    return;
  }

  if (existingPull.data?.state !== 'open') {
    block(blockers, `target PR #${plan.prNumber} is not open; ready transition is not allowed`);
    return;
  }

  if (existingPull.data?.draft !== true) {
    pass(`target PR #${plan.prNumber} is already ready for review`);
    return;
  }

  if (!hasReviewGateRecord(existingPull.data?.body || '')) {
    block(
      blockers,
      `target PR #${plan.prNumber} body does not record completed Review Gate v0; ready transition is not allowed`,
    );
    return;
  }

  if (!existingPull.data?.node_id) {
    block(blockers, `target PR #${plan.prNumber} did not include a GraphQL node ID`);
    return;
  }

  const response = await callGithubBroker({
    env,
    repoRoot,
    request: {
      graphQlMutation: 'markPullRequestReadyForReview',
      kind: 'github-api',
      method: 'POST',
      operationClass: GITHUB_OPERATION_CLASSES.shipPr,
      path: '/graphql',
      query: `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
        markPullRequestReadyForReview(input: {pullRequestId: $pullRequestId}) {
          pullRequest {
            number
            isDraft
            url
          }
        }
      }`,
      variables: {
        pullRequestId: existingPull.data.node_id,
      },
    },
  });

  if (!response.ok) {
    block(blockers, githubApiErrorMessage(response, 'mark PR ready request failed'));
    return;
  }

  const pullRequest = response.data?.data?.markPullRequestReadyForReview?.pullRequest;
  pass(
    `marked PR #${pullRequest?.number || plan.prNumber} ready for review through broker: ${pullRequest?.url || existingPull.data.html_url || 'url unavailable'}`,
  );
}

async function githubBrokerApiRequest({ body = undefined, env, method = 'GET', path, repoRoot }) {
  return callGithubBroker({
    env,
    repoRoot,
    request: {
      body,
      kind: 'github-api',
      method,
      operationClass: GITHUB_OPERATION_CLASSES.shipPr,
      path,
    },
  });
}

function writeResult(status, blockers, advisories) {
  console.log('');
  if (status === 'DRY_RUN') {
    console.log('GitHub PR write result: DRY_RUN');
    return;
  }

  if (status === 'DRY_RUN_BLOCKED') {
    console.log(`GitHub PR write result: DRY_RUN_BLOCKED (${blockers.length})`);
    return;
  }

  if (blockers.length > 0) {
    console.log(`GitHub PR write result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub PR write result: OK_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub PR write result: OK');
}

function describeEnvLocalDefinitions(definitions) {
  return definitions.map((definition) => `${definition.key} (${definition.filePath})`).join(', ');
}

function loadGithubWriteReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_WRITE_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

main().catch((error) => {
  console.error(`BLOCKED: ${redactSensitiveText(error?.message || String(error))}`);
  console.error('');
  console.error('GitHub PR write result: BLOCKED (1)');
  process.exit(1);
});
