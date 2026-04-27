import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GITHUB_WRITE_PR_CONFIRMATION,
  assertAllowedGithubPrWritePlan,
  buildGithubPrWritePlan,
  isCompletedReviewGateBodyOnlyUpdate,
  parseGithubPrWriteArgs,
  redactGithubPrWritePlan,
} from '@/scripts/lib/github-pr-write.mjs';

const tempRoots: string[] = [];

function tempRepoRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'governada-pr-write-test-'));
  tempRoots.push(root);
  return root;
}

function writeBody(root: string, relativePath = 'pr-body.md', content = 'PR body text\n') {
  writeFileSync(path.join(root, relativePath), content, 'utf8');
  return relativePath;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github PR write wrapper guardrails', () => {
  it('builds a dry-run draft PR creation plan for same-repo branches', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const args = parseGithubPrWriteArgs([
      'create',
      '--head',
      'feat/example',
      '--title',
      'Example PR',
      '--body-file',
      bodyFile,
    ]);

    const plan = buildGithubPrWritePlan(args, root) as any;
    assertAllowedGithubPrWritePlan(plan);

    expect(plan).toMatchObject({
      execute: false,
      method: 'POST',
      operation: 'create',
      path: '/repos/governada/app/pulls',
    });
    expect(plan.body).toMatchObject({
      base: 'main',
      draft: true,
      head: 'feat/example',
      maintainer_can_modify: false,
      title: 'Example PR',
    });
  });

  it('requires explicit confirmation for live execution', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const args = parseGithubPrWriteArgs([
      'create',
      '--head',
      'feat/example',
      '--title',
      'Example PR',
      '--body-file',
      bodyFile,
      '--execute',
    ]);

    expect(() => buildGithubPrWritePlan(args, root)).toThrow(
      `--execute requires --confirm ${GITHUB_WRITE_PR_CONFIRMATION}.`,
    );
  });

  it('rejects cross-repository head refs', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const args = parseGithubPrWriteArgs([
      'create',
      '--head',
      'someone:branch',
      '--title',
      'Example PR',
      '--body-file',
      bodyFile,
    ]);

    expect(() => buildGithubPrWritePlan(args, root)).toThrow(
      '--head must be a same-repository branch name.',
    );
  });

  it('builds an update plan only for pull request title and body', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const args = parseGithubPrWriteArgs([
      'update',
      '--pr',
      '123',
      '--title',
      'Updated title',
      '--body-file',
      bodyFile,
      '--execute',
      '--confirm',
      GITHUB_WRITE_PR_CONFIRMATION,
    ]);

    const plan = buildGithubPrWritePlan(args, root) as any;
    assertAllowedGithubPrWritePlan(plan);

    expect(plan).toMatchObject({
      execute: true,
      method: 'PATCH',
      operation: 'update',
      path: '/repos/governada/app/pulls/123',
    });
    expect(plan.body).toEqual({
      body: 'PR body text\n',
      title: 'Updated title',
    });
  });

  it('builds a ready plan for marking a draft pull request ready for review', () => {
    const root = tempRepoRoot();
    const args = parseGithubPrWriteArgs([
      'ready',
      '--pr',
      '912',
      '--execute',
      '--confirm',
      GITHUB_WRITE_PR_CONFIRMATION,
    ]);

    const plan = buildGithubPrWritePlan(args, root) as any;
    assertAllowedGithubPrWritePlan(plan);

    expect(plan).toMatchObject({
      body: {
        pullRequestNumber: 912,
      },
      execute: true,
      graphQlMutation: 'markPullRequestReadyForReview',
      method: 'POST',
      operation: 'ready',
      path: '/graphql',
      prNumber: 912,
    });
  });

  it('rejects unsafe ready endpoint shapes', () => {
    expect(() =>
      assertAllowedGithubPrWritePlan({
        body: {},
        execute: true,
        graphQlMutation: 'addComment',
        method: 'POST',
        operation: 'ready',
        path: '/graphql',
      }),
    ).toThrow('ready operation must use GraphQL markPullRequestReadyForReview.');
  });

  it('rejects unsafe update endpoint shapes', () => {
    expect(() =>
      assertAllowedGithubPrWritePlan({
        body: {},
        execute: true,
        method: 'POST',
        operation: 'update',
        path: '/repos/governada/app/issues/1/comments',
      }),
    ).toThrow('update operation must use PATCH /repos/{repo}/pulls/{number}.');
  });

  it('rejects body files outside the repo and local secret files', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const outside = path.join(path.dirname(root), 'outside-pr-body.md');
    writeFileSync(outside, 'outside\n', 'utf8');

    const outsideArgs = parseGithubPrWriteArgs([
      'create',
      '--head',
      'feat/example',
      '--title',
      'Example PR',
      '--body-file',
      outside,
    ]);
    expect(() => buildGithubPrWritePlan(outsideArgs, root)).toThrow(
      '--body-file must be inside the current repository.',
    );

    writeFileSync(path.join(root, '.env.local'), 'SECRET=value\n', 'utf8');
    const secretArgs = parseGithubPrWriteArgs([
      'update',
      '--pr',
      '12',
      '--body-file',
      '.env.local',
    ]);
    expect(() => buildGithubPrWritePlan(secretArgs, root)).toThrow(
      '--body-file must not point at local secret/config files.',
    );

    rmSync(outside, { force: true });
    expect(bodyFile).toBe('pr-body.md');
  });

  it('rejects body files that symlink outside the repo', () => {
    const root = tempRepoRoot();
    const outside = path.join(path.dirname(root), 'outside-pr-body.md');
    const symlinkPath = path.join(root, 'linked-pr-body.md');
    writeFileSync(outside, 'outside\n', 'utf8');
    symlinkSync(outside, symlinkPath);

    const args = parseGithubPrWriteArgs([
      'create',
      '--head',
      'feat/example',
      '--title',
      'Example PR',
      '--body-file',
      'linked-pr-body.md',
    ]);

    expect(() => buildGithubPrWritePlan(args, root)).toThrow(
      '--body-file must be inside the current repository.',
    );

    rmSync(outside, { force: true });
  });

  it('redacts PR body text when printing plans', () => {
    const root = tempRepoRoot();
    const bodyFile = writeBody(root);
    const args = parseGithubPrWriteArgs(['update', '--pr', '12', '--body-file', bodyFile]);

    const redacted = redactGithubPrWritePlan(buildGithubPrWritePlan(args, root));
    expect(redacted.body.body).toBe('[body text: 13 chars]');
  });

  it('allows only completed Review Gate body updates on ready PRs', () => {
    const root = tempRepoRoot();
    const completedBodyFile = writeBody(
      root,
      'completed-review.md',
      '## Review Gate v0\n\n- **Review tier**: L2\n- **Status**: Completed and passed.\n- **Findings**: No blocking findings.\n',
    );
    const completedPlan = buildGithubPrWritePlan(
      parseGithubPrWriteArgs(['update', '--pr', '917', '--body-file', completedBodyFile]),
      root,
    );

    expect(
      isCompletedReviewGateBodyOnlyUpdate(completedPlan, { draft: false, state: 'open' }),
    ).toBe(true);

    const titlePlan = buildGithubPrWritePlan(
      parseGithubPrWriteArgs([
        'update',
        '--pr',
        '917',
        '--title',
        'Updated title',
        '--body-file',
        completedBodyFile,
      ]),
      root,
    );
    expect(isCompletedReviewGateBodyOnlyUpdate(titlePlan, { draft: false, state: 'open' })).toBe(
      false,
    );

    const pendingBodyFile = writeBody(
      root,
      'pending-review.md',
      '## Review Gate v0\n\n- **Review tier**: L2\n- **Findings**: Review Gate v0 still needs to run before merge.\n',
    );
    const pendingPlan = buildGithubPrWritePlan(
      parseGithubPrWriteArgs(['update', '--pr', '917', '--body-file', pendingBodyFile]),
      root,
    );
    expect(isCompletedReviewGateBodyOnlyUpdate(pendingPlan, { draft: false, state: 'open' })).toBe(
      false,
    );
  });
});
