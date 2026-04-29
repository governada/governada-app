import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  findEnvLocalKeyDefinitions,
  forbiddenLiteralEntries,
  getForbiddenGithubReferenceKeys,
  parseEnvEntries,
} from '@/scripts/lib/env-bootstrap.mjs';

const require = createRequire(import.meta.url);
const { withGhTokenFromOnePassword } = require(path.join(process.cwd(), 'scripts/lib/gh-auth.js'));

const repoRoot = process.cwd();
const tempPaths: string[] = [];

function createTempDir(prefix = 'governada-env-bootstrap-') {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  tempPaths.push(dir);
  return dir;
}

function createRepoTempDir(prefix = '.tmp-env-bootstrap-') {
  const dir = mkdtempSync(path.join(repoRoot, prefix));
  tempPaths.push(dir);
  return dir;
}

afterEach(() => {
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) {
      rmSync(dir, { force: true, recursive: true });
    }
  }
});

describe('env bootstrap guardrails', () => {
  it('detects GitHub token reference keys in .env.local.refs', () => {
    const dir = createTempDir();
    const refsPath = path.join(dir, '.env.local.refs');
    writeFileSync(
      refsPath,
      [
        'GH_TOKEN_OP_REF=op://Governada/item/token',
        'GITHUB_TOKEN_OP_REF=op://x/y/z',
        'OP_SERVICE_ACCOUNT_TOKEN=op://x/y/service-account-token',
      ].join('\n'),
    );

    expect(getForbiddenGithubReferenceKeys(refsPath)).toEqual([
      'GH_TOKEN_OP_REF',
      'GITHUB_TOKEN_OP_REF',
      'OP_SERVICE_ACCOUNT_TOKEN',
    ]);
  });

  it('blocks non-allowlisted literal values while allowing op refs and public literals', () => {
    const dir = createTempDir();
    const refsPath = path.join(dir, '.env.local.refs');
    writeFileSync(
      refsPath,
      [
        'NODE_ENV=development',
        'NEXT_PUBLIC_SITE_URL=https://governada.local',
        'DATABASE_URL=postgres://example',
        'KOIOS_API_KEY=op://Governada/item/koios',
      ].join('\n'),
    );

    expect(forbiddenLiteralEntries(parseEnvEntries(refsPath))).toEqual([
      { key: 'DATABASE_URL', value: 'postgres://example' },
    ]);
  });

  it('allows non-secret GitHub App ids while keeping autonomous secrets as op refs', () => {
    const dir = createTempDir();
    const refsPath = path.join(dir, '.env.local.refs');
    writeFileSync(
      refsPath,
      [
        'GOVERNADA_GITHUB_APP_ID=12345',
        'GOVERNADA_GITHUB_APP_INSTALLATION_ID=67890',
        'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT=2026-05-25T00:00:00Z',
        'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER=2026-05-18T00:00:00Z',
        'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF=op://Governada-Automation/app/private-key',
      ].join('\n'),
    );

    expect(forbiddenLiteralEntries(parseEnvEntries(refsPath))).toEqual([]);
    expect(getForbiddenGithubReferenceKeys(refsPath)).toEqual([]);
  });

  it('rejects raw GitHub token env in repo GitHub wrappers', () => {
    const result = withGhTokenFromOnePassword({ GH_TOKEN: 'dummy-token' }, repoRoot);

    expect(result.error).toContain('raw GH_TOKEN env is not allowed');
    expect(result.env.GH_TOKEN).toBeUndefined();
  });

  it('uses non-interactive op reads and process-local cache for repo GitHub tokens', () => {
    const authSource = readFileSync(path.join(repoRoot, 'scripts/lib/gh-auth.js'), 'utf8');
    const doctorSource = readFileSync(path.join(repoRoot, 'scripts/auth-doctor.js'), 'utf8');

    expect(authSource).toContain("['read', tokenRef, '--no-newline', '--force']");
    expect(authSource).toContain('let onePasswordTokenCache = null');
    expect(authSource).toContain('onePasswordTokenCache = { token, tokenRef }');
    expect(authSource).not.toContain('writeFileSync(token');
    expect(doctorSource).toContain("['read', tokenRef, '--no-newline', '--force']");
  });

  it('prefers the human GitHub token Keychain cache before direct 1Password reads', () => {
    const cjsRuntime = readFileSync(path.join(repoRoot, 'scripts/lib/runtime.js'), 'utf8');
    const esmRuntime = readFileSync(path.join(repoRoot, 'scripts/lib/runtime.mjs'), 'utf8');
    const cacheCli = readFileSync(path.join(repoRoot, 'scripts/gh-token-cache.mjs'), 'utf8');
    const cacheLib = readFileSync(path.join(repoRoot, 'scripts/lib/gh-token-cache.js'), 'utf8');
    const packageJson = readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

    expect(packageJson).toContain('"gh:token-cache": "node scripts/gh-token-cache.mjs"');
    expect(cjsRuntime).toContain('runGhWithCachedToken(args');
    expect(esmRuntime).toContain('runGhWithCachedToken(args');
    expect(cjsRuntime.indexOf('runGhWithCachedToken(args')).toBeLessThan(
      cjsRuntime.indexOf('withGhTokenFromOnePassword('),
    );
    expect(esmRuntime.indexOf('runGhWithCachedToken(args')).toBeLessThan(
      esmRuntime.indexOf('withGhTokenFromOnePassword('),
    );
    expect(cacheCli).toContain('--confirm ${HUMAN_GITHUB_TOKEN_CACHE_CONFIRMATION}');
    expect(cacheCli).toContain(
      "['read', tokenRef, '--account', EXPECTED_OP_ACCOUNT, '--no-newline', '--force']",
    );
    expect(cacheLib).toContain("'find-generic-password'");
    expect(cacheLib).not.toContain("'-w'");
    expect(cacheCli).not.toContain('console.log(token');
    expect(cacheCli).not.toContain('console.error(token');
  });

  it('strips inherited raw GitHub tokens from env:run child commands', () => {
    const cwd = createRepoTempDir();
    const fakeBin = createTempDir('governada-env-bootstrap-bin-');
    writeFileSync(path.join(cwd, '.env.local'), 'NODE_ENV=test\n');
    writeFileSync(path.join(cwd, '.env.local.refs'), 'NODE_ENV=test\n');
    writeFileSync(
      path.join(fakeBin, 'op'),
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "2.34.0"; exit 0; fi\nexit 1\n',
      { mode: 0o755 },
    );

    const result = spawnSync(
      'node',
      [
        path.join(repoRoot, 'scripts/env-run.mjs'),
        'node',
        '-e',
        "process.stdout.write(process.env.GH_TOKEN ? 'raw-token-present' : 'raw-token-stripped')",
      ],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          GH_TOKEN: 'dummy-token',
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH || ''}`,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('raw-token-stripped');
  });

  it('blocks local .env.local fallback when it contains a raw GitHub token', () => {
    const cwd = createRepoTempDir();
    writeFileSync(path.join(cwd, '.env.local'), 'GH_TOKEN=dummy-token\n');

    const result = spawnSync(
      'node',
      [path.join(repoRoot, 'scripts/env-run.mjs'), 'node', '-e', "console.log('should-not-run')"],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          GH_TOKEN: '',
          GITHUB_TOKEN: '',
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env.local must not define GH_TOKEN or GITHUB_TOKEN');
    expect(result.stdout).not.toContain('should-not-run');
  });

  it('blocks raw GitHub tokens in local .env.local even when .env.local.refs exists', () => {
    const cwd = createRepoTempDir();
    writeFileSync(path.join(cwd, '.env.local'), 'GITHUB_TOKEN=dummy-token\n');
    writeFileSync(path.join(cwd, '.env.local.refs'), 'NODE_ENV=test\n');

    const result = spawnSync(
      'node',
      [path.join(repoRoot, 'scripts/env-run.mjs'), 'node', '-e', "console.log('should-not-run')"],
      {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          GH_TOKEN: '',
          GITHUB_TOKEN: '',
        },
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.env.local must not define GH_TOKEN or GITHUB_TOKEN');
    expect(result.stdout).not.toContain('should-not-run');
  });

  it('finds forbidden local env keys without returning their values', () => {
    const cwd = createRepoTempDir();
    writeFileSync(
      path.join(cwd, '.env.local'),
      [
        'OP_SERVICE_ACCOUNT_TOKEN=ops_should-not-return',
        'GH_TOKEN=ghp_should-not-return',
        'GOVERNADA_GITHUB_APP_ID=12345',
      ].join('\n'),
    );

    const definitions = findEnvLocalKeyDefinitions(
      repoRoot,
      ['OP_SERVICE_ACCOUNT_TOKEN', 'GH_TOKEN'],
      cwd,
    );

    expect(definitions).toContainEqual({
      filePath: path.join(cwd, '.env.local'),
      key: 'OP_SERVICE_ACCOUNT_TOKEN',
    });
    expect(definitions).toContainEqual({ filePath: path.join(cwd, '.env.local'), key: 'GH_TOKEN' });
    expect(JSON.stringify(definitions)).not.toContain('should-not-return');
  });

  it('keeps worktree setup from copying plaintext .env.local files', () => {
    const newWorktree = readFileSync(path.join(repoRoot, 'scripts/new-worktree.mjs'), 'utf8');
    const syncWorktree = readFileSync(path.join(repoRoot, 'scripts/sync-worktree.mjs'), 'utf8');

    expect(newWorktree).not.toContain('copyFileSync');
    expect(syncWorktree).not.toContain('copyFileSync');
  });

  it('keeps GitHub App wrappers on exact local-env keys instead of broad prefixes', () => {
    const checkedFiles = [
      'scripts/github-read-doctor-app.mjs',
      'scripts/github-runtime-doctor.mjs',
      'scripts/github-runtime-broker.mjs',
      'scripts/github-ship-doctor-app.mjs',
      'scripts/github-write-doctor.mjs',
      'scripts/github-pr-write.mjs',
      'scripts/github-pr-close-doctor-app.mjs',
      'scripts/github-pr-close.mjs',
      'scripts/github-merge-doctor-app.mjs',
      'scripts/github-merge.mjs',
    ];

    for (const relativePath of checkedFiles) {
      const content = readFileSync(path.join(repoRoot, relativePath), 'utf8');

      expect(content).toContain('GITHUB_APP_LOCAL_ENV_KEYS');
      expect(content).not.toContain("'GOVERNADA_GITHUB_APP_*'");
      expect(content).not.toContain("'GOVERNADA_OP_SERVICE_ACCOUNT_*'");
      expect(content).not.toContain("'OP_*'");
    }
  });

  it('does not load shared-checkout .env.local from runtime helpers', () => {
    const cjsRuntime = readFileSync(path.join(repoRoot, 'scripts/lib/runtime.js'), 'utf8');
    const esmRuntime = readFileSync(path.join(repoRoot, 'scripts/lib/runtime.mjs'), 'utf8');

    expect(cjsRuntime).not.toContain("sharedRoot ? path.join(sharedRoot, '.env.local')");
    expect(esmRuntime).not.toContain("sharedRoot ? path.join(sharedRoot, '.env.local')");
  });

  it('keeps direct gh shellouts inside auth-wrapping runtime helpers only', () => {
    const directGhPatterns = [
      /runCommand\(['"]gh['"]/u,
      /commandOutput\(['"]gh['"]/u,
      /spawnSync\(['"]gh['"]/u,
      /execFileSync\(['"]gh['"]/u,
    ];
    const checkedFiles = [
      'scripts/pre-merge-check.mjs',
      'scripts/rollback.js',
      'scripts/rollback.mjs',
      'scripts/lib/runtime.js',
      'scripts/lib/runtime.mjs',
    ];

    for (const relativePath of checkedFiles) {
      const content = readFileSync(path.join(repoRoot, relativePath), 'utf8');
      const violations = directGhPatterns.filter((pattern) => pattern.test(content));

      if (relativePath.includes('runtime.')) {
        expect(violations).toHaveLength(1);
      } else {
        expect(violations, relativePath).toHaveLength(0);
      }
    }
  });
});
