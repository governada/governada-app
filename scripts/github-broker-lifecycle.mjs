#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

import { getCheckoutKind } from './lib/env-bootstrap.mjs';
import {
  EXPECTED_OP_ACCOUNT,
  GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION,
  GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION,
  GITHUB_BROKER_INSTALL_CONFIRMATION,
  GITHUB_BROKER_STOP_CONFIRMATION,
  GITHUB_BROKER_TOKEN_OP_REF_KEY,
  GITHUB_BROKER_UNINSTALL_CONFIRMATION,
  buildBrokerLaunchAgentPlist,
  deleteGithubBrokerTokenKeychainCache,
  ensureGithubBrokerRunning,
  findClangCliPath,
  findNodeForBrokerService,
  findOpCliPath,
  getKeychainCacheCSourcePath,
  getKeychainCacheHelperPath,
  getBrokerServicePaths,
  getGithubBrokerStatus,
  getGithubBrokerTokenCacheStatus,
  getLaunchctlDomain,
  inspectKeychainCacheHelper,
  isBrokerServiceInstalled,
  isSafeServiceAccountTokenOpRef,
  readGithubBrokerRefs,
  readServiceAccountTokenFrom1Password,
  resolveServiceAccountTokenOpRef,
  runLaunchctl,
  validateBrokerServicePlist,
  writeGithubBrokerTokenKeychainCache,
  writeBrokerServicePlist,
} from './lib/github-broker-service.mjs';
import { redactSensitiveText } from './lib/github-app-auth.mjs';
import { callGithubBroker, githubBrokerSocketPath } from './lib/github-broker-client.mjs';
import { getScriptContext } from './lib/runtime.mjs';

function ok(message) {
  console.log(`OK: ${message}`);
}

function advisory(message) {
  console.log(`ADVISORY: ${message}`);
}

function blocked(message) {
  console.error(`BLOCKED: ${message}`);
}

async function main() {
  const { repoRoot } = getScriptContext(import.meta.url);
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help || !parsed.command) {
    printUsage();
    return;
  }

  if (parsed.command === 'doctor') {
    await runDoctor({ repoRoot });
    return;
  }

  if (parsed.command === 'status') {
    await runStatus({ parsed, repoRoot });
    return;
  }

  if (parsed.command === 'ensure' || parsed.command === 'start') {
    await runEnsure({ repoRoot });
    return;
  }

  if (parsed.command === 'install') {
    runInstall({ parsed, repoRoot });
    return;
  }

  if (parsed.command === 'cache-token') {
    runCacheToken({ parsed, repoRoot });
    return;
  }

  if (parsed.command === 'clear-token-cache') {
    runClearTokenCache({ parsed });
    return;
  }

  if (parsed.command === 'stop') {
    await runStop({ parsed, repoRoot });
    return;
  }

  if (parsed.command === 'logs') {
    runLogs({ parsed, repoRoot });
    return;
  }

  if (parsed.command === 'uninstall') {
    await runUninstall({ parsed, repoRoot });
    return;
  }

  blocked(`unknown github broker lifecycle command: ${parsed.command}`);
  printUsage();
  process.exit(1);
}

