import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GITHUB_PR_CLOSE_CONFIRMATION,
  assertAllowedGithubPrClosePlan,
  buildGithubPrClosePlan,
  evaluateGithubPrCloseBrokerStatus,
  evaluatePullRequestForClose,
  parseGithubPrCloseApproval,
  parseGithubPrCloseArgs,
  redactGithubPrClosePlan,
} from '@/scripts/lib/github-pr-close.mjs';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const tempRoots: string[] = [];

function tempRepoRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'governada-pr-close-test-'));
  tempRoots.push(root);
  return root;
}

function approvalText(pr = 891, sha = SHA) {
  return `I approve github.pr.close for governada/app PR #${pr} at expected head ${sha}.`;
}

function draftPull(overrides: Record<string, unknown> = {}) {
  return {
    base: {
      ref: 'main',
      repo: {
        full_name: 'governada/app',
      },
    },
    draft: true,
    head: {
      ref: 'codex/example',
      repo: {
        full_name: 'governada/app',
      },
      sha: SHA,
    },
    number: 891,
    state: 'open',
    ...overrides,
  };
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github PR close wrapper guardrails', () => {
  it('builds a dry-run close plan for an expected PR head', () => {
    const root = tempRepoRoot();
    const args = parseGithubPrCloseArgs(['--pr', '891', '--expected-head', SHA]);

    const plan = buildGithubPrClosePlan(args, root) as any;
    assertAllowedGithubPrClosePlan(plan);

    expect(plan).toMatchObject({
      body: {
        state: 'closed',
      },
      execute: false,
      expectedHead: SHA,
      method: 'PATCH',
      operation: 'close',
      path: '/repos/governada/app/pulls/891',
      prNumber: 891,
    });
  });

  it('requires explicit confirmation and approval text for live execution', () => {
    const root = tempRepoRoot();
    const args = parseGithubPrCloseArgs(['--pr', '891', '--expected-head', SHA, '--execute']);

    expect(() => buildGithubPrClosePlan(args, root)).toThrow(
      `--execute requires --confirm ${GITHUB_PR_CLOSE_CONFIRMATION}.`,
    );

    const missingApprovalArgs = parseGithubPrCloseArgs([
      '--pr',
      '891',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      GITHUB_PR_CLOSE_CONFIRMATION,
    ]);
    expect(() => buildGithubPrClosePlan(missingApprovalArgs, root)).toThrow(
      'PR close approval is not current or specific',
    );
  });

  it('accepts approval text only when it names repo, operation, PR, and expected head', () => {
    const approval = parseGithubPrCloseApproval({
      expectedHead: SHA,
      prNumber: 891,
      text: approvalText(),
    });
    expect(approval.ok).toBe(true);

    const staleApproval = parseGithubPrCloseApproval({
      expectedHead: SHA,
      prNumber: 891,
      text: approvalText(887),
    });
    expect(staleApproval.ok).toBe(false);
    expect(staleApproval.reasons).toContain('approval must name PR #891');

    const vagueApproval = parseGithubPrCloseApproval({
      expectedHead: SHA,
      prNumber: 891,
      text: `Please close governada/app PR #891 at expected head ${SHA}.`,
    });
    expect(vagueApproval.ok).toBe(false);
    expect(vagueApproval.reasons).toContain('approval must explicitly approve the operation');
    expect(vagueApproval.reasons).toContain('approval must name github.pr.close');
  });

  it('allows approval text to come from a repo-local file', () => {
    const root = tempRepoRoot();
    writeFileSync(path.join(root, 'approval.txt'), approvalText(), 'utf8');
    const args = parseGithubPrCloseArgs([
      '--pr',
      '891',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      GITHUB_PR_CLOSE_CONFIRMATION,
      '--approval-file',
      'approval.txt',
    ]);

    const plan = buildGithubPrClosePlan(args, root) as any;
    expect(plan.approvalText).toContain('github.pr.close');
  });

  it('rejects approval files outside the repository', () => {
    const root = tempRepoRoot();
    const outside = path.join(path.dirname(root), 'approval.txt');
    writeFileSync(outside, approvalText(), 'utf8');
    const args = parseGithubPrCloseArgs([
      '--pr',
      '891',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      GITHUB_PR_CLOSE_CONFIRMATION,
      '--approval-file',
      outside,
    ]);

    expect(() => buildGithubPrClosePlan(args, root)).toThrow(
      '--approval-file must be inside the current repository.',
    );
    rmSync(outside, { force: true });
  });

  it('blocks non-draft, wrong-head, wrong-repo, and main-head PR closure', () => {
    expect(evaluatePullRequestForClose(draftPull(), SHA).blockers).toEqual([]);

    expect(evaluatePullRequestForClose(draftPull({ draft: false }), SHA).blockers).toContain(
      'PR #891 is not draft; github.pr.close v1 only closes draft PRs',
    );

    expect(
      evaluatePullRequestForClose(draftPull(), 'abcdefabcdefabcdefabcdefabcdefabcdefabcd').blockers,
    ).toContain(`PR #891 head SHA is ${SHA}, expected abcdefabcdefabcdefabcdefabcdefabcdefabcd`);

    expect(
      evaluatePullRequestForClose(
        draftPull({
          head: {
            ref: 'codex/example',
            repo: {
              full_name: 'other/app',
            },
            sha: SHA,
          },
        }),
        SHA,
      ).blockers,
    ).toContain('PR #891 head repo is other/app, expected governada/app');

    expect(
      evaluatePullRequestForClose(
        draftPull({
          head: {
            ref: 'main',
            repo: {
              full_name: 'governada/app',
            },
            sha: SHA,
          },
        }),
        SHA,
      ).blockers,
    ).toContain('github.pr.close must not operate on main as the PR head branch');
  });

  it('redacts close plans without approval text', () => {
    const root = tempRepoRoot();
    const args = parseGithubPrCloseArgs(['--pr', '891', '--expected-head', SHA]);
    const redacted = redactGithubPrClosePlan(buildGithubPrClosePlan(args, root));

    expect(redacted).toEqual({
      body: {
        state: 'closed',
      },
      description: `close draft PR #891 with expected head ${SHA}`,
      execute: false,
      method: 'PATCH',
      operation: 'close',
      path: '/repos/governada/app/pulls/891',
    });
  });

  it('requires the live broker to advertise github.pr.close before close execution', () => {
    const currentBroker = evaluateGithubPrCloseBrokerStatus({
      repo: 'governada/app',
      running: true,
      supportedOperationClasses: ['github.read', 'github.pr.close'],
    });
    expect(currentBroker.blockers).toEqual([]);
    expect(currentBroker.passes).toContain('GitHub runtime broker advertises github.pr.close');

    const staleBroker = evaluateGithubPrCloseBrokerStatus({
      repo: 'governada/app',
      running: true,
      supportedOperationClasses: ['github.read', 'github.ship.pr', 'github.merge'],
    });
    expect(staleBroker.blockers).toContain(
      'GitHub runtime broker does not advertise github.pr.close; refresh the broker from current shared main before live PR close',
    );
  });
});
