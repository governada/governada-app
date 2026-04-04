const { checkErrorRate } = require('./check-error-rate.js');
const { runGh, runGhJson } = require('./lib/runtime');

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

const repo = 'governada/governada-app';
const baseBranch = 'main';

async function main() {
  console.log(`Checking merge safety for PR #${prNumber}...`);

  const otherPrs = runGhJson([
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
  ]).filter((pr) => pr.number !== prNumber);

  if (otherPrs.length > 0) {
    console.log('');
    console.log(`WARNING: Other open PRs targeting ${baseBranch}:`);
    for (const pr of otherPrs) {
      console.log(`  #${pr.number} ${pr.title} (updated ${pr.updatedAt})`);
    }
    console.log('');
  }

  const recentRuns = runGhJson([
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
  ]).filter((run) => run.status === 'in_progress' || run.status === 'queued');

  if (recentRuns.length > 0) {
    console.log('');
    console.log(`BLOCKED: CI is currently running on ${baseBranch}:`);
    for (const run of recentRuns) {
      console.log(`  CI run in progress (started ${run.createdAt})`);
    }
    console.log('');
    console.log('Wait for the current CI run to complete before merging.');
    process.exit(1);
  }

  const prView = runGhJson([
    'pr',
    'view',
    String(prNumber),
    '--repo',
    repo,
    '--json',
    'mergeStateStatus',
  ]);

  if (prView.mergeStateStatus === 'BEHIND') {
    console.log('');
    console.log('WARNING: Branch is behind main - rebase first');
    console.log('');
  } else if (prView.mergeStateStatus === 'DIRTY') {
    console.log('');
    console.log('BLOCKED: Branch has merge conflicts - rebase required');
    process.exit(1);
  }

  const prChecksResult = runGh(['pr', 'checks', String(prNumber), '--repo', repo]);
  const prChecksOutput = `${prChecksResult.stdout ?? ''}${prChecksResult.stderr ?? ''}`.trim();
  if (/fail/i.test(prChecksOutput)) {
    console.log('');
    console.log(`BLOCKED: PR #${prNumber} has failing checks:`);
    console.log(prChecksOutput);
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
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
