import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GITHUB_SHIP_CONFIRMATION,
  assertAllowedShipBranchName,
  buildGithubShipPlan,
  parseGithubShipArgs,
} from '@/scripts/lib/github-ship.mjs';
import {
  formatSecretScanFindings,
  scanGitHubShipContentForSecrets,
} from '@/scripts/lib/secret-scan.mjs';

describe('github ship wrapper guardrails', () => {
  it('routes the ship doctor through the stable agent-runtime host with explicit legacy fallback', () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    const wrapper = readFileSync(
      path.join(process.cwd(), 'scripts/github-ship-doctor.mjs'),
      'utf8',
    );

    expect(packageJson.scripts['github:ship-doctor']).toBe('node scripts/github-ship-doctor.mjs');
    expect(packageJson.scripts['github:ship-doctor:legacy']).toBe(
      'node scripts/github-ship-doctor.mjs --legacy',
    );
    expect(wrapper).toContain('/Users/tim/dev/agent-runtime/bin/agent-runtime');
    expect(wrapper).toContain("'github'");
    expect(wrapper).toContain("'doctor'");
    expect(wrapper).toContain("'--domain'");
    expect(wrapper).toContain("'governada'");
    expect(wrapper).toContain("'--operation'");
    expect(wrapper).toContain("'github.ship.pr'");
    expect(wrapper).toContain('github-ship-doctor-app.mjs');
    expect(wrapper).toContain('Compatibility fallback');
    expect(wrapper).toContain('existing broker-backed github:ship and github:pr-write');
    expect(wrapper).not.toContain('mintInstallationToken');
    expect(wrapper).not.toContain('readPrivateKeyFromOnePassword');
  });

  it('builds a dry-run publish plan for allowed branch prefixes', () => {
    const args = parseGithubShipArgs(['publish', '--head', 'codex/example']);
    const plan = buildGithubShipPlan(args);

    expect(plan).toMatchObject({
      base: 'origin/main',
      execute: false,
      head: 'codex/example',
      operation: 'publish',
    });
  });

  it('requires explicit confirmation for live publish', () => {
    const args = parseGithubShipArgs(['publish', '--head', 'feat/example', '--execute']);

    expect(() => buildGithubShipPlan(args)).toThrow(
      `--execute requires --confirm ${GITHUB_SHIP_CONFIRMATION}.`,
    );
  });

  it('rejects main, cross-repo, force-like, or non-approved branch names', () => {
    for (const branch of ['main', 'someone:branch', 'fix/example', '../codex/x', 'codex//x']) {
      expect(() => assertAllowedShipBranchName(branch)).toThrow(
        'branch must be a same-repository codex/* or feat/* branch name.',
      );
    }
  });

  it('keeps v1 based on origin/main only', () => {
    const args = parseGithubShipArgs(['publish', '--head', 'codex/example', '--base', 'main']);

    expect(() => buildGithubShipPlan(args)).toThrow('--base must be origin/main');
  });

  it('blocks likely secret material before publishing blobs', () => {
    const githubToken = ['ghp', '_123456789012345678901234567890123456'].join('');
    const privateKeyBegin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
    const findings = scanGitHubShipContentForSecrets({
      content: [
        `GITHUB_TOKEN=${githubToken}`,
        privateKeyBegin,
        'opaque',
        '-----END PRIVATE KEY-----',
      ].join('\n'),
      filePath: 'scripts/example.sh',
    });

    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'raw GitHub/1Password token env assignment' }),
        expect.objectContaining({ label: 'GitHub token' }),
        expect.objectContaining({ label: 'private key PEM block' }),
      ]),
    );
    expect(formatSecretScanFindings(findings)).not.toContain(githubToken);
  });

  it('allows placeholders and op references while still blocking secret-bearing file names', () => {
    expect(
      scanGitHubShipContentForSecrets({
        content: [
          'GITHUB_TOKEN=op://Governada-Automation/item/token',
          'example token github_pat_placeholder_for_docs',
          'OP_SERVICE_ACCOUNT_TOKEN=ops_dummy.service-account-token',
        ].join('\n'),
        filePath: 'docs/examples/auth.md',
      }),
    ).toEqual([]);

    expect(
      scanGitHubShipContentForSecrets({
        content: 'GITHUB_TOKEN=op://Governada-Automation/item/token\n',
        filePath: '.env.local',
      }),
    ).toEqual([
      {
        label: 'blocked secret/config filename .env.local',
        path: '.env.local',
      },
    ]);
  });
});
