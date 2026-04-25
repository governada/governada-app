const fs = require('node:fs');
const path = require('node:path');

const { sendNotification } = require('./notify.js');
const { loadLocalEnv, repoRoot, runCommand, runGh, runGhJson, sleep } = require('./lib/runtime');

loadLocalEnv();

const args = process.argv.slice(2);
const revertCommit = args.includes('--revert-commit');
const force = args.includes('--force');

const repo = 'governada/app';
const prodUrl = 'https://governada.io';
const healthEndpoint = '/api/health';
const maxWaitSeconds = 300;
const pollIntervalSeconds = 10;

async function getHealth() {
  const response = await fetch(`${prodUrl}${healthEndpoint}`, {
    method: 'GET',
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);

  if (!response) {
    return { httpCode: '000', status: 'unreachable' };
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    httpCode: String(response.status),
    status: body.status || 'unknown',
  };
}

function shortSha(sha) {
  return sha ? sha.slice(0, 7) : 'unknown';
}

async function createRevertPr(currentSha, currentMessage) {
  const branchName = `rollback-${shortSha(currentSha)}-${Date.now()}`;
  const worktreePath = path.join(repoRoot, '.claude', 'worktrees', branchName);

  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

  const fetchResult = runCommand('git', ['fetch', 'origin', 'main']);
  if (fetchResult.status !== 0) {
    throw new Error((fetchResult.stderr || fetchResult.stdout || 'git fetch failed').trim());
  }

  const addWorktree = runCommand('git', [
    'worktree',
    'add',
    worktreePath,
    '-b',
    branchName,
    'origin/main',
  ]);
  if (addWorktree.status !== 0) {
    throw new Error((addWorktree.stderr || addWorktree.stdout || 'git worktree add failed').trim());
  }

  try {
    const revertResult = runCommand('git', ['revert', '--no-edit', 'HEAD'], { cwd: worktreePath });
    if (revertResult.status !== 0) {
      throw new Error((revertResult.stderr || revertResult.stdout || 'git revert failed').trim());
    }

    const pushResult = runCommand('git', ['push', '-u', 'origin', branchName], {
      cwd: worktreePath,
    });
    if (pushResult.status !== 0) {
      throw new Error((pushResult.stderr || pushResult.stdout || 'git push failed').trim());
    }

    const createPr = runGh([
      'pr',
      'create',
      '--repo',
      repo,
      '--title',
      `revert: rollback ${shortSha(currentSha)} (${currentMessage})`,
      '--body',
      `Automated rollback of ${shortSha(currentSha)} due to production failure.\n\nOriginal: ${currentMessage}`,
      '--head',
      branchName,
      '--base',
      'main',
    ]);

    if (createPr.status !== 0) {
      throw new Error((createPr.stderr || createPr.stdout || 'gh pr create failed').trim());
    }

    return createPr.stdout.trim();
  } finally {
    runCommand('git', ['worktree', 'remove', worktreePath, '--force']);
  }
}

async function main() {
  console.log('=== Governada Rollback ===');
  console.log('');

  console.log('Step 1: Checking current production health...');
  const currentHealth = await getHealth();

  if (currentHealth.httpCode === '200' && currentHealth.status === 'healthy' && !force) {
    console.log(
      `Production appears healthy (HTTP ${currentHealth.httpCode}, status=${currentHealth.status}).`,
    );
    console.log('Are you sure you want to rollback? Use --force to override.');
    process.exit(0);
  }

  console.log(
    `Production is unhealthy: HTTP ${currentHealth.httpCode}, status=${currentHealth.status}`,
  );
  console.log('');

  console.log('Step 2: Identifying commits...');
  const currentCommit = runGhJson(['api', `repos/${repo}/commits/main`]);
  const commitList = runGhJson(['api', `repos/${repo}/commits?sha=main&per_page=2`]);
  const currentSha = currentCommit.sha;
  const previousSha = commitList[1] ? commitList[1].sha : '';
  const currentMessage = (currentCommit.commit?.message || '').split('\n')[0];

  console.log(`  Current (broken): ${shortSha(currentSha)} - ${currentMessage}`);
  console.log(`  Previous (target): ${shortSha(previousSha)}`);
  console.log('');

  let rollbackPrUrl = '';
  if (revertCommit) {
    console.log('Step 3: Creating rollback PR...');
    rollbackPrUrl = await createRevertPr(currentSha, currentMessage);
    console.log(`  Created rollback PR: ${rollbackPrUrl}`);
  } else {
    console.log('Step 3: Skipping git revert (use --revert-commit to create a rollback PR)');
  }

  console.log('');
  console.log('Step 4: Triggering Railway redeploy...');
  const railwayCheck = runCommand('railway', ['--version']);
  if (railwayCheck.status === 0) {
    console.log('  Using Railway CLI...');
    const redeploy = runCommand('railway', ['redeploy', '--yes']);
    if (redeploy.status !== 0) {
      console.log(
        '  Railway CLI redeploy sent but returned a non-zero status; verify manually if needed.',
      );
    }
  } else {
    console.log(
      '  Railway CLI not found. Railway will auto-redeploy when the revert reaches main.',
    );
    console.log('  If you need immediate rollback, use the Railway dashboard.');
  }

  console.log('');
  console.log('Step 5: Waiting for production to recover...');
  let elapsed = 0;
  let recovered = false;
  let finalHealth = currentHealth;

  while (elapsed < maxWaitSeconds) {
    await sleep(pollIntervalSeconds * 1000);
    elapsed += pollIntervalSeconds;

    finalHealth = await getHealth();
    console.log(`  [${elapsed}s] HTTP ${finalHealth.httpCode}, status=${finalHealth.status}`);

    if (finalHealth.httpCode === '200' && !['error', 'unreachable'].includes(finalHealth.status)) {
      recovered = true;
      break;
    }
  }

  console.log('');

  if (recovered) {
    console.log('=== ROLLBACK SUCCESSFUL ===');
    console.log(`Production recovered after ${elapsed}s`);

    const issueBody = [
      '## Automated Rollback',
      '',
      `**Broken commit:** \`${shortSha(currentSha)}\` - ${currentMessage}`,
      `**Rolled back to:** \`${shortSha(previousSha)}\``,
      `**Recovery time:** ${elapsed}s`,
      `**Health status:** ${finalHealth.status}`,
      rollbackPrUrl ? `**Rollback PR:** ${rollbackPrUrl}` : null,
      '',
      '### Action Required',
      '- [ ] Investigate root cause of the broken deploy',
      '- [ ] Fix the issue and re-deploy via normal PR pipeline',
      '- [ ] Close this issue when resolved',
    ]
      .filter(Boolean)
      .join('\n');

    const issueResult = runGh([
      'issue',
      'create',
      '--repo',
      repo,
      '--title',
      `Rollback: ${shortSha(currentSha)} broke production`,
      '--body',
      issueBody,
      '--label',
      'bug,urgent',
    ]);

    const issueUrl = issueResult.status === 0 ? issueResult.stdout.trim() : 'issue creation failed';
    console.log(`Issue: ${issueUrl}`);

    await sendNotification(
      'complete',
      'Production rollback successful',
      `Reverted ${shortSha(currentSha)} (${currentMessage}). Recovery time: ${elapsed}s. Issue: ${issueUrl}`,
    ).catch(() => false);

    return;
  }

  console.log('=== ROLLBACK FAILED ===');
  console.log(`Production did not recover within ${maxWaitSeconds}s`);
  console.log('MANUAL INTERVENTION REQUIRED');

  await sendNotification(
    'deploy_blocked',
    'Rollback FAILED - manual intervention needed',
    `Attempted to rollback ${shortSha(currentSha)} but production is still unhealthy after ${maxWaitSeconds}s. Check Railway immediately.`,
  ).catch(() => false);

  process.exit(1);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  await sendNotification('deploy_blocked', 'Rollback failed to execute', message).catch(
    () => false,
  );
  process.exit(1);
});
