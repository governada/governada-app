import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  findFirstExisting,
  getEnvRefsCandidates,
  getSharedCheckoutRoot,
  parseEnvEntries,
} from './env-bootstrap.mjs';
import { EXPECTED_REPO, redactSensitiveText } from './github-app-auth.mjs';
import { callGithubBroker, githubBrokerSocketPath } from './github-broker-client.mjs';

export const GITHUB_BROKER_SERVICE_LABEL = 'io.governada.github-broker';
export const GITHUB_BROKER_TOKEN_OP_REF_KEY = 'GOVERNADA_OP_SERVICE_ACCOUNT_TOKEN_OP_REF';
export const GITHUB_BROKER_INSTALL_CONFIRMATION = 'github.runtime.install';
export const GITHUB_BROKER_UNINSTALL_CONFIRMATION = 'github.runtime.uninstall';
export const GITHUB_BROKER_STOP_CONFIRMATION = 'github.runtime.stop';
export const GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION = 'github.runtime.cache-token';
export const GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION = 'github.runtime.clear-token-cache';
export const GITHUB_BROKER_KEYCHAIN_SERVICE = 'io.governada.github-broker.service-account-token';
export const GITHUB_BROKER_KEYCHAIN_ACCOUNT = 'governada/app';
export const GITHUB_BROKER_KEYCHAIN_LABEL =
  'Governada GitHub broker service-account token runtime cache';
export const EXPECTED_OP_ACCOUNT = 'my.1password.com';

const SERVICE_START_TIMEOUT_MS = 30000;
const SERVICE_ENSURE_LOCK_WAIT_MS = 30000;
const SERVICE_ENSURE_LOCK_STALE_MS = 120000;
const LAUNCHCTL_TIMEOUT_MS = 15000;
const FIXED_RUNTIME_PATH = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
const LAUNCHCTL_PATH = '/bin/launchctl';
const SECURITY_PATH = '/usr/bin/security';
const BROKER_METADATA_ENV_KEYS = Object.freeze([
  'GOVERNADA_GITHUB_APP_ID',
  'GOVERNADA_GITHUB_APP_INSTALLATION_ID',
  'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF',
  'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT',
  'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER',
]);
const BASIC_HELPER_ENV_KEYS = Object.freeze(['HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL']);

function sanitizedCompilerEnv(env = process.env) {
  return sanitizedEnvFromKeys(env, BASIC_HELPER_ENV_KEYS);
}

function sanitizedHelperEnv(env = process.env) {
  return sanitizedEnvFromKeys(env, [...BASIC_HELPER_ENV_KEYS, ...BROKER_METADATA_ENV_KEYS]);
}

function sanitizedKeychainCliEnv(env = process.env) {
  return sanitizedEnvFromKeys(env, BASIC_HELPER_ENV_KEYS);
}

function sanitizedEnvFromKeys(env, keys) {
  const safeEnv = {
    PATH: FIXED_RUNTIME_PATH,
  };

  for (const key of keys) {
    if (env[key]) {
      safeEnv[key] = env[key];
    }
  }

  if (!safeEnv.HOME) {
    safeEnv.HOME = homedir();
  }

  return safeEnv;
}