function parseArgs(argv) {
  const result = {
    command: argv[0] || '',
    confirm: '',
    allowWorktreeInstall: false,
    help: argv.includes('--help') || argv.includes('-h'),
    requireRunning: false,
    tail: 80,
    temporaryWorktreeProof: false,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--confirm') {
      result.confirm = argv[index + 1] || '';
      index += 1;
    } else if (arg === '--allow-worktree-install') {
      result.allowWorktreeInstall = true;
    } else if (arg === '--temporary-worktree-proof') {
      result.temporaryWorktreeProof = true;
    } else if (arg === '--require-running') {
      result.requireRunning = true;
    } else if (arg === '--tail') {
      result.tail = Number(argv[index + 1] || result.tail);
      index += 1;
    } else if (arg.startsWith('--tail=')) {
      result.tail = Number(arg.slice('--tail='.length));
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  npm run github:broker -- doctor
  npm run github:broker -- status [--require-running]
  npm run github:broker -- ensure
  npm run github:broker -- start
  npm run github:broker -- install --confirm ${GITHUB_BROKER_INSTALL_CONFIRMATION} [--temporary-worktree-proof]
  npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION}
  npm run github:broker -- clear-token-cache --confirm ${GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION}
  npm run github:broker -- stop --confirm ${GITHUB_BROKER_STOP_CONFIRMATION}
  npm run github:broker -- logs [--tail 80]
  npm run github:broker -- uninstall --confirm ${GITHUB_BROKER_UNINSTALL_CONFIRMATION}

After one approved install, ensure/start are agent-capable. They reuse a
healthy Governada-only broker or start the LaunchAgent when needed, and never expose OP_SERVICE_ACCOUNT_TOKEN, the
GitHub App private key, or GitHub installation tokens to the agent process.

cache-token is a one-time or rotation-time human-present command. It reads the
service-account token from the configured 1Password op:// pointer and stores it
in the local macOS Keychain runtime cache without printing the token.`);
}

async function runDoctor({ repoRoot }) {
  const blockers = [];
  const advisories = [];
  const paths = getBrokerServicePaths(repoRoot);
  const nodePath = findNodeForBrokerService();
  const opPath = findOpCliPath();
  const clangPath = findClangCliPath();
  const keychainSourcePath = getKeychainCacheCSourcePath();
  const keychainHelperPath = getKeychainCacheHelperPath();
  const tokenOpRef = resolveServiceAccountTokenOpRef({ repoRoot });
  const { refsPath } = readGithubBrokerRefs(repoRoot);
  const status = await getGithubBrokerStatus({ repoRoot });
  const tokenCache = getGithubBrokerTokenCacheStatus();

  console.log('GitHub broker lifecycle: doctor');
  console.log(`Service: ${paths.label}`);
  console.log(`Plist: ${paths.plistPath}`);
  console.log(`Socket: ${status.socketPath}`);

  if (refsPath) {
    ok(`reference metadata is available at ${refsPath}`);
  } else {
    blockers.push('.env.local.refs is missing');
    blocked('.env.local.refs is missing');
  }

  if (tokenOpRef && isSafeServiceAccountTokenOpRef(tokenOpRef)) {
    ok(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is a full op:// pointer`);
  } else if (tokenOpRef) {
    blockers.push(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is not a safe op:// pointer`);
    blocked(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is not a safe op:// pointer`);
  } else {
    blockers.push(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is missing`);
    blocked(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is missing`);
  }

  if (nodePath && existsSync(nodePath)) {
    ok(`Node path for LaunchAgent is ${nodePath}`);
  } else {
    blockers.push('Node executable for LaunchAgent is missing');
    blocked('Node executable for LaunchAgent is missing');
  }

  if (opPath) {
    ok(`1Password CLI path is ${opPath}`);
  } else {
    blockers.push('1Password CLI path is missing');
    blocked('1Password CLI path is missing');
  }

  if (clangPath) {
    ok(`clang path for Keychain helper is ${clangPath}`);
  } else {
    blockers.push('clang is missing');
    blocked('clang is missing');
  }

  if (existsSync(keychainSourcePath)) {
    ok(`Keychain C helper source is ${keychainSourcePath}`);
  } else {
    blockers.push(`Keychain C helper source is missing at ${keychainSourcePath}`);
    blocked(`Keychain C helper source is missing at ${keychainSourcePath}`);
  }

  const helper = inspectKeychainCacheHelper();
  if (helper.ok && !helper.stale) {
    ok(
      `Keychain helper is present at ${helper.path || keychainHelperPath}${
        helper.signatureIdentifier ? ` with signing identifier ${helper.signatureIdentifier}` : ''
      }`,
    );
  } else if (helper.ok && helper.stale) {
    advisories.push('Keychain helper is older than its source');
    advisory(
      `Keychain helper is older than its source; cache-token rebuilds it during the human-present setup step before token-bearing broker start`,
    );
  } else if (!helper.exists) {
    advisories.push('Keychain helper has not been built yet');
    advisory(
      `Keychain helper has not been built yet; cache-token builds it during the human-present setup step before token-bearing broker start`,
    );
  } else {
    blockers.push(helper.error || 'Keychain helper is not usable');
    blocked(helper.error || 'Keychain helper is not usable');
  }

  if (tokenCache.present) {
    ok('service-account token runtime cache is present in macOS Keychain');
  } else if (tokenCache.error) {
    blockers.push(
      `service-account token runtime cache could not be inspected: ${tokenCache.error}`,
    );
    blocked(
      `service-account token runtime cache could not be inspected: ${redactSensitiveText(
        tokenCache.error,
      )}`,
    );
  } else {
    advisories.push('service-account token runtime cache is not visible to this process');
    advisory(
      `service-account token runtime cache is not visible to this process; run npm run github:broker -- ensure to let the LaunchAgent prove cache access, or run npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION} once with human approval if the cache is truly absent`,
    );
  }

  if (isBrokerServiceInstalled(repoRoot)) {
    ok('broker LaunchAgent plist is installed');
    const plistValidation = validateBrokerServicePlist({ repoRoot });
    if (plistValidation.ok) {
      ok('broker LaunchAgent plist matches the expected Governada service definition');
    } else {
      for (const blocker of plistValidation.blockers || []) {
        blockers.push(blocker);
        blocked(blocker);
      }
    }
  } else {
    advisories.push('broker LaunchAgent plist is not installed yet');
    advisory('broker LaunchAgent plist is not installed yet');
  }

  if (status.running) {
    ok(`broker is running for ${status.repo || 'unknown repo'}`);
  } else {
    advisories.push('broker is not currently running');
    advisory('broker is not currently running');
  }

  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub broker lifecycle doctor result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }
  if (advisories.length > 0) {
    console.log(
      `GitHub broker lifecycle doctor result: PASS_WITH_ADVISORIES (${advisories.length})`,
    );
    return;
  }
  console.log('GitHub broker lifecycle doctor result: PASS');
}

