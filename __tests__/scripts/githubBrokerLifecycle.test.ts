import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { getCheckoutKind, getSharedCheckoutRoot } from '@/scripts/lib/env-bootstrap.mjs';
import { githubBrokerSocketPath } from '@/scripts/lib/github-broker-client.mjs';
import {
  GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION,
  GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION,
  GITHUB_BROKER_INSTALL_CONFIRMATION,
  GITHUB_BROKER_TOKEN_OP_REF_KEY,
  buildBrokerLaunchAgentPlist,
  canRebuildKeychainCacheHelper,
  extractCodeSignatureIdentifier,
  findClangCliPath,
  getBrokerServicePaths,
  isStableKeychainHelperIdentifier,
  isSafeServiceAccountTokenOpRef,
} from '@/scripts/lib/github-broker-service.mjs';

const repoRoot = process.cwd();
const tempRoots: string[] = [];

function tempRoot(prefix = 'governada-broker-lifecycle-') {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  tempRoots.push(root);
  return root;
}

function writeRefs(root: string, extra = '') {
  writeFileSync(
    path.join(root, '.env.local.refs'),
    [
      'GOVERNADA_GITHUB_APP_ID=123456',
      'GOVERNADA_GITHUB_APP_INSTALLATION_ID=12345678',
      'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF=op://Governada-Automation/governada-agent-read-pilot/private-key',
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT=2026-05-25T00:00:00Z',
      'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER=2026-05-18T00:00:00Z',
      extra,
    ]
      .filter(Boolean)
      .join('\n'),
    'utf8',
  );
}

