import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

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
  GITHUB_OPERATION_CLASSES,
  GITHUB_READ_ENV_KEYS,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS,
  evaluateGithubServiceAccountRuntime,
  getGithubReadLaneConfig,
  githubApiErrorMessage,
  githubApiRequest,
  githubGraphqlRequest,
  githubPermissionFailuresForOperationClass,
  githubPermissionsForOperationClass,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubPermissionsForOperationClass,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
import { assertGithubBrokerRequestAllowed } from './lib/github-broker-policy.mjs';
import { githubBrokerSocketPath } from './lib/github-broker-client.mjs';
import { parseGithubMergeApproval } from './lib/github-merge-approval.mjs';
import { evaluateGithubChecksForMerge, evaluatePullRequestForMerge } from './lib/github-merge.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_BROKER_REF_KEYS = new Set([
  GITHUB_READ_ENV_KEYS.appId,
  GITHUB_READ_ENV_KEYS.installationId,
  GITHUB_READ_ENV_KEYS.privateKeyRef,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.expiresAt,
  GITHUB_SERVICE_ACCOUNT_RUNTIME_ENV_KEYS.rotateAfter,
]);

function pass(message) {
  console.log(`OK: ${message}`);
}

function block(message) {
  console.error(`BLOCKED: ${message}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const { repoRoot } = getScriptContext(import.meta.url);
  const env = prepareBrokerEnv(repoRoot);
  const socketPath = githubBrokerSocketPath(repoRoot, env);

  if (args.status) {
    console.log('GitHub runtime broker: status probe');
    console.log(`Socket: ${socketPath}`);
    console.log(`Available: ${existsSync(socketPath) ? 'yes' : 'no'}`);
    return;
  }

  const context = getContext();
  validateBrokerStartup({ context, env, repoRoot });

  const socketDir = path.dirname(socketPath);
  mkdirSync(socketDir, { mode: 0o700, recursive: true });
  if (path.basename(socketDir).startsWith('gov-gh-')) {
    chmodSync(socketDir, 0o700);
  }
  if (existsSync(socketPath)) {
    unlinkSync(socketPath);
  }

  const server = net.createServer((socket) => {
    handleBrokerSocket({ context, env, repoRoot, socket }).catch((error) => {
      socket.end(
        `${JSON.stringify({
          error: redactSensitiveText(error?.message || String(error)),
          ok: false,
          status: 0,
        })}\n`,
      );
    });
  });

  server.listen(socketPath, () => {
    chmodSync(socketPath, 0o600);
    pass('GitHub runtime broker started');
    console.log(`Socket: ${socketPath}`);
    console.log(
      'Secrets: OP_SERVICE_ACCOUNT_TOKEN, private key, and installation tokens stay inside this broker process',
    );
    console.log(
      `Operation classes: ${[
        GITHUB_OPERATION_CLASSES.read,
        GITHUB_OPERATION_CLASSES.shipPr,
        GITHUB_OPERATION_CLASSES.merge,
      ].join(', ')}`,
    );
  });

  process.on('SIGINT', () => {
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

function parseArgs(argv) {
  return {
    help: argv.includes('--help') || argv.includes('-h'),
    status: argv.includes('--status'),
  };
}

function printUsage() {
  console.log(`Usage:
  npm run github:runtime-broker
  npm run github:runtime-broker -- --status

Start this from a human Terminal after exporting OP_SERVICE_ACCOUNT_TOKEN. Agents call the broker socket; the broker never returns service-account tokens, private keys, or GitHub installation tokens.`);
}

function prepareBrokerEnv(repoRoot) {
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubBrokerReferenceEnv(repoRoot);
  if (refsPath) {
    pass('.env.local.refs was inspected for GitHub App broker metadata without resolving values');
  }

  return {
    ...process.env,
    ...getContext(),
  };
}

function validateBrokerStartup({ context, env, repoRoot }) {
  const blockers = [];
  const config = getGithubReadLaneConfig(env);
  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  const forbiddenRefsKeys = refsPath ? getForbiddenGithubReferenceKeys(refsPath) : [];

  if (forbiddenEnvLocalDefinitions.length > 0) {
    blockers.push(
      `.env.local must not define ${forbiddenEnvLocalDefinitions
        .map((definition) => definition.key)
        .join(', ')} for the GitHub broker lane`,
    );
  }

  if (forbiddenRefsKeys.length > 0) {
    blockers.push(
      `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the GitHub broker lane`,
    );
  }

  if (context.GH_REPO !== EXPECTED_REPO) {
    blockers.push(`repo context is ${context.GH_REPO || 'unset'}, expected ${EXPECTED_REPO}`);
  }

  if (context.OP_ACCOUNT !== EXPECTED_OP_ACCOUNT) {
    blockers.push(
      `1Password account is ${context.OP_ACCOUNT || 'unset'}, expected ${EXPECTED_OP_ACCOUNT}`,
    );
  }

  if (config.rawGithubTokenKeys.length > 0) {
    blockers.push(
      `raw ${config.rawGithubTokenKeys.join('/')} env is present; broker must not inherit human or raw GitHub tokens`,
    );
  }

  if (config.opConnectKeys.length > 0) {
    blockers.push(
      `${config.opConnectKeys.join('/')} is present; broker must not use 1Password Connect env`,
    );
  }

  if (config.missingKeys.length > 0) {
    blockers.push(`GitHub broker is not configured; missing ${config.missingKeys.join(', ')}`);
  }

  if (config.privateKeyRef && !isValidOpReference(config.privateKeyRef)) {
    blockers.push(`${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  }

  const runtime = evaluateGithubServiceAccountRuntime(env);
  blockers.push(...runtime.blockers);

  if (blockers.length > 0) {
    for (const message of blockers) {
      block(message);
    }
    process.exit(1);
  }

  for (const message of runtime.passes) {
    pass(message);
  }
  for (const message of runtime.advisories) {
    console.log(`ADVISORY: ${message}`);
  }
}

async function handleBrokerSocket({ context, env, repoRoot, socket }) {
  socket.setEncoding('utf8');
  let requestText = '';
  let handled = false;

  socket.on('data', async (chunk) => {
    requestText += chunk;
    if (handled || !requestText.includes('\n')) {
      return;
    }

    handled = true;
    try {
      const request = JSON.parse(requestText.trim());
      const response = await handleBrokerRequest({ context, env, repoRoot, request });
      socket.end(`${JSON.stringify(response)}\n`);
    } catch (error) {
      socket.end(
        `${JSON.stringify({
          error: redactSensitiveText(error?.message || String(error)),
          ok: false,
          status: 0,
        })}\n`,
      );
    }
  });
}

async function handleBrokerRequest({ env, repoRoot, request }) {
  if (request?.kind === 'status') {
    return {
      ok: true,
      repo: EXPECTED_REPO,
      supportedOperationClasses: [
        GITHUB_OPERATION_CLASSES.read,
        GITHUB_OPERATION_CLASSES.writePr,
        GITHUB_OPERATION_CLASSES.shipPr,
        GITHUB_OPERATION_CLASSES.merge,
      ],
    };
  }

  if (request?.kind !== 'github-api') {
    throw new Error('broker request kind must be status or github-api');
  }

  assertGithubBrokerRequestAllowed(request);

  const operationClass = request.operationClass;
  const privateKeyResult = readPrivateKeyFromOnePassword({
    privateKeyRef: env[GITHUB_READ_ENV_KEYS.privateKeyRef],
    env,
    cwd: repoRoot,
  });
  if (privateKeyResult.error) {
    return {
      error: privateKeyResult.error,
      ok: false,
      status: 0,
    };
  }

  const appOwnerResult = await verifyGithubAppOwner({
    appId: env[GITHUB_READ_ENV_KEYS.appId],
    privateKey: privateKeyResult.privateKey,
  });
  if (appOwnerResult.error) {
    return {
      error: appOwnerResult.error,
      ok: false,
      status: 0,
    };
  }

  const mintResult = await mintInstallationToken({
    appId: env[GITHUB_READ_ENV_KEYS.appId],
    installationId: env[GITHUB_READ_ENV_KEYS.installationId],
    permissions: githubPermissionsForOperationClass(operationClass),
    privateKey: privateKeyResult.privateKey,
  });
  if (mintResult.error) {
    return {
      error: mintResult.error,
      ok: false,
      status: mintResult.status || 0,
    };
  }

  const repoNames = mintResult.repositories.map((repo) => repo.full_name || repo.name);
  if (repoNames.length !== 1 || repoNames[0] !== EXPECTED_REPO) {
    return {
      error: `installation token repository set is ${repoNames.join(', ') || 'not returned'}, expected only ${EXPECTED_REPO}`,
      ok: false,
      status: 0,
    };
  }

  const permissionFailures = githubPermissionFailuresForOperationClass(
    operationClass,
    mintResult.permissions,
  );
  if (permissionFailures.length > 0) {
    return {
      error: `installation token permissions do not satisfy ${operationClass}: ${summarizeGithubPermissionsForOperationClass(
        operationClass,
        mintResult.permissions,
      )}`,
      ok: false,
      status: 0,
    };
  }

  if (isMergeExecutionRequest(request)) {
    const mergeGate = await verifyBrokerMergeGate({
      request,
      token: mintResult.token,
    });
    if (mergeGate.error) {
      return {
        error: mergeGate.error,
        ok: false,
        status: mergeGate.status || 0,
      };
    }
  }

  const response =
    request.path === '/graphql'
      ? await githubGraphqlRequest({
          query: request.query,
          token: mintResult.token,
          variables: request.variables || {},
        })
      : await githubApiRequest({
          body: request.body,
          method: request.method || 'GET',
          path: request.path,
          token: mintResult.token,
        });

  return {
    data: response.data,
    ok: response.ok,
    status: response.status,
  };
}

function isMergeExecutionRequest(request) {
  return (
    request?.operationClass === GITHUB_OPERATION_CLASSES.merge &&
    String(request?.method || '').toUpperCase() === 'PUT' &&
    /^\/repos\/governada\/app\/pulls\/[1-9]\d*\/merge$/u.test(String(request?.path || ''))
  );
}

async function verifyBrokerMergeGate({ request, token }) {
  const prNumber = Number(String(request.path).match(/\/pulls\/([1-9]\d*)\/merge$/u)?.[1] || 0);
  const expectedHead = String(request.body?.sha || '');
  const approval = parseGithubMergeApproval({
    expectedHead,
    prNumber,
    text: request.mergeApproval?.approvalText || '',
  });
  if (!approval.ok) {
    return {
      error: `merge approval is not current or specific: ${approval.reasons.join('; ')}`,
    };
  }

  const pull = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/pulls/${prNumber}`,
    token,
  });
  if (!pull.ok) {
    return {
      error: githubApiErrorMessage(pull, `PR #${prNumber} read failed`),
      status: pull.status,
    };
  }

  const prEvaluation = evaluatePullRequestForMerge(pull.data, expectedHead);
  if (prEvaluation.blockers.length > 0) {
    return {
      error: `merge PR gate failed: ${prEvaluation.blockers.join('; ')}`,
    };
  }

  const checkRuns = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${expectedHead}/check-runs?per_page=100`,
    token,
  });
  if (!checkRuns.ok) {
    return {
      error: githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`),
      status: checkRuns.status,
    };
  }

  const combinedStatus = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${expectedHead}/status`,
    token,
  });
  if (!combinedStatus.ok) {
    return {
      error: githubApiErrorMessage(
        combinedStatus,
        `commit status read failed for ${EXPECTED_REPO}`,
      ),
      status: combinedStatus.status,
    };
  }

  const checkEvaluation = evaluateGithubChecksForMerge({
    checkRuns: checkRuns.data?.check_runs || [],
    checkRunsTotalCount: checkRuns.data?.total_count,
    combinedStatus: combinedStatus.data || {},
  });
  if (checkEvaluation.blockers.length > 0) {
    return {
      error: `merge check gate failed: ${checkEvaluation.blockers.join('; ')}`,
    };
  }

  return {};
}

function loadGithubBrokerReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_BROKER_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

main().catch((error) => {
  block(redactSensitiveText(error?.message || String(error)));
  process.exit(1);
});