async function runStatus({ parsed, repoRoot }) {
  const status = await getGithubBrokerStatus({ repoRoot });
  const paths = getBrokerServicePaths(repoRoot);

  console.log('GitHub broker lifecycle: status');
  console.log(`Service: ${paths.label}`);
  console.log(`Socket: ${status.socketPath}`);

  if (isBrokerServiceInstalled(repoRoot)) {
    ok('broker LaunchAgent plist is installed');
  } else {
    advisory('broker LaunchAgent plist is not installed');
  }

  if (status.running) {
    ok(`broker is running for ${status.repo || 'unknown repo'}`);
    if (status.supportedOperationClasses?.length) {
      ok(`operation classes: ${status.supportedOperationClasses.join(', ')}`);
    }
    console.log('GitHub broker lifecycle result: RUNNING');
    return;
  }

  if (status.socketExists) {
    advisory(`broker socket exists but did not answer: ${status.error}`);
    console.log('GitHub broker lifecycle result: STALE_SOCKET');
  } else {
    advisory('broker is not running');
    console.log('GitHub broker lifecycle result: NOT_RUNNING');
  }

  if (parsed.requireRunning) {
    process.exit(1);
  }
}

async function runEnsure({ repoRoot }) {
  console.log('GitHub broker lifecycle: ensure');
  const result = await ensureGithubBrokerRunning({ repoRoot });
  if (!result.ok) {
    for (const blocker of result.blockers || []) {
      blocked(redactSensitiveText(blocker));
    }
    console.log('GitHub broker lifecycle ensure result: BLOCKED');
    process.exit(1);
  }

  for (const message of result.advisories || []) {
    advisory(message);
  }
  ok(result.started ? 'broker service started and broker is healthy' : 'broker is already running');
  console.log(`Socket: ${result.status.socketPath}`);
  console.log('GitHub broker lifecycle ensure result: RUNNING');
}

