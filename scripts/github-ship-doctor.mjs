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
  githubShipPrPermissionFailures,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubShipPrPermissions,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
import { callGithubBroker, isGithubBrokerAvailable } from './lib/github-broker-client.mjs';
import { getScriptContext, loadLocalEnv } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { getContext } = require('./set-gh-context.js');

const EXPECTED_OP_ACCOUNT = 'my.1password.com';
const GITHUB_SHIP_REF_KEYS = new Set([
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
  const forbiddenEnvLocalDefinitions = findEnvLocalKeyDefinitions(
    repoRoot,
    FORBIDDEN_GITHUB_APP_LOCAL_ENV_KEYS,
  );
  loadLocalEnv(import.meta.url, GITHUB_APP_LOCAL_ENV_KEYS);
  const refsPath = loadGithubShipReferenceEnv(repoRoot);

  const context = getContext();
  const env = {
    ...process.env,
    ...context,
  };
  const config = getGithubReadLaneConfig(env);

  console.log('GitHub ship doctor: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.shipPr}`);
  console.log('Mutation policy: no repository write endpoint is called by this doctor');

  if (refsPath) {
    pass(
      `.env.local.refs was inspected for ${GITHUB_OPERATION_CLASSES.shipPr} reference metadata without resolving values`,
    );

    const forbiddenRefsKeys = getForbiddenGithubReferenceKeys(refsPath);
    if (forbiddenRefsKeys.length > 0) {
      block(
        blockers,
        `.env.local.refs must not define ${forbiddenRefsKeys.join(', ')} for the autonomous ship lane`,
      );
    }
  } else {
    advisory(
      advisories,
      '.env.local.refs is absent; ship lane metadata may only come from process env',
    );
  }

  if (forbiddenEnvLocalDefinitions.length > 0) {
    block(
      blockers,
      `.env.local must not define ${describeEnvLocalDefinitions(forbiddenEnvLocalDefinitions)} for the autonomous ship lane`,
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
      `${config.opConnectKeys.join('/')} is present; clear 1Password Connect env before proving the service-account lane`,
    );
  } else {
    pass('1Password Connect env is not present');
  }

  const brokerAvailable = isGithubBrokerAvailable(repoRoot, env);
  if (brokerAvailable) {
    pass(
      'GitHub runtime broker socket is available; agent process does not need service-account token',
    );
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
    'This doctor proves token minting, permission scope, and read probes only; branch commits, PR mutation, merge, deploy mutation, production sync, and secret changes remain separately gated.',
  );

  if (blockers.length > 0) {
    writeResult(blockers, advisories);
    process.exit(1);
  }

  if (brokerAvailable) {
    await verifyNonMutatingShipLaneAccessWithBroker(repoRoot, env, blockers);
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
      permissions: EXPECTED_SHIP_PR_PERMISSIONS,
      privateKey: privateKeyResult.privateKey,
    });

    if (mintResult.error) {
      block(blockers, mintResult.error);
    } else {
      pass(
        `minted short-lived GitHub App installation token for ${GITHUB_OPERATION_CLASSES.shipPr} proof`,
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

      if (blockers.length === 0) {
        await verifyNonMutatingShipLaneAccess(mintResult.token, blockers);
      }
    }
  }

  writeResult(blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

function writeResult(blockers, advisories) {
  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub ship doctor result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub ship doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub ship doctor result: OK');
}

function describeEnvLocalDefinitions(definitions) {
  return definitions.map((definition) => `${definition.key} (${definition.filePath})`).join(', ');
}

function loadGithubShipReferenceEnv(repoRoot) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot));
  if (!refsPath) {
    return '';
  }

  for (const entry of parseEnvEntries(refsPath)) {
    if (GITHUB_SHIP_REF_KEYS.has(entry.key) && process.env[entry.key] === undefined) {
      process.env[entry.key] = entry.value;
    }
  }

  return refsPath;
}

async function verifyNonMutatingShipLaneAccess(token, blockers) {
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
  pass('pull request read works with ship-capable token');

  const actions = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/actions/runs?per_page=1`,
    token,
  });
  if (!actions.ok) {
    block(blockers, githubApiErrorMessage(actions, `Actions read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('Actions workflow-run read works with ship-capable token');

  const defaultBranch = repo.data?.default_branch || 'main';
  const branch = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/branches/${defaultBranch}`,
    token,
  });
  const sha = branch.data?.commit?.sha;
  if (!branch.ok || !sha) {
    block(blockers, githubApiErrorMessage(branch, `branch read failed for ${defaultBranch}`));
    return;
  }
  pass(`default branch read works for ${defaultBranch}`);

  const checkRuns = await githubApiRequest({
    path: `/repos/${EXPECTED_REPO}/commits/${sha}/check-runs?per_page=1`,
    token,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('check-run read works with ship-capable token');
}

async function verifyNonMutatingShipLaneAccessWithBroker(repoRoot, env, blockers) {
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

  const actions = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/actions/runs?per_page=1`,
    repoRoot,
  });
  if (!actions.ok) {
    block(blockers, githubApiErrorMessage(actions, `Actions read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('Actions workflow-run read works through broker');

  const defaultBranch = repo.data?.default_branch || 'main';
  const branch = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/branches/${defaultBranch}`,
    repoRoot,
  });
  const sha = branch.data?.commit?.sha;
  if (!branch.ok || !sha) {
    block(blockers, githubApiErrorMessage(branch, `branch read failed for ${defaultBranch}`));
    return;
  }
  pass(`default branch read works for ${defaultBranch} through broker`);

  const checkRuns = await githubBrokerApiRequest({
    env,
    path: `/repos/${EXPECTED_REPO}/commits/${sha}/check-runs?per_page=1`,
    repoRoot,
  });
  if (!checkRuns.ok) {
    block(blockers, githubApiErrorMessage(checkRuns, `check-run read failed for ${EXPECTED_REPO}`));
    return;
  }
  pass('check-run read works through broker');
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

main().catch((error) => {
  console.error(redactSensitiveText(error?.message || String(error)));
  process.exit(1);
});
