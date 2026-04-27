import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { githubBrokerSocketPath } from '@/scripts/lib/github-broker-client.mjs';

const repoRoot = process.cwd();
const tempRoots: string[] = [];

function tempCwd() {
  const root = mkdtempSync(path.join(tmpdir(), 'governada-runtime-doctor-'));
  tempRoots.push(root);
  return root;
}

function runRuntimeDoctor(cwd: string, env: Record<string, string | undefined> = {}) {
  return spawnSync('node', [path.join(repoRoot, 'scripts/github-runtime-doctor.mjs')], {
    cwd,
    encoding: 'utf8',
    env: {
      HOME: process.env.HOME,
      PATH: process.env.PATH,
      ...env,
      GH_TOKEN: env.GH_TOKEN || '',
      GITHUB_TOKEN: env.GITHUB_TOKEN || '',
      NODE_ENV: normalizeNodeEnv(env.NODE_ENV),
      OP_CONNECT_HOST: env.OP_CONNECT_HOST || '',
      OP_CONNECT_TOKEN: env.OP_CONNECT_TOKEN || '',
      OP_SERVICE_ACCOUNT_TOKEN: env.OP_SERVICE_ACCOUNT_TOKEN || '',
    },
  });
}

function normalizeNodeEnv(value: string | undefined) {
  return value === 'development' || value === 'production' || value === 'test' ? value : 'test';
}

function writeRuntimeRefs(root: string, lines: string[] = []) {
  writeFileSync(
    path.join(root, '.env.local.refs'),
    [
      'GOVERNADA_GITHUB_APP_ID=12345',
      'GOVERNADA_GITHUB_APP_INSTALLATION_ID=67890',
      'GOVERNADA_GITHUB_APP_PRIVATE_KEY_OP_REF=op://Governada-Automation/app/private-key',
      ...lines,
    ].join('\n'),
  );
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github runtime doctor CLI', () => {
  it('keeps broker socket timeout aligned with the client request timeout', () => {
    const brokerSource = readFileSync(
      path.join(repoRoot, 'scripts/github-runtime-broker.mjs'),
      'utf8',
    );

    expect(brokerSource).toContain(
      'const GITHUB_BROKER_SOCKET_TIMEOUT_MS = GITHUB_BROKER_REQUEST_TIMEOUT_MS + 5000',
    );
    expect(brokerSource).toContain('socket.setTimeout(GITHUB_BROKER_SOCKET_TIMEOUT_MS');
    expect(brokerSource).not.toContain('socket.setTimeout(10000');
  });

  it('uses a repo-runtime broker socket path instead of caller-controlled temp dirs', () => {
    const originalTmpdir = process.env.TMPDIR;
    const callerTmpdir = path.join(tmpdir(), 'caller-controlled-tmpdir');

    process.env.TMPDIR = callerTmpdir;
    let socketPath = '';
    try {
      socketPath = githubBrokerSocketPath(repoRoot, { NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    } finally {
      if (originalTmpdir === undefined) {
        delete process.env.TMPDIR;
      } else {
        process.env.TMPDIR = originalTmpdir;
      }
    }

    expect(socketPath).not.toContain(callerTmpdir);
    expect(socketPath).toContain(`${path.sep}.agents${path.sep}runtime${path.sep}`);
    expect(socketPath).toMatch(/github-broker\.sock$/);
  });

  it('passes with advisories when no service-account token is mounted', () => {
    const cwd = tempCwd();
    writeRuntimeRefs(cwd);

    const result = runRuntimeDoctor(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('service-account token is not present in this process');
    expect(result.stdout).toContain('GitHub runtime doctor result: PASS_WITH_ADVISORIES');
  });

  it('blocks token-present runtime without rotation metadata', () => {
    const cwd = tempCwd();
    writeRuntimeRefs(cwd);

    const result = runRuntimeDoctor(cwd, {
      OP_SERVICE_ACCOUNT_TOKEN: 'ops_dummy.service-account-token',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT is missing; record non-secret service-account rotation metadata before live GitHub App use',
    );
    expect(result.stdout).toContain('GitHub runtime doctor result: BLOCKED');
  });

  it('blocks forbidden service-account tokens in .env.local without hydrating the value', () => {
    const cwd = tempCwd();
    writeRuntimeRefs(cwd, [
      'GOVERNADA_OP_SERVICE_ACCOUNT_EXPIRES_AT=2026-05-25T00:00:00Z',
      'GOVERNADA_OP_SERVICE_ACCOUNT_ROTATE_AFTER=2026-05-18T00:00:00Z',
    ]);
    writeFileSync(path.join(cwd, '.env.local'), 'OP_SERVICE_ACCOUNT_TOKEN=ops_should-not-load\n');

    const result = runRuntimeDoctor(cwd);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('.env.local must not define OP_SERVICE_ACCOUNT_TOKEN');
    expect(result.stdout).toContain('service-account token is not present in this process');
    expect(result.stdout).not.toContain('ops_should-not-load');
  });
});