function runInstall({ parsed, repoRoot }) {
  if (parsed.confirm !== GITHUB_BROKER_INSTALL_CONFIRMATION) {
    blocked(
      `installing the broker service requires --confirm ${GITHUB_BROKER_INSTALL_CONFIRMATION}`,
    );
    process.exit(1);
  }

  if (parsed.allowWorktreeInstall) {
    blocked(
      'deprecated --allow-worktree-install flag removed; use --temporary-worktree-proof only for a disposable live proof from this worktree',
    );
    process.exit(1);
  }

  if (getCheckoutKind(repoRoot) === 'worktree' && !parsed.temporaryWorktreeProof) {
    blocked(
      'durable broker service install must run from the shared checkout after merge; pass --temporary-worktree-proof only for a temporary live proof from this worktree',
    );
    process.exit(1);
  }

  const tokenOpRef = resolveServiceAccountTokenOpRef({ repoRoot });
  if (!isSafeServiceAccountTokenOpRef(tokenOpRef)) {
    blocked(
      `${GITHUB_BROKER_TOKEN_OP_REF_KEY} must be present as a full op://vault/item/field pointer before install`,
    );
    process.exit(1);
  }

  const opPath = findOpCliPath();
  if (!opPath) {
    blocked(
      '1Password CLI was not found; install or expose op before installing broker service so cache-token can refresh the runtime cache',
    );
    process.exit(1);
  }

  const clangPath = findClangCliPath();
  if (!clangPath) {
    blocked('clang was not found; broker service needs C Keychain helper support');
    process.exit(1);
  }

  const keychainSourcePath = getKeychainCacheCSourcePath();
  if (!existsSync(keychainSourcePath)) {
    blocked(`Keychain C helper source is missing at ${keychainSourcePath}`);
    process.exit(1);
  }

  ok(
    'Keychain helper source and compiler are available; cache-token force-builds the helper during the human-present setup step before broker start',
  );

  const nodePath = findNodeForBrokerService();
  const expectedPlist = buildBrokerLaunchAgentPlist({ nodePath, repoRoot });
  if (expectedPlist.includes(tokenOpRef) || expectedPlist.includes('OP_SERVICE_ACCOUNT_TOKEN')) {
    blocked('refusing to install broker service because plist would contain token material');
    process.exit(1);
  }

  const { paths } = writeBrokerServicePlist({ nodePath, repoRoot });
  ok(`wrote broker LaunchAgent plist to ${paths.plistPath}`);
  ok(`LaunchAgent will use ${nodePath}`);
  ok(
    `LaunchAgent runner will read the service-account token from macOS Keychain; source-of-truth refresh uses ${GITHUB_BROKER_TOKEN_OP_REF_KEY} through ${opPath} (${EXPECTED_OP_ACCOUNT})`,
  );

  const bootout = runLaunchctl(['bootout', getLaunchctlDomain(), paths.plistPath]);
  if (!bootout.ok) {
    advisory(
      `existing broker service was not loaded or could not be booted out: ${bootout.output}`,
    );
  }

  const bootstrap = runLaunchctl(['bootstrap', getLaunchctlDomain(), paths.plistPath], {
    allowAlreadyBootstrapped: true,
  });
  if (!bootstrap.ok) {
    blocked(`broker service bootstrap failed: ${bootstrap.output}`);
    process.exit(1);
  }

  ok('broker LaunchAgent is installed and bootstrapped');
  console.log('GitHub broker lifecycle install result: OK');
}

function runCacheToken({ parsed, repoRoot }) {
  if (parsed.confirm !== GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION) {
    blocked(
      `caching the broker service-account token requires --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION}`,
    );
    process.exit(1);
  }

  console.log('GitHub broker lifecycle: cache-token');
  const tokenOpRef = resolveServiceAccountTokenOpRef({ repoRoot });
  if (!isSafeServiceAccountTokenOpRef(tokenOpRef)) {
    blocked(
      `${GITHUB_BROKER_TOKEN_OP_REF_KEY} must be present as a full op://vault/item/field pointer before caching`,
    );
    process.exit(1);
  }
  ok(`${GITHUB_BROKER_TOKEN_OP_REF_KEY} is a full op:// pointer`);

  const read = readServiceAccountTokenFrom1Password({ tokenOpRef });
  if (!read.ok) {
    blocked(read.error || '1Password service-account token read failed');
    process.exit(1);
  }
  ok('service-account token was resolved from 1Password without printing its value');

  const write = writeGithubBrokerTokenKeychainCache({ token: read.token });
  if (!write.ok) {
    blocked(write.error || 'macOS Keychain runtime cache write failed');
    process.exit(1);
  }

  const cacheStatus = getGithubBrokerTokenCacheStatus();
  if (!cacheStatus.present) {
    blocked(
      cacheStatus.error || 'macOS Keychain runtime cache write did not leave a readable cache item',
    );
    process.exit(1);
  }

  ok('service-account token runtime cache was written to macOS Keychain');
  console.log('GitHub broker lifecycle cache-token result: OK');
}

function runClearTokenCache({ parsed }) {
  if (parsed.confirm !== GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION) {
    blocked(
      `clearing the broker service-account token cache requires --confirm ${GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION}`,
    );
    process.exit(1);
  }

  console.log('GitHub broker lifecycle: clear-token-cache');
  const result = deleteGithubBrokerTokenKeychainCache();
  if (!result.ok) {
    blocked(result.error || 'macOS Keychain runtime cache clear failed');
    process.exit(1);
  }

  ok(
    result.removed
      ? 'service-account token runtime cache was removed from macOS Keychain'
      : 'service-account token runtime cache was already absent',
  );
  console.log('GitHub broker lifecycle clear-token-cache result: OK');
}

