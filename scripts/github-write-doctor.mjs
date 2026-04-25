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
  githubWritePrPermissionFailures,
  isValidOpReference,
  mintInstallationToken,
  readPrivateKeyFromOnePassword,
  redactSensitiveText,
  summarizeGithubWritePrPermissions,
  verifyGithubAppOwner,
} from './lib/github-app-auth.mjs';
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

  console.log('GitHub write doctor: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log('Operation class: github.write.pr');
  console.log('Mutation policy: no repository write endpoint is called by this doctor');

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
      `${config.opConnectKeys.join('/')} is present; clear 1Password Connect env before proving the service-account lane`,
    );
  } else {
    pass('1Password Connect env is not present');
  }

  if (config.missingKeys.length > 0) {
    block(
      blockers,
      `autonomous github.write.pr lane is not configured; missing ${config.missingKeys.join(', ')}`,
    );
  } else {
    pass('all autonomous github.write.pr configuration keys are present');
  }

  if (config.privateKeyRef && isValidOpReference(config.privateKeyRef)) {
    pass(`${GITHUB_READ_ENV_KEYS.privateKeyRef} is an op:// reference`);
  } else if (config.privateKeyRef) {
    block(blockers, `${GITHUB_READ_ENV_KEYS.privateKeyRef} must be an op:// reference`);
  }

  advisory(
    advisories,
    'This doctor proves token minting and permission scope only; PR creation, PR update, PR comments, branch pushes, merge, deploy, and secret changes remain approval-gated.',
  );

  if (blockers.length > 0) {
    writeResult(blockers, advisories);
    process.exit(1);
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
      permissions: EXPECTED_WRITE_PR_PERMISSIONS,
      privateKey: privateKeyResult.privateKey,
    });

    if (mintResult.error) {
      block(blockers, mintResult.error);
    } else {
      pass('minted short-lived GitHub App installation token for github.write.pr proof');
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

      if (blockers.length === 0) {
        await verifyNonMutatingWriteLaneAccess(mintResult.token, blockers);
      }
    }
  }

  writeResult(blockers, advisories);
  process.exit(blockers.length > 0 ? 1 : 0);
}

function writeResult(blockers, advisories) {
  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub write doctor result: BLOCKED (${blockers.length})`);
    return;
  }

  if (advisories.length > 0) {
    console.log(`GitHub write doctor result: PASS_WITH_ADVISORIES (${advisories.length})`);
    return;
  }

  console.log('GitHub write doctor result: OK');
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

async function verifyNonMutatingWriteLaneAccess(token, blockers) {
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
  pass('pull request read works with write-capable token');
}

main().catch((error) => {
  console.error(redactSensitiveText(error?.message || String(error)));
  process.exit(1);
});
