import { createRequire } from 'node:module';

import {
  findFirstExisting,
  getEnvRefsCandidates,
  getForbiddenGithubReferenceKeys,
  parseEnvEntries,
} from './lib/env-bootstrap.mjs';
import {
  EXPECTED_REPO,
  EXPECTED_WRITE_PR_PERMISSIONS,
  GITHUB_READ_ENV_KEYS,
  getGithubReadLaneConfig,
  githubApiErrorMessage,
  githubApiRequest,
  githubGraphqlRequest,
  githubWritePrPermissionFailures,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubWritePrPermissions,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
import {
  assertAllowedGithubPrWritePlan,
  buildGithubPrWritePlan,
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
  console.log('Operation class: github.write.pr');
  console.log(
    `Mutation policy: ${plan.execute ? 'execute explicitly requested' : 'dry-run only; no repository write endpoint is called'}`,
  );
  console.log(`Planned operation: ${plan.description}`);
  console.log(`Planned request: ${plan.method} ${plan.path}`);
  console.log(`Planned payload: ${JSON.stringify(redactGithubPrWritePlan(plan).body)}`);

  const envLocalPath = loadLocalEnv(import.meta.url, [
    'GOVERNADA_GITHUB_APP_*',
    'OP_*',
    'GH_TOKEN',
    'GITHUB_TOKEN',
  ]);
  const refsPath = loadGithubWriteReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  if (refsPath) {
    pass(
      '.env.local.refs was inspected for github.write.pr reference metadata without resolving values',
    );

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous write lane`,
      );
    }
  }

  if (envLocalPath && envLocalDefines(envLocalPath, GITHUB_READ_ENV_KEYS.serviceAccountToken)) {
    block(
      blockers,
      `${GITHUB_READ_ENV_KEYS.serviceAccountToken} must not be defined in plaintext .env.local`,
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
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; autonomous github.write.pr must not use human or raw GitHub tokens`,
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

  advisory(
    advisories,
    'This wrapper is limited to draft PR creation, title/body update on draft PRs, or marking draft PRs ready for review; comments, branch pushes, merge, deploy, production mutation, and secret changes remain approval-gated.',
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

  if (config.missingKeys.length > 0) {
    block(
      blockers,
      `autonomous github.write.pr lane is not configured; missing ${config.missingKeys.join(', ')}`,
    );
  } else {
    pass('all autonomous github.write.pr configuration keys are present');
  }

  if (blockers.length > 0) {
    writeResult('BLOCKED', blockers, advisories);
    process.exit(1);
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
    permissions: EXPECTED_WRITE_PR_PERMISSIONS,
    privateKey: privateKeyResult.privateKey,
  });
  if (mintResult.error) {
    block(blockers, mintResult.error);
    return {};
  }

  pass('minted short-lived GitHub App installation token for github.write.pr');
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

  const permissionFailures = githubWritePrPermissionFailures(mintResult.permissions);
  if (permissionFailures.length === 0) {
    pass(
      `installation token permissions satisfy github.write.pr: ${summarizeGithubWritePrPermissions(mintResult.permissions)}`,
    );
  } else {
    block(
      blockers,
      `installation token permissions do not satisfy github.write.pr: ${summarizeGithubWritePrPermissions(mintResult.permissions)}`,
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

    if (existingPull.data?.draft !== true) {
      block(blockers, `target PR #${plan.prNumber} is not a draft; live update is not allowed`);
      return;
    }

    pass(`target PR #${plan.prNumber} is draft; live update may proceed`);
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

function envLocalDefines(filePath, key) {
  return parseEnvEntries(filePath).some((entry) => entry.key === key);
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