async function runStop({ parsed, repoRoot }) {
  if (parsed.confirm !== GITHUB_BROKER_STOP_CONFIRMATION) {
    blocked(`stopping the broker requires --confirm ${GITHUB_BROKER_STOP_CONFIRMATION}`);
    process.exit(1);
  }

  const status = await getGithubBrokerStatus({ repoRoot });
  if (!status.socketExists) {
    ok('broker is not running');
    return;
  }

  if (!status.running) {
    advisory(`removing stale broker socket: ${status.error}`);
    removeManagedBrokerSocket({ repoRoot, socketPath: status.socketPath });
    ok('stale broker socket removed');
    return;
  }

  const response = await callGithubBroker({
    repoRoot,
    request: {
      confirm: GITHUB_BROKER_STOP_CONFIRMATION,
      kind: 'shutdown',
    },
    timeoutMs: 5000,
  });

  if (!response?.ok) {
    blocked(redactSensitiveText(response?.error || 'broker shutdown failed'));
    process.exit(1);
  }

  const stopped = await waitForBrokerStop(repoRoot);
  if (!stopped) {
    blocked('broker accepted shutdown but socket is still present');
    process.exit(1);
  }

  ok('broker stopped');
}

function runLogs({ parsed, repoRoot }) {
  const paths = getBrokerServicePaths(repoRoot);
  const tailCount =
    Number.isFinite(parsed.tail) && parsed.tail > 0 ? Math.min(parsed.tail, 500) : 80;

  console.log('GitHub broker lifecycle: logs');
  printLogTail('stdout', paths.stdoutPath, tailCount);
  printLogTail('stderr', paths.stderrPath, tailCount);
}

async function runUninstall({ parsed, repoRoot }) {
  if (parsed.confirm !== GITHUB_BROKER_UNINSTALL_CONFIRMATION) {
    blocked(
      `uninstalling the broker service requires --confirm ${GITHUB_BROKER_UNINSTALL_CONFIRMATION}`,
    );
    process.exit(1);
  }

  await runStop({ parsed: { confirm: GITHUB_BROKER_STOP_CONFIRMATION }, repoRoot });

  const paths = getBrokerServicePaths(repoRoot);
  const bootout = runLaunchctl(['bootout', getLaunchctlDomain(), paths.plistPath]);
  if (!bootout.ok) {
    advisory(`broker service bootout did not complete cleanly: ${bootout.output}`);
  }

  if (existsSync(paths.plistPath)) {
    unlinkSync(paths.plistPath);
    ok(`removed broker LaunchAgent plist at ${paths.plistPath}`);
  } else {
    ok('broker LaunchAgent plist is already absent');
  }

  const cacheStatus = getGithubBrokerTokenCacheStatus();
  if (cacheStatus.present) {
    advisory(
      `service-account token runtime cache remains in macOS Keychain; clear it separately with npm run github:broker -- clear-token-cache --confirm ${GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION} during rotation, revocation, or broker decommissioning`,
    );
  } else if (cacheStatus.error) {
    advisory(
      `service-account token runtime cache status could not be inspected after uninstall: ${redactSensitiveText(
        cacheStatus.error,
      )}`,
    );
  }

  console.log('GitHub broker lifecycle uninstall result: OK');
}

async function waitForBrokerStop(repoRoot) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5000) {
    if (!existsSync(githubBrokerSocketPath(repoRoot))) {
      return true;
    }
    await sleep(100);
  }

  return false;
}

function printLogTail(label, logPath, tailCount) {
  console.log(`--- ${label}: ${logPath}`);
  if (!existsSync(logPath)) {
    advisory(`${label} log is not present`);
    return;
  }

  const contents = redactSensitiveText(readFileSync(logPath, 'utf8'));
  const lines = contents.split(/\r?\n/u);
  console.log(lines.slice(-tailCount).join('\n'));
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function removeManagedBrokerSocket({ repoRoot, socketPath }) {
  const resolvedSocketPath = path.resolve(socketPath);
  const defaultSocketPath = path.resolve(githubBrokerSocketPath(repoRoot, {}));
  const repoRuntimeDir = path.resolve(repoRoot, '.agents', 'runtime');
  const relativeRuntimePath = path.relative(repoRuntimeDir, resolvedSocketPath);
  const insideRepoRuntimeDir =
    relativeRuntimePath &&
    !relativeRuntimePath.startsWith('..') &&
    !path.isAbsolute(relativeRuntimePath);
  const managedPath = resolvedSocketPath === defaultSocketPath || insideRepoRuntimeDir;

  if (!managedPath) {
    throw new Error(`refusing to remove unmanaged broker socket path: ${resolvedSocketPath}`);
  }

  const stat = lstatSync(resolvedSocketPath);
  if (!stat.isSocket()) {
    throw new Error(`refusing to remove non-socket broker path: ${resolvedSocketPath}`);
  }

  unlinkSync(resolvedSocketPath);
}

main().catch((error) => {
  blocked(redactSensitiveText(error?.message || String(error)));
  process.exit(1);
});
