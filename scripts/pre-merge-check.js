const { checkErrorRate } = require('./check-error-rate.js');
const { evaluateGithubChecks } = require('./lib/github-check-evaluation.cjs');
const { repoRoot, runGh, runGhJson } = require('./lib/runtime');

const prNumberArg = process.argv[2];
if (!prNumberArg) {
  console.error('Usage: node scripts/pre-merge-check.js <pr-number>');
  process.exit(1);
}

const prNumber = Number(prNumberArg);
if (!Number.isInteger(prNumber) || prNumber <= 0) {
  console.error(`Invalid PR number: ${prNumberArg}`);
  process.exit(1);
}

const repo = 'governada/app';
const baseBranch = 'main';

async function main() {
  console.log(`Checking merge safety for PR #${prNumber}...`);
  const github = await buildGithubReader();
  const { buildGithubMergeApprovalPrompt } = await import('./lib/github-merge-approval.mjs');
  const { hasReviewGateRecord } = await import('./lib/github-merge.mjs');
  console.log(`GitHub auth source: ${github.source}`);

  const otherPrs = (await github.listPullRequests())
    .filter((pr) => Number(pr.number) !== prNumber)
    .map((pr) => ({
      number: pr.number,
      title: pr.title,
      updatedAt: pr.updatedAt || pr.updated_at || 'unknown',
    }));

  reportOtherPullRequests(otherPrs);

  const recentRuns = (await github.listMainRuns()).filter(
    (run) => run.status === 'in_progress' || run.status === 'queued',
  );

  blockIfMainCiIsRunning(recentRuns);

  const prView = await github.getPullRequest(prNumber);
  blockIfReviewGateRequiresAction(prView, hasReviewGateRecord);
  blockIfMergeStateRequiresAction(prView);

  const checkFailures = await github.getPullRequestCheckFailures(prView);
  if (checkFailures.length > 0) {
    console.log('');
    console.log(`BLOCKED: PR #${prNumber} has failing or incomplete checks:`);
    for (const failure of checkFailures) {
      console.log(`  ${failure}`);
    }
    process.exit(1);
  }

  console.log('');
  const ok = await checkErrorRate();
  if (!ok) {
    console.log('');
    console.log(
      'BLOCKED: Production error rate is elevated - fix existing issues before merging new changes.',
    );
    process.exit(1);
  }

  console.log(`OK: Safe to merge PR #${prNumber}.`);
  const expectedHead = getPullRequestHeadSha(prView);
  if (expectedHead) {
    console.log('');
    console.log('Exact merge approval prompt:');
    console.log(buildGithubMergeApprovalPrompt({ expectedHead, prNumber }));
  }
}

async function buildGithubReader() {
  if (process.env.GOVERNADA_PRE_MERGE_USE_GH === '1') {
    return buildGhReader();
  }

  try {
    return await buildBrokerReader();
  } catch (brokerError) {
    const brokerMessage = brokerError instanceof Error ? brokerError.message : String(brokerError);
    try {
      const reader = buildGhReader();
      reader.listPullRequests();
      console.log(`ADVISORY: GitHub runtime broker unavailable; falling back to GitHub CLI.`);
      return reader;
    } catch (ghError) {
      const ghMessage = ghError instanceof Error ? ghError.message : String(ghError);
      throw new Error(
        `GitHub runtime broker unavailable (${brokerMessage}); GitHub CLI fallback unavailable (${ghMessage})`,
      );
    }
  }
}

async function buildBrokerReader() {
  const [
    { EXPECTED_REPO, GITHUB_OPERATION_CLASSES, githubApiErrorMessage },
    { callGithubBroker },
    { ensureGithubBrokerRunning },
  ] = await Promise.all([
    import('./lib/github-app-auth.mjs'),
    import('./lib/github-broker-client.mjs'),
    import('./lib/github-broker-service.mjs'),
  ]);

  const ensureResult = await ensureGithubBrokerRunning({ repoRoot });
  if (!ensureResult.ok) {
    throw new Error((ensureResult.blockers || []).join('; ') || 'broker ensure failed');
  }

  async function brokerGet(path, label) {
    const response = await callGithubBroker({
      repoRoot,
      request: {
        kind: 'github-api',
        method: 'GET',
        operationClass: GITHUB_OPERATION_CLASSES.read,
        path,
      },
    });

    if (!response.ok) {
      throw new Error(githubApiErrorMessage(response, label));
    }

    return response.data;
  }

  return {
    async getPullRequest(number) {
      return brokerGet(`/repos/${EXPECTED_REPO}/pulls/${number}`, `PR #${number} read failed`);
    },
    async getPullRequestCheckFailures(prView) {
      const headSha = prView?.head?.sha;
      if (!headSha) {
        return ['PR head SHA is missing'];
      }

      const [checkRuns, combinedStatus] = await Promise.all([
        brokerGet(
          `/repos/${EXPECTED_REPO}/commits/${headSha}/check-runs?per_page=100`,
          `check-run read failed for ${headSha}`,
        ),
        brokerGet(
          `/repos/${EXPECTED_REPO}/commits/${headSha}/status`,
          `commit status read failed for ${headSha}`,
        ),
      ]);

      return evaluateCheckFailures({ checkRuns, combinedStatus });
    },
    async listMainRuns() {
      const data = await brokerGet(
        `/repos/${EXPECTED_REPO}/actions/runs?branch=${baseBranch}&per_page=10`,
        `Actions read failed for ${EXPECTED_REPO}:${baseBranch}`,
      );
      return data.workflow_runs || [];
    },
    async listPullRequests() {
      return brokerGet(
        `/repos/${EXPECTED_REPO}/pulls?base=${baseBranch}&state=open&per_page=100`,
        `open PR read failed for ${EXPECTED_REPO}`,
      );
    },
    source: 'GitHub runtime broker',
  };
}

