import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildGithubMergeApprovalPrompt,
  parseGithubMergeApproval,
} from '@/scripts/lib/github-merge-approval.mjs';
import {
  assertAllowedGithubMergePlan,
  buildGithubMergePlan,
  evaluateGithubChecksForMerge,
  evaluatePullRequestForMerge,
  hasReviewGateRecord,
  parseGithubMergeArgs,
  redactGithubMergePlan,
} from '@/scripts/lib/github-merge.mjs';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const repoRoot = process.cwd();
const tempRoots: string[] = [];

function tempRepoRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'governada-merge-test-'));
  tempRoots.push(root);
  return root;
}

function approvalText(pr = 913, sha = SHA) {
  return `I approve github.merge for governada/app PR #${pr} if checks are green and the head SHA ${sha} is unchanged.`;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      rmSync(root, { force: true, recursive: true });
    }
  }
});

describe('github merge wrapper guardrails', () => {
  it('routes the merge doctor through the stable host while preserving app-local fallback', () => {
    const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const wrapper = readFileSync(path.join(repoRoot, 'scripts/github-merge-doctor.mjs'), 'utf8');
    const appDoctor = readFileSync(
      path.join(repoRoot, 'scripts/github-merge-doctor-app.mjs'),
      'utf8',
    );
    const mergeScript = readFileSync(path.join(repoRoot, 'scripts/github-merge.mjs'), 'utf8');

    expect(packageJson.scripts['github:merge-doctor']).toBe('node scripts/github-merge-doctor.mjs');
    expect(packageJson.scripts['github:merge-doctor:legacy']).toBe(
      'node scripts/github-merge-doctor.mjs --legacy',
    );
    expect(wrapper).toContain('/Users/tim/dev/agent-runtime/bin/agent-runtime');
    expect(wrapper).toContain("'github'");
    expect(wrapper).toContain("'doctor'");
    expect(wrapper).toContain("'--domain'");
    expect(wrapper).toContain("'governada'");
    expect(wrapper).toContain("'--operation'");
    expect(wrapper).toContain("'github.merge'");
    expect(wrapper).toContain('github-merge-doctor-app.mjs');
    expect(wrapper).toContain('Compatibility fallback');
    expect(wrapper).toContain('existing broker-backed github:merge wrapper remains active');
    expect(wrapper).not.toContain('readPrivateKeyFromOnePassword');
    expect(wrapper).not.toContain('mintInstallationToken');
    expect(appDoctor).toContain('readPrivateKeyFromOnePassword');
    expect(appDoctor).toContain('evaluatePullRequestForMerge');
    expect(appDoctor).toContain('getGithubBrokerStatus');
    expect(appDoctor).toContain('verifyNonMutatingMergeLaneAccessWithBroker');
    expect(appDoctor).toContain('proving legacy fallback through the existing broker');
    expect(appDoctor).not.toContain('ensureGithubBrokerRunning');
    expect(mergeScript).toContain('ensureGithubBrokerRunning');
    expect(mergeScript).toContain(
      'Live merge approval accepted; checking broker/Keychain readiness now',
    );
    expect(mergeScript).toContain('runPostMergeVerification');
  });

  it('requires prompt approval to name repo, PR, operation, head SHA, checks, and unchanged head', () => {
    expect(buildGithubMergeApprovalPrompt({ expectedHead: SHA, prNumber: 913 })).toBe(
      `I approve github.merge for governada/app PR #913 if CI checks are green and the head SHA remains unchanged at ${SHA}.`,
    );

    const approval = parseGithubMergeApproval({
      expectedHead: SHA,
      prNumber: 913,
      text: approvalText(),
    });

    expect(approval).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it('rejects vague or stale merge approvals', () => {
    const vague = parseGithubMergeApproval({
      expectedHead: SHA,
      prNumber: 913,
      text: 'ok merge it',
    });
    const wrongPr = parseGithubMergeApproval({
      expectedHead: SHA,
      prNumber: 913,
      text: approvalText(912),
    });
    const missingHead = parseGithubMergeApproval({
      expectedHead: SHA,
      prNumber: 913,
      text: 'I approve github.merge for governada/app PR #913 if checks are green and head is unchanged.',
    });

    expect(vague.ok).toBe(false);
    expect(vague.reasons).toContain('approval must name repo governada/app');
    expect(vague.reasons).toContain('approval must name PR #913');
    expect(wrongPr.ok).toBe(false);
    expect(wrongPr.reasons).toContain('approval must name PR #913');
    expect(missingHead.ok).toBe(false);
    expect(missingHead.reasons).toContain('approval must include the expected head SHA');
  });

  it('builds a dry-run merge plan pinned to expected head', () => {
    const root = tempRepoRoot();
    const args = parseGithubMergeArgs(['--pr', '913', '--expected-head', SHA]);

    const plan = buildGithubMergePlan(args, root);
    assertAllowedGithubMergePlan(plan);

    expect(plan).toMatchObject({
      execute: false,
      method: 'PUT',
      operation: 'merge',
      path: '/repos/governada/app/pulls/913/merge',
    });
    expect(plan.body).toEqual({
      merge_method: 'squash',
      sha: SHA,
    });
  });

  it('requires explicit confirmation and current approval for live merge', () => {
    const root = tempRepoRoot();
    const args = parseGithubMergeArgs([
      '--pr',
      '913',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      'github.merge',
    ]);

    expect(() => buildGithubMergePlan(args, root)).toThrow(
      'merge approval is not current or specific',
    );
  });

  it('accepts live approval from an in-repo approval file', () => {
    const root = tempRepoRoot();
    writeFileSync(path.join(root, 'approval.txt'), approvalText(), 'utf8');
    const args = parseGithubMergeArgs([
      '--pr',
      '913',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      'github.merge',
      '--approval-file',
      'approval.txt',
    ]);

    const plan = buildGithubMergePlan(args, root);
    assertAllowedGithubMergePlan(plan);
    expect(plan.execute).toBe(true);
  });

  it('rejects approval files outside the repo or symlinked outside the repo', () => {
    const root = tempRepoRoot();
    const outside = path.join(path.dirname(root), 'outside-approval.txt');
    const symlinkPath = path.join(root, 'approval-link.txt');
    writeFileSync(outside, approvalText(), 'utf8');
    symlinkSync(outside, symlinkPath);

    const outsideArgs = parseGithubMergeArgs([
      '--pr',
      '913',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      'github.merge',
      '--approval-file',
      outside,
    ]);
    const symlinkArgs = parseGithubMergeArgs([
      '--pr',
      '913',
      '--expected-head',
      SHA,
      '--execute',
      '--confirm',
      'github.merge',
      '--approval-file',
      'approval-link.txt',
    ]);

    expect(() => buildGithubMergePlan(outsideArgs, root)).toThrow(
      '--approval-file must be inside the current repository.',
    );
    expect(() => buildGithubMergePlan(symlinkArgs, root)).toThrow(
      '--approval-file must be inside the current repository.',
    );

    rmSync(outside, { force: true });
  });

  it('blocks wrong-repo, draft, changed-head, behind, and missing review gate PRs', () => {
    const evaluation = evaluatePullRequestForMerge(
      {
        base: {
          ref: 'main',
          repo: { full_name: 'tim-governada/app' },
        },
        body: 'No review notes',
        draft: true,
        head: {
          ref: 'main',
          repo: { full_name: 'someone/app' },
          sha: 'ffffffffffffffffffffffffffffffffffffffff',
        },
        mergeable_state: 'behind',
        number: 913,
        state: 'open',
      },
      SHA,
    );

    expect(evaluation.blockers).toEqual([
      'PR #913 is draft or draft state is unknown',
      'PR #913 targets tim-governada/app:main, expected governada/app:main',
      'PR #913 head repo is someone/app, expected governada/app',
      `PR #913 head SHA is ffffffffffffffffffffffffffffffffffffffff, expected ${SHA}`,
      'merge lane must not operate on main as the PR head branch',
      'PR #913 mergeable_state is behind',
      'PR #913 body does not record completed Review Gate v0',
    ]);
  });

  it('accepts ready same-repo PRs with Review Gate v0 recorded', () => {
    const evaluation = evaluatePullRequestForMerge(
      {
        base: {
          ref: 'main',
          repo: { full_name: 'governada/app' },
        },
        body: '## Review Gate v0\nReview tier: L3\nFindings fixed: none\n',
        draft: false,
        head: {
          ref: 'feat/example',
          repo: { full_name: 'governada/app' },
          sha: SHA,
        },
        mergeable_state: 'clean',
        number: 913,
        state: 'open',
      },
      SHA,
    );

    expect(evaluation.blockers).toEqual([]);
    expect(evaluation.passes).toContain('PR #913 records completed Review Gate v0');
  });

  it('blocks PRs while GitHub mergeability is still unknown', () => {
    const evaluation = evaluatePullRequestForMerge(
      {
        base: {
          ref: 'main',
          repo: { full_name: 'governada/app' },
        },
        body: '## Review Gate v0\nReview tier: L3\nFindings fixed: none\n',
        draft: false,
        head: {
          ref: 'feat/example',
          repo: { full_name: 'governada/app' },
          sha: SHA,
        },
        mergeable_state: null,
        number: 913,
        state: 'open',
      },
      SHA,
    );

    expect(evaluation.blockers).toContain('PR #913 mergeable_state is unknown');
  });

  it('requires successful checks and statuses before merge', () => {
    const passing = evaluateGithubChecksForMerge({
      checkRuns: [
        { conclusion: 'success', name: 'format', status: 'completed' },
        { conclusion: 'skipped', name: 'optional', status: 'completed' },
      ],
      combinedStatus: {
        state: 'success',
        statuses: [{ context: 'legacy', state: 'success' }],
      },
    });
    const failing = evaluateGithubChecksForMerge({
      checkRuns: [{ conclusion: 'failure', name: 'test', status: 'completed' }],
      combinedStatus: {
        state: 'failure',
        statuses: [{ context: 'legacy', state: 'failure' }],
      },
    });
    const missing = evaluateGithubChecksForMerge({ checkRuns: [], combinedStatus: {} });
    const truncated = evaluateGithubChecksForMerge({
      checkRuns: [{ conclusion: 'success', name: 'format', status: 'completed' }],
      checkRunsTotalCount: 2,
      combinedStatus: {
        state: 'success',
        statuses: [],
      },
    });
    const actionsOnly = evaluateGithubChecksForMerge({
      checkRuns: [{ conclusion: 'success', name: 'CI', status: 'completed' }],
      combinedStatus: {
        state: 'pending',
        statuses: [],
      },
    });

    expect(passing.blockers).toEqual([]);
    expect(passing.passes).toEqual(['3 check/status result(s) are green']);
    expect(actionsOnly.blockers).toEqual([]);
    expect(actionsOnly.passes).toEqual(['1 check/status result(s) are green']);
    expect(failing.blockers).toContain('check run "test" concluded failure');
    expect(failing.blockers).toContain('combined commit status is failure');
    expect(missing.blockers).toEqual([
      'no check runs or commit statuses were found for the expected head',
    ]);
    expect(truncated.blockers).toContain(
      'check runs response is truncated (1/2); paginate before merge',
    );
  });

  it('uses the newest check run for repeated check names', () => {
    const staleFailureThenPass = evaluateGithubChecksForMerge({
      checkRuns: [
        {
          completed_at: '2026-04-27T21:00:41Z',
          conclusion: 'success',
          id: 3,
          name: 'validate-pr-body',
          status: 'completed',
        },
        {
          completed_at: '2026-04-26T20:13:11Z',
          conclusion: 'failure',
          id: 2,
          name: 'validate-pr-body',
          status: 'completed',
        },
        {
          completed_at: '2026-04-26T20:13:09Z',
          conclusion: 'failure',
          id: 1,
          name: 'validate-pr-body',
          status: 'completed',
        },
        {
          completed_at: '2026-04-26T20:15:14Z',
          conclusion: 'success',
          id: 4,
          name: 'test',
          status: 'completed',
        },
      ],
      combinedStatus: {
        state: 'pending',
        statuses: [],
      },
    });
    const newerFailure = evaluateGithubChecksForMerge({
      checkRuns: [
        {
          completed_at: '2026-04-27T21:00:41Z',
          conclusion: 'failure',
          id: 3,
          name: 'validate-pr-body',
          status: 'completed',
        },
        {
          completed_at: '2026-04-26T20:13:11Z',
          conclusion: 'success',
          id: 2,
          name: 'validate-pr-body',
          status: 'completed',
        },
      ],
      combinedStatus: {
        state: 'pending',
        statuses: [],
      },
    });

    expect(staleFailureThenPass.blockers).toEqual([]);
    expect(staleFailureThenPass.passes).toEqual(['2 check/status result(s) are green']);
    expect(newerFailure.blockers).toContain('check run "validate-pr-body" concluded failure');
  });

  it('keeps post-merge behavior on read-only deploy verification', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/github-merge.mjs'), 'utf8');

    expect(source).toContain("['run', 'deploy:verify', '--', `--expected-sha=${mergeSha}`]");
    expect(source).toContain('MERGED_VERIFY_TIMEOUT');
    expect(source).toContain('Follow up with: npm run deploy:verify -- --expected-sha=${mergeSha}');
    expect(source).not.toContain('railway up');
    expect(source).not.toContain('inngest:register');
    expect(source).not.toContain('sync:');
  });

  it('prints the exact merge approval prompt from the pre-merge check', () => {
    const source = readFileSync(path.join(repoRoot, 'scripts/pre-merge-check.js'), 'utf8');

    expect(source).toContain('Exact merge approval prompt:');
    expect(source).toContain('buildGithubMergeApprovalPrompt');
    expect(source).toContain('blockIfReviewGateRequiresAction');
    expect(source).toContain('PR #${prNumber} is draft or draft state is unknown');
    expect(source).toContain('PR #${prNumber} body does not record completed Review Gate v0');
    expect(source).toContain('getPullRequestHeadSha');
  });

  it('recognizes the required Review Gate v0 body shape and redacts merge plans', () => {
    const root = tempRepoRoot();
    const plan = buildGithubMergePlan(
      parseGithubMergeArgs(['--pr', '913', '--expected-head', SHA]),
      root,
    );

    expect(hasReviewGateRecord('Review Gate v0\nReview tier: L4\nFindings deferred: none')).toBe(
      true,
    );
    expect(hasReviewGateRecord('Review Gate v0\nNo tier here')).toBe(false);
    expect(
      hasReviewGateRecord(
        '## Review Gate v0\n\n- **Review tier**: L2\n- **Findings**: Independent Review Gate v0 should still run before merge.',
      ),
    ).toBe(false);
    expect(
      hasReviewGateRecord(
        '## Review Gate v0\n\n- **Review tier**: L2\n- **Findings**: Review Gate v0 still needs to run before merge.',
      ),
    ).toBe(false);
    expect(redactGithubMergePlan(plan)).toMatchObject({
      body: {
        merge_method: 'squash',
        sha: SHA,
      },
      path: '/repos/governada/app/pulls/913/merge',
    });
  });
});