export function isSafeServiceAccountTokenOpRef(value) {
  return /^op:\/\/[^/\s'";`$\\]+\/[^/\s'";`$\\]+\/[^/\s'";`$\\]+$/u.test(value);
}

export function readGithubBrokerRefs(repoRoot, cwd = process.cwd()) {
  const refsPath = findFirstExisting(getEnvRefsCandidates(repoRoot, cwd));
  if (!refsPath) {
    return {
      refs: {},
      refsPath: '',
    };
  }

  return {
    refs: Object.fromEntries(parseEnvEntries(refsPath).map((entry) => [entry.key, entry.value])),
    refsPath,
  };
}

export function resolveServiceAccountTokenOpRef({
  cwd = process.cwd(),
  env = process.env,
  repoRoot,
}) {
  if (env[GITHUB_BROKER_TOKEN_OP_REF_KEY]) {
    return env[GITHUB_BROKER_TOKEN_OP_REF_KEY];
  }

  return readGithubBrokerRefs(repoRoot, cwd).refs[GITHUB_BROKER_TOKEN_OP_REF_KEY] || '';
}

export function getBrokerServicePaths(repoRoot, _env = process.env) {
  const home = homedir();
  const launchAgentsDir = path.join(home, 'Library', 'LaunchAgents');
  const runtimeDir = path.join(repoRoot, '.agents', 'runtime');

  return {
    brokerScriptPath: path.join(repoRoot, 'scripts', 'github-runtime-broker.mjs'),
    launchAgentsDir,
    launcherScriptPath: path.join(repoRoot, 'scripts', 'github-broker-service-runner.mjs'),
    label: GITHUB_BROKER_SERVICE_LABEL,
    plistPath: path.join(launchAgentsDir, `${GITHUB_BROKER_SERVICE_LABEL}.plist`),
    repoRoot,
    runtimeDir,
    stderrPath: path.join(runtimeDir, 'github-broker-service.err.log'),
    stdoutPath: path.join(runtimeDir, 'github-broker-service.out.log'),
  };
}

export function getLaunchctlDomain(env = process.env) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : env.UID;
  if (!uid && uid !== 0) {
    throw new Error('unable to determine current user id for launchctl domain');
  }

  return `gui/${uid}`;
}

export function getLaunchctlTarget(env = process.env) {
  return `${getLaunchctlDomain(env)}/${GITHUB_BROKER_SERVICE_LABEL}`;
}

export function buildBrokerLaunchAgentPlist({
  env = process.env,
  nodePath = '/opt/homebrew/bin/node',
  repoRoot,
}) {
  const paths = getBrokerServicePaths(repoRoot, env);
  const args = [nodePath, paths.launcherScriptPath, '--repo-root', repoRoot];

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(GITHUB_BROKER_SERVICE_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
${args.map((arg) => `    <string>${xmlEscape(arg)}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key>
  <false/>
  <key>KeepAlive</key>
  <false/>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(repoRoot)}</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(paths.stdoutPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(paths.stderrPath)}</string>
</dict>
</plist>
`;
}

export function writeBrokerServicePlist({ env = process.env, nodePath, repoRoot }) {
  const paths = getBrokerServicePaths(repoRoot, env);
  mkdirSync(paths.launchAgentsDir, { mode: 0o700, recursive: true });
  mkdirSync(paths.runtimeDir, { mode: 0o700, recursive: true });
  const contents = buildBrokerLaunchAgentPlist({ env, nodePath, repoRoot });
  writeFileSync(paths.plistPath, contents, { encoding: 'utf8', mode: 0o600 });
  chmodSync(paths.plistPath, 0o600);
  return {
    contents,
    paths,
  };
}

export function findNodeForBrokerService() {
  const candidates = ['/opt/homebrew/bin/node', '/usr/local/bin/node', process.execPath].filter(
    Boolean,
  );

  return candidates.find((candidate) => existsSync(candidate)) || process.execPath;
}

export function findOpCliPath() {
  const candidates = ['/opt/homebrew/bin/op', '/usr/local/bin/op', '/usr/bin/op'];

  return candidates.find((candidate) => existsSync(candidate)) || '';
}

export function findClangCliPath() {
  const candidates = ['/usr/bin/clang', '/usr/local/bin/clang'];

  return candidates.find((candidate) => existsSync(candidate)) || '';
}

export function findCodeSignCliPath() {
  const candidates = ['/usr/bin/codesign'];

  return candidates.find((candidate) => existsSync(candidate)) || '';
}

export function getKeychainCacheCSourcePath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'github-keychain-cache.c',
  );
}

export function getKeychainCacheHelperPath() {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '.agents',
    'runtime',
    'github-keychain-cache',
  );
}

export function extractCodeSignatureIdentifier(output = '') {
  const match = output.match(/^Identifier=(.+)$/mu);
  return match?.[1]?.trim() || '';
}

export function isStableKeychainHelperIdentifier(identifier = '') {
  return identifier === path.basename(getKeychainCacheHelperPath());
}

export function canRebuildKeychainCacheHelper(status = {}) {
  return status.exists === false || Boolean(status.ok) || Boolean(status.rebuildable);
}

function inspectHelperCodeSignatureIdentifier(helperPath, env = process.env) {
  const codesignPath = findCodeSignCliPath();
  if (!codesignPath) {
    return {
      identifier: '',
      ok: true,
      skipped: true,
    };
  }

  const result = spawnSync(codesignPath, ['-dv', '--verbose=4', helperPath], {
    encoding: 'utf8',
    env: sanitizedCompilerEnv(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });

  if (result.status !== 0) {
    const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
    return {
      error: output || `codesign helper inspection failed with status ${result.status}`,
      identifier: '',
      ok: false,
    };
  }

  const identifier = extractCodeSignatureIdentifier(`${result.stdout || ''}${result.stderr || ''}`);
  if (!identifier) {
    return {
      error: 'codesign helper inspection did not report an executable identifier',
      identifier: '',
      ok: false,
    };
  }

  return {
    identifier,
    ok: true,
  };
}

export function ensureKeychainCacheHelper(env = process.env, { forceBuild = false } = {}) {
  const helperPath = getKeychainCacheHelperPath(env);
  const sourcePath = getKeychainCacheCSourcePath(env);
  const inspection = inspectKeychainCacheHelper(env);
  if (!existsSync(sourcePath)) {
    return {
      error: `Keychain cache C helper source is missing at ${sourcePath}`,
      ok: false,
      path: helperPath,
    };
  }

  if (!forceBuild) {
    if (inspection.ok && !inspection.stale) {
      return {
        built: false,
        ok: true,
        path: helperPath,
      };
    }

    return {
      error:
        inspection.error ||
        (inspection.stale
          ? `Keychain cache helper is older than its source at ${sourcePath}; run npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION} once as a human-present setup step to rebuild it before broker start`
          : `Keychain cache helper is not built at ${helperPath}`),
      ok: false,
      path: helperPath,
      stale: Boolean(inspection.stale),
    };
  }

  const clangPath = findClangCliPath(env);
  if (!clangPath) {
    return {
      error: 'clang is missing; cannot build Keychain cache helper',
      ok: false,
      path: helperPath,
    };
  }

  const helperStatus = inspection;
  if (!canRebuildKeychainCacheHelper(helperStatus)) {
    return {
      error: helperStatus.error,
      ok: false,
      path: helperPath,
    };
  }

  const helperDir = path.dirname(helperPath);
  mkdirSync(helperDir, { mode: 0o700, recursive: true });
  const tempBuildDir = path.join(
    helperDir,
    `.github-keychain-cache-build-${process.pid}-${Date.now()}`,
  );
  mkdirSync(tempBuildDir, { mode: 0o700 });
  const tempHelperPath = path.join(tempBuildDir, path.basename(helperPath));
  const brokerScriptPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'github-runtime-broker.mjs',
  );
  const result = spawnSync(
    clangPath,
    [
      sourcePath,
      '-Wno-deprecated-declarations',
      `-DGOVERNADA_HELPER_PATH=${JSON.stringify(helperPath)}`,
      `-DGOVERNADA_BROKER_SCRIPT_PATH=${JSON.stringify(brokerScriptPath)}`,
      '-framework',
      'Security',
      '-framework',
      'CoreFoundation',
      '-o',
      tempHelperPath,
    ],
    {
      encoding: 'utf8',
      env: sanitizedCompilerEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  if (result.status !== 0) {
    const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
    rmSync(tempBuildDir, { force: true, recursive: true });
    return {
      error: output || `Keychain cache helper compile failed with status ${result.status}`,
      ok: false,
      path: helperPath,
    };
  }

  try {
    chmodSync(tempHelperPath, 0o700);
    renameSync(tempHelperPath, helperPath);
  } finally {
    rmSync(tempBuildDir, { force: true, recursive: true });
  }
  return {
    built: true,
    ok: true,
    path: helperPath,
  };
}

export function inspectKeychainCacheHelper(env = process.env) {
  const helperPath = getKeychainCacheHelperPath(env);
  const sourcePath = getKeychainCacheCSourcePath(env);
  if (!existsSync(sourcePath)) {
    return {
      error: `Keychain cache C helper source is missing at ${sourcePath}`,
      exists: false,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  const helperStatus = existingKeychainHelperStatus(helperPath);
  if (!helperStatus.exists) {
    return {
      error: `Keychain cache helper has not been built at ${helperPath}`,
      exists: false,
      ok: false,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  if (!helperStatus.ok) {
    return {
      ...helperStatus,
      path: helperPath,
      sourcePath,
      stale: false,
    };
  }

  const sourceStat = statSync(sourcePath);
  const stale = helperStatus.mtimeMs < sourceStat.mtimeMs;
  return {
    exists: true,
    mtimeMs: helperStatus.mtimeMs,
    ok: true,
    path: helperPath,
    sourcePath,
    stale,
  };
}

function existingKeychainHelperStatus(helperPath) {
  if (!existsSync(helperPath)) {
    return {
      exists: false,
      mtimeMs: 0,
      ok: false,
    };
  }

  const stat = lstatSync(helperPath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return {
      error: `Keychain cache helper must be a regular file, not a symlink or special file: ${helperPath}`,
      exists: true,
      mtimeMs: stat.mtimeMs,
      ok: false,
    };
  }

  if ((stat.mode & 0o077) !== 0) {
    return {
      error: `Keychain cache helper permissions must not grant group/other access: ${helperPath}`,
      exists: true,
      mtimeMs: stat.mtimeMs,
      ok: false,
    };
  }

  const signature = inspectHelperCodeSignatureIdentifier(helperPath);
  if (!signature.ok) {
    return {
      error: signature.error,
      exists: true,
      mtimeMs: stat.mtimeMs,
      ok: false,
    };
  }

  if (signature.identifier && !isStableKeychainHelperIdentifier(signature.identifier)) {
    return {
      error: `Keychain cache helper was built with unstable signing identifier ${signature.identifier}; run npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION} once as a human-present setup step to rebuild it with the stable github-keychain-cache identity`,
      exists: true,
      mtimeMs: stat.mtimeMs,
      ok: false,
      rebuildable: true,
      signatureIdentifier: signature.identifier,
    };
  }

  return {
    exists: true,
    mtimeMs: stat.mtimeMs,
    ok: true,
    signatureIdentifier: signature.identifier,
    signatureSkipped: Boolean(signature.skipped),
  };
}

export function isBrokerServiceInstalled(repoRoot, env = process.env) {
  return existsSync(getBrokerServicePaths(repoRoot, env).plistPath);
}

export async function getGithubBrokerStatus({ env = process.env, repoRoot, timeoutMs = 3000 }) {
  const socketPath = githubBrokerSocketPath(repoRoot, env);
  if (!existsSync(socketPath)) {
    return {
      running: false,
      socketExists: false,
      socketPath,
    };
  }

  try {
    const response = await callGithubBroker({
      env,
      repoRoot,
      request: { kind: 'status' },
      timeoutMs,
    });

    return {
      error: response?.error || '',
      repo: response?.repo || '',
      running: Boolean(response?.ok),
      socketExists: true,
      socketPath,
      supportedOperationClasses: response?.supportedOperationClasses || [],
    };
  } catch (error) {
    return {
      error: redactSensitiveText(error?.message || String(error)),
      running: false,
      socketExists: true,
      socketPath,
    };
  }
}

export async function waitForGithubBroker({
  env = process.env,
  repoRoot,
  timeoutMs = SERVICE_START_TIMEOUT_MS,
}) {
  const startedAt = Date.now();
  let status = await getGithubBrokerStatus({ env, repoRoot });

  while (!status.running && Date.now() - startedAt < timeoutMs) {
    await sleep(250);
    status = await getGithubBrokerStatus({ env, repoRoot });
  }

  return status;
}

export async function ensureGithubBrokerRunning({ env = process.env, repoRoot }) {
  const releaseLock = await acquireBrokerEnsureLock({ env, repoRoot });
  try {
    return await ensureGithubBrokerRunningUnlocked({ env, repoRoot });
  } finally {
    releaseLock();
  }
}

async function ensureGithubBrokerRunningUnlocked({ env = process.env, repoRoot }) {
  const before = await getGithubBrokerStatus({ env, repoRoot });
  const paths = getBrokerServicePaths(repoRoot, env);
  if (!existsSync(paths.plistPath)) {
    return {
      blockers: [
        `GitHub broker service is not installed at ${paths.plistPath}; run npm run github:broker -- install --confirm ${GITHUB_BROKER_INSTALL_CONFIRMATION} once with human approval`,
      ],
      ok: false,
      status: before,
    };
  }

  const validation = validateBrokerServicePlist({ env, repoRoot });
  if (!validation.ok) {
    return {
      blockers: validation.blockers,
      ok: false,
      status: before,
    };
  }

  const tokenCache = getGithubBrokerTokenCacheStatus(env);
  if (tokenCache.error) {
    return {
      blockers: [
        `GitHub broker service-account token runtime cache could not be inspected: ${tokenCache.error}`,
      ],
      ok: false,
      status: before,
    };
  }
  const advisories = tokenCache.present
    ? []
    : [
        `GitHub broker service-account token runtime cache is not visible to this process; LaunchAgent start will prove whether the cache exists, and missing-cache failures require npm run github:broker -- cache-token --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION}`,
      ];

  if (before.running) {
    if (before.repo !== EXPECTED_REPO) {
      return {
        blockers: [
          `GitHub broker is running for ${before.repo || 'unknown repo'}, expected ${EXPECTED_REPO}; stop/reinstall the broker before using this repo`,
        ],
        ok: false,
        status: before,
      };
    }

    return {
      advisories,
      ok: true,
      started: false,
      status: before,
    };
  }

  removeCanonicalBrokerSocket(before);

  const bootout = runLaunchctl(['bootout', getLaunchctlTarget(env)], { env });
  if (!bootout.ok && !isExpectedLaunchctlBootoutMiss(bootout.output)) {
    return {
      blockers: [`GitHub broker service bootout failed before vetted bootstrap: ${bootout.output}`],
      ok: false,
      status: before,
    };
  }

  const bootstrap = await runLaunchctlBootstrapWithRetry({ env, plistPath: paths.plistPath });
  if (!bootstrap.ok) {
    return {
      blockers: [`GitHub broker service bootstrap failed: ${bootstrap.output}`],
      ok: false,
      status: before,
    };
  }

  const kickstart = runLaunchctl(['kickstart', '-k', getLaunchctlTarget(env)], { env });
  if (!kickstart.ok) {
    return {
      blockers: [`GitHub broker service start failed: ${kickstart.output}`],
      ok: false,
      status: before,
    };
  }

  const after = await waitForGithubBroker({ env, repoRoot });
  if (!after.running) {
    return {
      blockers: [
        [
          `GitHub broker service was started but broker did not become healthy at ${after.socketPath}; inspect ${paths.stderrPath}`,
          ...advisories,
        ].join(' '),
      ],
      ok: false,
      started: true,
      status: after,
    };
  }

  return {
    advisories,
    ok: true,
    started: true,
    status: after,
  };
}

async function acquireBrokerEnsureLock({ env = process.env, repoRoot }) {
  const lockDir = path.join(
    path.dirname(githubBrokerSocketPath(repoRoot, env)),
    'github-broker.ensure.lock',
  );
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVICE_ENSURE_LOCK_WAIT_MS) {
    try {
      mkdirSync(lockDir, { mode: 0o700, recursive: false });
      return () => {
        rmSync(lockDir, { force: true, recursive: true });
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      if (isStaleBrokerEnsureLock(lockDir)) {
        rmSync(lockDir, { force: true, recursive: true });
        continue;
      }

      await sleep(250);
    }
  }

  throw new Error(`timed out waiting for GitHub broker ensure lock at ${lockDir}`);
}

function isStaleBrokerEnsureLock(lockDir) {
  try {
    return Date.now() - statSync(lockDir).mtimeMs > SERVICE_ENSURE_LOCK_STALE_MS;
  } catch {
    return true;
  }
}

async function runLaunchctlBootstrapWithRetry({ env, plistPath }) {
  let result = runLaunchctl(['bootstrap', getLaunchctlDomain(env), plistPath], { env });
  for (
    let attempt = 0;
    !result.ok && isLaunchctlBootstrapRace(result.output) && attempt < 3;
    attempt += 1
  ) {
    await sleep(500 * (attempt + 1));
    result = runLaunchctl(['bootstrap', getLaunchctlDomain(env), plistPath], { env });
  }
  return result;
}

function isExpectedLaunchctlBootoutMiss(output) {
  return /Could not find specified service|No such process|service is not loaded|unknown service|Bootstrap failed: 113/iu.test(
    output || '',
  );
}

function isLaunchctlBootstrapRace(output) {
  return /Bootstrap failed: 5|Input\/output error/iu.test(output || '');
}

function removeCanonicalBrokerSocket(status) {
  if (!status.socketExists || !status.socketPath) {
    return;
  }

  try {
    const socketStat = lstatSync(status.socketPath);
    if (!socketStat.isDirectory()) {
      unlinkSync(status.socketPath);
    }
  } catch {
    // If the service already cleaned up the socket, kickstart can proceed.
  }
}

export function getGithubBrokerTokenCacheStatus(env = process.env) {
  if (!existsSync(SECURITY_PATH)) {
    return {
      error: `macOS security CLI is missing at ${SECURITY_PATH}`,
      present: false,
    };
  }

  const result = spawnSync(
    SECURITY_PATH,
    [
      'find-generic-password',
      '-a',
      GITHUB_BROKER_KEYCHAIN_ACCOUNT,
      '-s',
      GITHUB_BROKER_KEYCHAIN_SERVICE,
    ],
    {
      encoding: 'utf8',
      env: sanitizedKeychainCliEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  if (result.status === 0) {
    return {
      present: true,
    };
  }

  const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
  if (isKeychainItemMissing(output, result.status)) {
    return {
      present: false,
    };
  }

  return {
    error: output || `macOS security keychain status exited with status ${result.status}`,
    present: false,
  };
}

export function readServiceAccountTokenFrom1Password({
  env = process.env,
  opPath = findOpCliPath(env),
  timeoutMs = 60000,
  tokenOpRef,
}) {
  if (!opPath) {
    return {
      error: '1Password CLI was not found',
      ok: false,
      token: '',
    };
  }

  const result = spawnSync(
    opPath,
    ['read', tokenOpRef, '--account', EXPECTED_OP_ACCOUNT, '--no-newline', '--force'],
    {
      encoding: 'utf8',
      env: {
        ...env,
        OP_ACCOUNT: EXPECTED_OP_ACCOUNT,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    },
  );

  if (result.status !== 0) {
    const output = redactSensitiveText(
      [
        result.error?.message,
        result.signal ? `signal=${result.signal}` : '',
        result.status === null ? 'status=null' : `status=${result.status}`,
        result.stdout || '',
        result.stderr || '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim(),
    );
    const fieldHint = /does not have a field/iu.test(output)
      ? `\nCheck that ${GITHUB_BROKER_TOKEN_OP_REF_KEY} points to the exact 1Password field label for the service-account token, or rename the field to service-account-token.`
      : '';
    return {
      error:
        `${output}${fieldHint}` ||
        '1Password service-account token read failed; unlock/approve 1Password and retry',
      ok: false,
      token: '',
    };
  }

  const token = result.stdout || '';
  if (!token.trim()) {
    return {
      error: '1Password returned an empty service-account token',
      ok: false,
      token: '',
    };
  }

  return {
    ok: true,
    token,
  };
}

export function writeGithubBrokerTokenKeychainCache({ env = process.env, token }) {
  const helper = ensureKeychainCacheHelper(env, { forceBuild: true });
  if (!helper.ok) {
    return {
      error: helper.error,
      ok: false,
    };
  }

  if (!token?.trim()) {
    return {
      error: 'refusing to cache an empty service-account token',
      ok: false,
    };
  }

  const result = spawnSync(
    helper.path,
    [
      'write',
      GITHUB_BROKER_KEYCHAIN_ACCOUNT,
      GITHUB_BROKER_KEYCHAIN_SERVICE,
      GITHUB_BROKER_KEYCHAIN_LABEL,
      'Governada GitHub broker runtime cache; source of truth is 1Password.',
    ],
    {
      encoding: 'utf8',
      env: sanitizedHelperEnv(env),
      input: `${token}\n`,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  if (result.status !== 0) {
    const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
    return {
      error: output || `Keychain write helper exited with status ${result.status}`,
      ok: false,
    };
  }

  return {
    ok: true,
  };
}

export function deleteGithubBrokerTokenKeychainCache(env = process.env) {
  const before = getGithubBrokerTokenCacheStatus(env);
  if (before.error) {
    return {
      error: before.error,
      ok: false,
    };
  }

  const result = spawnSync(
    SECURITY_PATH,
    [
      'delete-generic-password',
      '-a',
      GITHUB_BROKER_KEYCHAIN_ACCOUNT,
      '-s',
      GITHUB_BROKER_KEYCHAIN_SERVICE,
    ],
    {
      encoding: 'utf8',
      env: sanitizedKeychainCliEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    },
  );

  const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
  if (result.status === 0) {
    return {
      ok: true,
      removed: before.present,
    };
  }

  if (isKeychainItemMissing(output, result.status)) {
    return {
      ok: true,
      removed: false,
    };
  }

  return {
    error: output || `macOS security keychain delete exited with status ${result.status}`,
    ok: false,
  };
}

function isKeychainItemMissing(output, status) {
  return (
    status === 44 ||
    /could not be found|The specified item could not be found|SecKeychainSearchCopyNext/iu.test(
      output || '',
    )
  );
}

export function validateBrokerServicePlist({ env = process.env, repoRoot }) {
  const paths = getBrokerServicePaths(repoRoot, env);
  if (!existsSync(paths.plistPath)) {
    return {
      blockers: [`GitHub broker service plist is missing at ${paths.plistPath}`],
      ok: false,
    };
  }

  const actual = readFileSync(paths.plistPath, 'utf8');
  const nodePath = findNodeForBrokerService(env);
  const expected = expectedBrokerServicePlists({ env, nodePath, repoRoot });
  if (expected.includes(actual)) {
    return { ok: true };
  }

  return {
    blockers: [
      `GitHub broker service plist at ${paths.plistPath} does not match the expected Governada broker service definition; reinstall with npm run github:broker -- install --confirm ${GITHUB_BROKER_INSTALL_CONFIRMATION}`,
    ],
    ok: false,
  };
}

function expectedBrokerServicePlists({ env, nodePath, repoRoot }) {
  const roots = [repoRoot];
  const sharedRoot = safeSharedCheckoutRoot(repoRoot);
  if (sharedRoot && sharedRoot !== repoRoot) {
    roots.push(sharedRoot);
  }

  return roots.map((root) => buildBrokerLaunchAgentPlist({ env, nodePath, repoRoot: root }));
}

export function runLaunchctl(args, { allowAlreadyBootstrapped = false, env = process.env } = {}) {
  const result = spawnSync(LAUNCHCTL_PATH, args, {
    encoding: 'utf8',
    env: sanitizedLaunchctlEnv(env),
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: LAUNCHCTL_TIMEOUT_MS,
  });
  const output = redactSensitiveText(`${result.stdout || ''}${result.stderr || ''}`.trim());
  if (result.error) {
    return {
      ok: false,
      output:
        output ||
        (result.error.code === 'ETIMEDOUT'
          ? `launchctl ${args.join(' ')} timed out after ${LAUNCHCTL_TIMEOUT_MS}ms; broker service may be waiting on macOS login, LaunchAgent, or Keychain state`
          : `launchctl ${args.join(' ')} failed: ${result.error.message}`),
    };
  }

  if (result.status === 0) {
    return { ok: true, output };
  }

  if (
    allowAlreadyBootstrapped &&
    /already exists|already bootstrapped|Bootstrap failed: 5|Input\/output error/iu.test(output)
  ) {
    return { ok: true, output };
  }

  return {
    ok: false,
    output: output || `launchctl exited with status ${result.status}`,
  };
}

function sanitizedLaunchctlEnv(env = process.env) {
  const username = safeUsername();
  return {
    HOME: homedir(),
    LANG: env.LANG || 'C',
    LC_ALL: env.LC_ALL || '',
    LOGNAME: username,
    PATH: FIXED_RUNTIME_PATH,
    USER: username,
  };
}

function safeUsername() {
  try {
    return userInfo().username || '';
  } catch {
    return '';
  }
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeSharedCheckoutRoot(repoRoot) {
  try {
    return getSharedCheckoutRoot(repoRoot);
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
