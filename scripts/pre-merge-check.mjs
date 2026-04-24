import { commandOutput, getScriptContext, ghJson, ghOutput, requireArg } from './lib/runtime.mjs';

const prNumber = Number.parseInt(
  requireArg(process.argv.slice(2), 0, 'pre-merge-check.mjs <pr-number>'),
  10,
);
const repo = 'governada/governada-app';
const baseBranch = 'main';
const { repoRoot } = getScriptContext(import.meta.url);

console.log(`Checking merge safety for PR #${prNumber}...`);

const otherPrs = ghJson(
  [
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
  ],
  { cwd: repoRoot },
).filter((pr) => pr.number !== prNumber);

if (otherPrs.length > 0) {
  console.log('');
  console.log(`WARNING: Other open PRs targeting ${baseBranch}:`);
  for (const pr of otherPrs) {
    console.log(`  #${pr.number} ${pr.title} (updated ${pr.updatedAt})`);
  }
  console.log('');
}

const recentRuns = ghJson(
  [
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
  ],
  { cwd: repoRoot },
).filter((run) => run.status === 'in_progress' || run.status === 'queued');

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

const { mergeStateStatus } = ghJson(
  ['pr', 'view', `${prNumber}`, '--repo', repo, '--json', 'mergeStateStatus'],
  { cwd: repoRoot },
);

if (mergeStateStatus === 'BEHIND') {
  console.log('');
  console.log('WARNING: Branch is behind main - rebase first');
  console.log('');
} else if (mergeStateStatus === 'DIRTY') {
  console.log('');
  console.log('BLOCKED: Branch has merge conflicts - rebase required');
  process.exit(1);
}

const prStatus = ghOutput(['pr', 'checks', `${prNumber}`, '--repo', repo], {
  allowFailure: true,
  cwd: repoRoot,
});

if (/fail/i.test(prStatus)) {
  console.log('');
  console.log(`BLOCKED: PR #${prNumber} has failing checks:`);
  console.log(prStatus);
  process.exit(1);
}

console.log('');
console.log('Checking production error rate...');

try {
  const errorRateOutput = commandOutput('node', ['scripts/check-error-rate.mjs'], {
    cwd: repoRoot,
  });

  if (errorRateOutput) {
    console.log(errorRateOutput);
  }
} catch {
  console.log('');
  console.log(
    'BLOCKED: Production error rate is elevated - fix existing issues before merging new changes.',
  );
  process.exit(1);
}

console.log(`OK: Safe to merge PR #${prNumber}.`);