function buildGhReader() {
  return {
    getPullRequest() {
      const view = runGhJson([
        'pr',
        'view',
        String(prNumber),
        '--repo',
        repo,
        '--json',
        [
          'baseRefName',
          'baseRepository',
          'body',
          'headRefName',
          'headRefOid',
          'headRepository',
          'isDraft',
          'mergeStateStatus',
          'number',
          'state',
        ].join(','),
      ]);
      return normalizeGhPullRequest(view);
    },
    getPullRequestCheckFailures() {
      const prChecksResult = runGh(['pr', 'checks', String(prNumber), '--repo', repo]);
      const prChecksOutput = `${prChecksResult.stdout ?? ''}${prChecksResult.stderr ?? ''}`.trim();
      return /fail|pending|queued|in_progress/i.test(prChecksOutput)
        ? prChecksOutput.split(/\r?\n/u).filter(Boolean)
        : [];
    },
    listMainRuns() {
      return runGhJson([
        'run',
        'list',
        '--repo',
        repo,
        '--branch',
        baseBranch,
        '--limit',
        '1',
        '--json',
        'status,conclusion,createdAt',
      ]);
    },
    listPullRequests() {
      return runGhJson([
        'pr',
        'list',
        '--repo',
        repo,
        '--base',
        baseBranch,
        '--state',
        'open',
        '--json',
        'number,title,updatedAt',
      ]);
    },
    source: 'GitHub CLI',
  };
}

function normalizeGhPullRequest(view) {
  return {
    base: {
      ref: view?.baseRefName || '',
      repo: { full_name: view?.baseRepository?.nameWithOwner || '' },
    },
    body: view?.body || '',
    draft: view?.isDraft,
    head: {
      ref: view?.headRefName || '',
      repo: { full_name: view?.headRepository?.nameWithOwner || '' },
      sha: view?.headRefOid || '',
    },
    headRefOid: view?.headRefOid || '',
    mergeStateStatus: view?.mergeStateStatus || '',
    number: view?.number || prNumber,
    state: String(view?.state || '').toLowerCase(),
  };
}

function reportOtherPullRequests(otherPrs) {
  if (otherPrs.length > 0) {
    console.log('');
    console.log(`WARNING: Other open PRs targeting ${baseBranch}:`);
    for (const pr of otherPrs) {
      console.log(`  #${pr.number} ${pr.title} (updated ${pr.updatedAt})`);
    }
    console.log('');
  }
}

function blockIfMainCiIsRunning(recentRuns) {
  if (recentRuns.length > 0) {
    console.log('');
    console.log(`BLOCKED: CI is currently running on ${baseBranch}:`);
    for (const run of recentRuns) {
      console.log(`  CI run in progress (started ${run.createdAt || run.created_at || 'unknown'})`);
    }
    console.log('');
    console.log('Wait for the current CI run to complete before merging.');
    process.exit(1);
  }
}

function blockIfMergeStateRequiresAction(prView) {
  const mergeStateStatus = prView.mergeStateStatus || prView.mergeable_state || '';
  const normalizedState = mergeStateStatus.toUpperCase();

  if (normalizedState === 'BEHIND') {
    console.log('');
    console.log('WARNING: Branch is behind main - rebase first');
    console.log('');
  } else if (normalizedState === 'DIRTY') {
    console.log('');
    console.log('BLOCKED: Branch has merge conflicts - rebase required');
    process.exit(1);
  }
}

function blockIfReviewGateRequiresAction(prView, hasReviewGateRecord) {
  const blockers = [];
  const draftState =
    typeof prView?.draft === 'boolean'
      ? prView.draft
      : typeof prView?.isDraft === 'boolean'
        ? prView.isDraft
        : undefined;

  if (draftState !== false) {
    blockers.push(`PR #${prNumber} is draft or draft state is unknown`);
  }

  if (!hasReviewGateRecord(prView?.body || '')) {
    blockers.push(`PR #${prNumber} body does not record completed Review Gate v0`);
  }

  if (blockers.length === 0) {
    return;
  }

  console.log('');
  console.log(`BLOCKED: PR #${prNumber} is not ready for merge approval:`);
  for (const blocker of blockers) {
    console.log(`  ${blocker}`);
  }
  console.log('');
  console.log('Complete Review Gate v0 and mark the draft PR ready before requesting approval.');
  process.exit(1);
}

function evaluateCheckFailures({ checkRuns, combinedStatus }) {
  const runs = Array.isArray(checkRuns?.check_runs) ? checkRuns.check_runs : [];
  const totalCount = Number.isFinite(Number(checkRuns?.total_count))
    ? Number(checkRuns.total_count)
    : runs.length;

  return evaluateGithubChecks({
    checkRuns: runs,
    checkRunsTotalCount: totalCount,
    combinedStatus,
  }).blockers;
}

function getPullRequestHeadSha(prView) {
  return prView?.head?.sha || prView?.headRefOid || '';
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
