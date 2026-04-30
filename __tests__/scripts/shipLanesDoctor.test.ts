import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

describe('ship lane doctor', () => {
  it('exposes an npm script for the lane-separation doctor', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    expect(packageJson.scripts['ship:doctor']).toBe('node scripts/ship-lanes-doctor.mjs');
  });

  it('documents the separate auth and shipping lanes in help output', () => {
    const result = spawnSync(
      'node',
      [path.join(repoRoot, 'scripts/ship-lanes-doctor.mjs'), '--help'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('local Git refs and remote configuration');
    expect(result.stdout).toContain('direct Git SSH via github-governada');
    expect(result.stdout).toContain('direct Git remote transport via git ls-remote');
    expect(result.stdout).toContain('repo GitHub API/token auth');
    expect(result.stdout).toContain('existing app-local broker/runtime path');
    expect(result.stdout).toContain('stable agent-runtime operation proof path');
  });

  it('requires direct SSH signing probes to be explicitly requested', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/ship-lanes-doctor.mjs'), 'utf8');

    expect(source).toContain('--probe-ssh');
    expect(source).toContain('--probe-git-remote');
    expect(source).toContain('--require-direct-git');
    expect(source).toContain('active SSH key/signing/auth probes skipped');
    expect(source).toContain("run('ssh-add', ['-l'");
    expect(source).toContain('configured IdentityAgent socket');
    expect(source).toContain("run('ssh-add', ['-T'");
    expect(source).toContain('git ls-remote --heads origin main');
    expect(source).toContain("run('ssh'");
    expect(source).not.toContain("git', ['fetch");
    expect(source).not.toContain("git', ['push");
  });

  it('parses direct Git remote probes as explicit opt-in checks', async () => {
    const module = await import(path.join(repoRoot, 'scripts/ship-lanes-doctor.mjs'));

    expect(module.parseArgs(['--probe-git-remote', '--ssh-timeout-ms', '2500'])).toMatchObject({
      probeGitRemote: true,
      requireDirectGit: false,
      sshTimeoutMs: 2500,
    });
    expect(module.parseArgs(['--require-direct-git'])).toMatchObject({
      probeGitRemote: true,
      requireDirectGit: true,
    });
    expect(() => module.parseArgs(['--ssh-timeout-ms', '999'])).toThrow(
      '--ssh-timeout-ms requires an integer from 1000 to 120000',
    );
  });

  it('classifies missing service-account runtime as expected fail-closed stable-host behavior', async () => {
    const module = await import(path.join(repoRoot, 'scripts/ship-lanes-doctor.mjs'));

    expect(
      module.isExpectedMissingTokenFailClosed(
        'BLOCKED: OP_SERVICE_ACCOUNT_TOKEN is not present\nAgent runtime doctor result: FAIL_CLOSED (1 blockers)',
      ),
    ).toBe(true);
    expect(module.isExpectedMissingTokenFailClosed('GitHub runtime doctor result: BLOCKED')).toBe(
      false,
    );
  });
});