function runLifecycle(
  args: string[],
  env: Record<string, string | undefined> = {},
  options: { cwd?: string } = {},
) {
  return spawnSync('node', [path.join(repoRoot, 'scripts/github-broker-lifecycle.mjs'), ...args], {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    env: {
      HOME: tempRoot('governada-test-home-'),
      PATH: process.env.PATH,
      ...env,
      GH_TOKEN: env.GH_TOKEN || '',
      GITHUB_TOKEN: env.GITHUB_TOKEN || '',
      NODE_ENV: 'test',
      OP_CONNECT_HOST: env.OP_CONNECT_HOST || '',
      OP_CONNECT_TOKEN: env.OP_CONNECT_TOKEN || '',
      OP_SERVICE_ACCOUNT_TOKEN: env.OP_SERVICE_ACCOUNT_TOKEN || '',
    },
  });
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github broker lifecycle CLI', () => {
  it('requires explicit confirmation before installing or uninstalling', () => {
    const install = runLifecycle(['install']);
    const uninstall = runLifecycle(['uninstall']);

    expect(install.status).toBe(1);
    expect(install.stderr).toContain(
      `installing the broker service requires --confirm ${GITHUB_BROKER_INSTALL_CONFIRMATION}`,
    );
    expect(uninstall.status).toBe(1);
    expect(uninstall.stderr).toContain('uninstalling the broker service requires --confirm');
  });

  it('requires explicit confirmation before caching or clearing the service-account token cache', () => {
    const cache = runLifecycle(['cache-token']);
    const clear = runLifecycle(['clear-token-cache']);

    expect(cache.status).toBe(1);
    expect(cache.stderr).toContain(
      `caching the broker service-account token requires --confirm ${GITHUB_BROKER_CACHE_TOKEN_CONFIRMATION}`,
    );
    expect(clear.status).toBe(1);
    expect(clear.stderr).toContain(
      `clearing the broker service-account token cache requires --confirm ${GITHUB_BROKER_CLEAR_TOKEN_CACHE_CONFIRMATION}`,
    );
  });

  it('keeps the C helper token-bearing child environments allowlisted', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/github-keychain-cache.c'), 'utf8');

    expect(source).toContain('append_env_entry(child_env');
    expect(source).toContain('secret_env_entry("OP_SERVICE_ACCOUNT_TOKEN"');
    expect(source).toContain('secret_env_entry("GH_TOKEN"');
    expect(source).toContain('strcmp(command, "run-gh")');
    expect(source).toContain('find_gh_path');
    expect(source).not.toContain('child_env[index++] = environ');
    expect(source).not.toContain('NODE_OPTIONS');
    expect(source).not.toContain('DYLD_');
    expect(source).not.toContain('TMPDIR');
    expect(source).not.toContain('GOVERNADA_GITHUB_BROKER_SOCKET');
    expect(source).not.toContain('strcmp(command, "read")');
    expect(source).not.toContain('strcmp(command, "status")');
    expect(source).not.toContain('strcmp(command, "delete")');
    expect(source).toContain('NULL, NULL, &item');
  });

  it('does not expose helper, compiler, or service-root overrides through runtime env', () => {
    const serviceSource = readFileSync(
      path.join(repoRoot, 'scripts/lib/github-broker-service.mjs'),
      'utf8',
    );
    const runnerSource = readFileSync(
      path.join(repoRoot, 'scripts/github-broker-service-runner.mjs'),
      'utf8',
    );

    for (const marker of [
      'GOVERNADA_ALLOW_TEST_OVERRIDES',
      'GOVERNADA_KEYCHAIN_HELPER_PATH',
      'GOVERNADA_KEYCHAIN_HELPER_OUTPUT',
      'GOVERNADA_KEYCHAIN_C_SOURCE',
      'GOVERNADA_CLANG_CLI_PATH',
      'GOVERNADA_GITHUB_BROKER_SERVICE_ROOT',
      'GOVERNADA_GITHUB_BROKER_SOCKET',
      'GOVERNADA_NODE_PATH',
      'GOVERNADA_OP_CLI_PATH',
      'GOVERNADA_TEST_OVERRIDE_TOKEN',
      'TMPDIR',
      'processAncestryIncludesVitest',
      'testOverridesEnabled',
    ]) {
      expect(serviceSource).not.toContain(marker);
    }

    expect(findClangCliPath()).not.toBe('/tmp/should-not-use');
    expect(serviceSource).toContain('if (before.running)');
    expect(serviceSource).toContain('before.repo !== EXPECTED_REPO');
    expect(serviceSource).toContain('removeCanonicalBrokerSocket(before)');
    expect(serviceSource.indexOf('if (before.running)')).toBeLessThan(
      serviceSource.indexOf('removeCanonicalBrokerSocket(before)'),
    );
    expect(serviceSource.indexOf('removeCanonicalBrokerSocket(before)')).toBeLessThan(
      serviceSource.indexOf("runLaunchctl(['bootout'"),
    );
    expect(serviceSource.indexOf("runLaunchctl(['bootout'")).toBeLessThan(
      serviceSource.indexOf("runLaunchctl(['bootstrap'"),
    );
    expect(serviceSource).toContain('spawnSync(LAUNCHCTL_PATH');
    expect(serviceSource).toContain("const SECURITY_PATH = '/usr/bin/security'");
    expect(serviceSource).toContain("'find-generic-password'");
    expect(serviceSource).toContain("'delete-generic-password'");
    expect(serviceSource).not.toContain(
      "['status', GITHUB_BROKER_KEYCHAIN_ACCOUNT, GITHUB_BROKER_KEYCHAIN_SERVICE]",
    );
    expect(serviceSource).not.toContain(
      "['delete', GITHUB_BROKER_KEYCHAIN_ACCOUNT, GITHUB_BROKER_KEYCHAIN_SERVICE]",
    );
    expect(serviceSource).toContain('sanitizedLaunchctlEnv');
    expect(serviceSource).not.toContain("spawnSync('launchctl'");
    expect(runnerSource).not.toContain('...process.env');
    expect(runnerSource).not.toContain('NODE_OPTIONS');
    expect(runnerSource).not.toContain('NODE_PATH');
    expect(runnerSource).not.toContain('TMPDIR');
  });

  it('routes broker response writes through the guarded socket helper', () => {
    const brokerSource = readFileSync(
      path.join(repoRoot, 'scripts/github-runtime-broker.mjs'),
      'utf8',
    );

    expect(brokerSource).toContain('attachBrokerSocketErrorHandler(socket)');
    expect(brokerSource).toContain('sendBrokerSocketResponse({');
    expect(brokerSource).not.toContain('socket.end(`${JSON.stringify(publicResponse)}');
  });

  it('keeps broker startup promptless and timeout-bounded', () => {
    const runnerSource = readFileSync(
      path.join(repoRoot, 'scripts/github-broker-service-runner.mjs'),
      'utf8',
    );
    const serviceSource = readFileSync(
      path.join(repoRoot, 'scripts/lib/github-broker-service.mjs'),
      'utf8',
    );
    const lifecycleSource = readFileSync(
      path.join(repoRoot, 'scripts/github-broker-lifecycle.mjs'),
      'utf8',
    );

    expect(runnerSource).toContain('const helper = ensureKeychainCacheHelper(process.env);');
    expect(runnerSource).not.toContain(
      'ensureKeychainCacheHelper(process.env, { forceBuild: true })',
    );
    expect(runnerSource).toContain('BROKER_HELPER_START_TIMEOUT_MS');
    expect(runnerSource).toContain('GitHub broker Keychain helper did not start the broker');
    expect(runnerSource).toContain('broker startup no longer rebuilds the helper');
    expect(runnerSource).toContain('getGithubBrokerStatus({ repoRoot })');
    expect(runnerSource).toContain("child.kill('SIGTERM')");
    expect(runnerSource).toContain("child.kill('SIGKILL')");
    expect(serviceSource).toContain('human-present setup step to rebuild it before broker start');
    expect(serviceSource).not.toContain('token-bearing cache/start paths will rebuild it');
    expect(serviceSource).toContain('const SERVICE_START_TIMEOUT_MS = 30000');
    expect(serviceSource).toContain('const LAUNCHCTL_TIMEOUT_MS =');
    expect(serviceSource).toContain('timeout: LAUNCHCTL_TIMEOUT_MS');
    expect(serviceSource).toContain('timed out after ${LAUNCHCTL_TIMEOUT_MS}ms');
    expect(serviceSource).toContain(
      'const tempHelperPath = path.join(tempBuildDir, path.basename(helperPath));',
    );
    expect(serviceSource).toContain('github-keychain-cache-build');
    expect(serviceSource).not.toContain('`${helperPath}.${process.pid}.${Date.now()}.tmp`');
    expect(lifecycleSource).toContain(
      'cache-token rebuilds it during the human-present setup step',
    );
    expect(lifecycleSource).not.toContain('service start rebuild it before token-bearing use');
  });

  it('detects unstable Keychain helper signing identities', () => {
    expect(
      extractCodeSignatureIdentifier(
        'Executable=/tmp/github-keychain-cache\nIdentifier=github-keychain-cache\nFormat=Mach-O',
      ),
    ).toBe('github-keychain-cache');
    expect(
      extractCodeSignatureIdentifier(
        'Executable=/tmp/github-keychain-cache.50558.1777311587731.tmp\nIdentifier=github-keychain-cache.50558.1777311587731.tmp\nFormat=Mach-O',
      ),
    ).toBe('github-keychain-cache.50558.1777311587731.tmp');
    expect(isStableKeychainHelperIdentifier('github-keychain-cache')).toBe(true);
    expect(isStableKeychainHelperIdentifier('github-keychain-cache.50558.1777311587731.tmp')).toBe(
      false,
    );
    expect(canRebuildKeychainCacheHelper({ exists: true, ok: false, rebuildable: true })).toBe(
      true,
    );
    expect(canRebuildKeychainCacheHelper({ exists: true, ok: false })).toBe(false);
  });

  it('requires explicit acknowledgement before installing a temporary worktree service', () => {
    if (getCheckoutKind(repoRoot) !== 'worktree') {
      return;
    }

    const root = tempRoot();
    writeRefs(
      root,
      `${GITHUB_BROKER_TOKEN_OP_REF_KEY}=op://Governada-Automation/governada-agent-read-pilot/service-account-token`,
    );

    const result = runLifecycle(
      ['install', '--confirm', GITHUB_BROKER_INSTALL_CONFIRMATION],
      {},
      { cwd: root },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'durable broker service install must run from the shared checkout',
    );
    expect(result.stderr).toContain('--temporary-worktree-proof');
  });

  it('builds a LaunchAgent plist without token material or op references', () => {
    const plist = buildBrokerLaunchAgentPlist({
      env: {
        NODE_ENV: 'test',
        OP_SERVICE_ACCOUNT_TOKEN: 'ops_should-not-print',
      },
      nodePath: '/opt/homebrew/bin/node',
      repoRoot,
    });

    expect(plist).toContain('io.governada.github-broker');
    expect(plist).toContain('github-broker-service-runner.mjs');
    expect(plist).not.toContain('ops_should-not-print');
    expect(plist).not.toContain('OP_SERVICE_ACCOUNT_TOKEN');
    expect(plist).not.toContain('op://');
  });

  it('uses the real user LaunchAgent directory instead of caller-provided HOME', () => {
    const paths = getBrokerServicePaths(repoRoot, {
      HOME: tempRoot('governada-fake-home-'),
      NODE_ENV: 'test',
    });

    expect(paths.launchAgentsDir).toBe(path.join(homedir(), 'Library', 'LaunchAgents'));
  });

  it('strictly validates service-account token op references', () => {
    expect(
      isSafeServiceAccountTokenOpRef(
        'op://Governada-Automation/governada-agent-read-pilot/service-account-token',
      ),
    ).toBe(true);
    expect(isSafeServiceAccountTokenOpRef('ops_should-not-print')).toBe(false);
    expect(
      isSafeServiceAccountTokenOpRef("op://vault/item/field'; echo ops_should-not-print #"),
    ).toBe(false);
    expect(isSafeServiceAccountTokenOpRef('op://vault/item/field ops_should-not-print')).toBe(
      false,
    );
  });

  it('uses the same default broker socket from worktrees and the shared checkout', () => {
    if (getCheckoutKind(repoRoot) !== 'worktree') {
      return;
    }

    const sharedRoot = getSharedCheckoutRoot(repoRoot);

    expect(sharedRoot).toBeTruthy();
    expect(githubBrokerSocketPath(repoRoot, { NODE_ENV: 'test' })).toBe(
      githubBrokerSocketPath(sharedRoot, { NODE_ENV: 'test' }),
    );
  });
});
