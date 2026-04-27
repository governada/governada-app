import { describe, expect, it } from 'vitest';

import { GITHUB_OPERATION_CLASSES } from '@/scripts/lib/github-app-auth.mjs';
import { assertGithubBrokerRequestAllowed } from '@/scripts/lib/github-broker-policy.mjs';

const SHA = '1234567890abcdef1234567890abcdef12345678';
const approvalText = `I approve github.merge for governada/app PR #913 if checks are green and the head SHA ${SHA} is unchanged.`;
const closeApprovalText = `I approve github.pr.close for governada/app PR #891 at expected head ${SHA}.`;

describe('github runtime broker policy', () => {
  it('allows bounded ship PR requests and branch ref updates without force', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          base: 'main',
          draft: true,
          head: 'codex/example',
          maintainer_can_modify: false,
          title: 'Example',
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/pulls',
      }),
    ).not.toThrow();

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          force: false,
          sha: '1234567890abcdef1234567890abcdef12345678',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/refs/heads/codex/example',
      }),
    ).not.toThrow();

    expect(() =>
      assertGithubBrokerRequestAllowed({
        kind: 'github-api',
        method: 'GET',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/ref/heads/feat/example',
      }),
    ).not.toThrow();
  });

  it('rejects ship PR requests outside same-repo branch and draft policy', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          base: 'main',
          draft: false,
          head: 'someone:branch',
          maintainer_can_modify: true,
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/pulls',
      }),
    ).toThrow('github.ship.pr PR head must be same-repository codex/* or feat/*');

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          force: true,
          sha: '1234567890abcdef1234567890abcdef12345678',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/refs/heads/codex/example',
      }),
    ).toThrow('github.ship.pr branch updates must not force push');
  });

  it('allows merge only through the PR merge endpoint and blocks broader mutation', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        kind: 'github-api',
        method: 'GET',
        operationClass: GITHUB_OPERATION_CLASSES.merge,
        path: '/repos/governada/app/pulls?state=open&per_page=1',
      }),
    ).not.toThrow();

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          merge_method: 'squash',
          sha: SHA,
        },
        kind: 'github-api',
        mergeApproval: {
          approvalText,
          expectedHead: SHA,
          prNumber: 913,
        },
        method: 'PUT',
        operationClass: GITHUB_OPERATION_CLASSES.merge,
        path: '/repos/governada/app/pulls/913/merge',
      }),
    ).not.toThrow();

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          merge_method: 'squash',
          sha: SHA,
        },
        kind: 'github-api',
        method: 'PUT',
        operationClass: GITHUB_OPERATION_CLASSES.merge,
        path: '/repos/governada/app/pulls/913/merge',
      }),
    ).toThrow('github.merge broker request must include matching PR approval proof');

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          environment: 'production',
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.merge,
        path: '/repos/governada/app/deployments',
      }),
    ).toThrow('github.merge broker request is not allowed');
  });

  it('allows PR close only through a state=closed patch with approval proof', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          state: 'closed',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.prClose,
        path: '/repos/governada/app/pulls/891',
        prCloseApproval: {
          approvalText: closeApprovalText,
          expectedHead: SHA,
          prNumber: 891,
        },
      }),
    ).not.toThrow();

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          state: 'open',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.prClose,
        path: '/repos/governada/app/pulls/891',
        prCloseApproval: {
          approvalText: closeApprovalText,
          expectedHead: SHA,
          prNumber: 891,
        },
      }),
    ).toThrow('github.pr.close may only set state=closed');

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          body: 'nope',
          state: 'closed',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.prClose,
        path: '/repos/governada/app/pulls/891',
        prCloseApproval: {
          approvalText: closeApprovalText,
          expectedHead: SHA,
          prNumber: 891,
        },
      }),
    ).toThrow('github.pr.close may only set state=closed');

    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          state: 'closed',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.prClose,
        path: '/repos/governada/app/pulls/891',
        prCloseApproval: {
          approvalText: closeApprovalText,
          expectedHead: SHA,
          prNumber: 887,
        },
      }),
    ).toThrow('github.pr.close broker request must include matching PR approval proof');
  });

  it('rejects token-like payloads and requests outside governada/app', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          body: 'token ghs_secret',
        },
        kind: 'github-api',
        method: 'PATCH',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/pulls/913',
      }),
    ).toThrow('broker request payload must not include token-like or secret reference values');

    expect(() =>
      assertGithubBrokerRequestAllowed({
        kind: 'github-api',
        method: 'GET',
        operationClass: GITHUB_OPERATION_CLASSES.read,
        path: '/repos/bluecargo/app',
      }),
    ).toThrow('broker request path is outside governada/app');
  });

  it('allows non-secret Git blob payloads and rejects secret-like blob contents', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          content: Buffer.from('example op://placeholder and ghs_test fixture text').toString(
            'base64',
          ),
          encoding: 'base64',
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/blobs',
      }),
    ).not.toThrow();

    const githubToken = ['ghp', '_123456789012345678901234567890123456'].join('');
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          content: Buffer.from(`GITHUB_TOKEN=${githubToken}`).toString('base64'),
          encoding: 'base64',
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/blobs',
      }),
    ).toThrow('broker blob payload must not include likely secret material');
  });

  it('rejects risky tree paths before brokered branch publication', () => {
    expect(() =>
      assertGithubBrokerRequestAllowed({
        body: {
          base_tree: SHA,
          tree: [
            {
              mode: '100644',
              path: '.env.local',
              sha: SHA,
              type: 'blob',
            },
          ],
        },
        kind: 'github-api',
        method: 'POST',
        operationClass: GITHUB_OPERATION_CLASSES.shipPr,
        path: '/repos/governada/app/git/trees',
      }),
    ).toThrow('github.ship.pr tree entry path is blocked');
  });
});
