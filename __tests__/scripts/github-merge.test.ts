import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github merge required-check gate', () => {
  it('refuses to merge when a required check is failing', async () => {
    const { decideMergeGate, evaluateRequiredChecks } =
      await import('../../scripts/github-merge.mjs');

    const evaluation = evaluateRequiredChecks([
      { conclusion: 'FAILURE', name: 'checks', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'test', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'validate-pr-body', status: 'COMPLETED' },
    ]);
    const decision = decideMergeGate(evaluation, { prNumber: '998' });

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      'checks: failure (checks status=COMPLETED conclusion=FAILURE)',
    ]);
    expect(decision.ok).toBe(false);
  });

  it('allows the loud override while preserving an audit message', async () => {
    const { decideMergeGate, evaluateRequiredChecks } =
      await import('../../scripts/github-merge.mjs');

    const evaluation = evaluateRequiredChecks([
      { conclusion: 'FAILURE', name: 'checks', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'test', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'validate-pr-body', status: 'COMPLETED' },
    ]);
    const decision = decideMergeGate(evaluation, {
      forceMergeWithFailingChecks: true,
      prNumber: '998',
    });

    expect(decision.ok).toBe(true);
    expect(decision.audit).toContain('--force-merge-with-failing-checks used for PR #998');
    expect(decision.audit).toContain('checks: failure');
  });

  it('allows clean required checks and warns on known-broken Supabase Preview', async () => {
    const { decideMergeGate, evaluateRequiredChecks } =
      await import('../../scripts/github-merge.mjs');

    const evaluation = evaluateRequiredChecks([
      { conclusion: 'SUCCESS', name: 'checks', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'test', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'validate-pr-body', status: 'COMPLETED' },
      { conclusion: 'FAILURE', name: 'Supabase Preview', status: 'COMPLETED' },
    ]);
    const decision = decideMergeGate(evaluation, { prNumber: '1003' });

    expect(evaluation.ok).toBe(true);
    expect(evaluation.passes).toEqual(['checks: green', 'test: green', 'validate-pr-body: green']);
    expect(evaluation.warnings).toEqual([
      'Supabase Preview: failure (status=COMPLETED conclusion=FAILURE); known-broken informational check, not a merge blocker for F7',
    ]);
    expect(decision.ok).toBe(true);
  });

  it('treats pending or missing required checks as blockers after the timeout window', async () => {
    const { evaluateRequiredChecks } = await import('../../scripts/github-merge.mjs');

    const evaluation = evaluateRequiredChecks([
      { conclusion: 'SUCCESS', name: 'checks', status: 'COMPLETED' },
      { name: 'test', status: 'IN_PROGRESS' },
    ]);

    expect(evaluation.ok).toBe(false);
    expect(evaluation.blockers).toEqual([
      'test: pending (test status=IN_PROGRESS)',
      'validate-pr-body: missing from statusCheckRollup',
    ]);
  });

  it('preserves gh merge arguments while consuming wrapper-only flags', async () => {
    const { buildGhPrMergeArgs, parseGithubMergeArgs } =
      await import('../../scripts/github-merge.mjs');

    const options = parseGithubMergeArgs([
      '--pr',
      '1003',
      '--squash',
      '--delete-branch',
      '--force-merge-with-failing-checks',
      '--check-timeout-ms',
      '0',
    ]);

    expect(buildGhPrMergeArgs(options)).toEqual([
      'pr',
      'merge',
      '1003',
      '--squash',
      '--delete-branch',
      '--repo',
      'governada/app',
    ]);
  });

  it('blocks and proceeds through the CLI with mocked gh status', () => {
    const failing = [
      { conclusion: 'FAILURE', name: 'checks', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'test', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'validate-pr-body', status: 'COMPLETED' },
    ];
    const passing = [
      { conclusion: 'SUCCESS', name: 'checks', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'test', status: 'COMPLETED' },
      { conclusion: 'SUCCESS', name: 'validate-pr-body', status: 'COMPLETED' },
    ];

    const blocked = runWrapperWithFakeGh(failing, ['--pr', '998', '--check-timeout-ms=0']);
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('BLOCKED: required merge checks are not green');
    expect(existsSync(blocked.mergeLog)).toBe(false);

    const forced = runWrapperWithFakeGh(failing, [
      '--pr',
      '998',
      '--force-merge-with-failing-checks',
      '--check-timeout-ms=0',
      '--squash',
    ]);
    expect(forced.status).toBe(0);
    expect(forced.stderr).toContain('OVERRIDE: --force-merge-with-failing-checks used');
    expect(readFileSync(forced.mergeLog, 'utf8')).toContain(
      'pr merge 998 --squash --repo governada/app',
    );

    const clean = runWrapperWithFakeGh(passing, ['1003', '--check-timeout-ms=0', '--squash']);
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('Required merge checks passed for PR #1003');
    expect(readFileSync(clean.mergeLog, 'utf8')).toContain(
      'pr merge 1003 --squash --repo governada/app',
    );
  });
});

function runWrapperWithFakeGh(
  statusCheckRollup: Array<Record<string, string>>,
  args: string[],
): { mergeLog: string; status: number | null; stderr: string; stdout: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'governada-github-merge-test-'));
  tempRoots.push(root);

  const mergeLog = path.join(root, 'merge.log');
  const fakeGh = path.join(root, 'fake-gh.mjs');
  writeFileSync(
    fakeGh,
    `#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'pr' && args[1] === 'view') {
  console.log(JSON.stringify({ statusCheckRollup: JSON.parse(process.env.FAKE_STATUS_ROLLUP || '[]') }));
  process.exit(0);
}
if (args[0] === 'pr' && args[1] === 'merge') {
  appendFileSync(process.env.FAKE_MERGE_LOG, args.join(' ') + '\\n');
  process.exit(0);
}
console.error('unexpected fake gh args: ' + args.join(' '));
process.exit(2);
`,
    'utf8',
  );
  chmodSync(fakeGh, 0o755);

  const result = spawnSync('node', [path.join(repoRoot, 'scripts/github-merge.mjs'), ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FAKE_MERGE_LOG: mergeLog,
      FAKE_STATUS_ROLLUP: JSON.stringify(statusCheckRollup),
      GOVERNADA_GH_BIN: fakeGh,
    },
  });

  return {
    mergeLog,
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}
