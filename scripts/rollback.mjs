import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  commandOutput,
  fetchWithTimeout,
  getScriptContext,
  ghJson,
  ghOutput,
  normalizeBaseUrl,
} from './lib/runtime.mjs';

const REPO = 'governada/governada-app';
const PROD_URL = 'https://governada.io';
const HEALTH_ENDPOINT = '/api/health';

const argSet = new Set(process.argv.slice(2));
const revertCommit = argSet.has('--revert-commit');
const force = argSet.has('--force');
const dryRun = argSet.has('--dry-run');

const { repoRoot } = getScriptContext(import.meta.url);

async function fetchHealth() {
  const url = `${normalizeBaseUrl(PROD_URL)}${HEALTH_ENDPOINT}`;

  try {
    const response = await fetchWithTimeout(url, {}, 10000);
    let body = {};

    try {
      body = await response.json();
    } catch {
      body = {};
    }

    return {
      httpCode: `${response.status}`,
      healthStatus: body.status ?? 'unknown',
    };
  } catch {
    return {
      httpCode: '000',
      healthStatus: 'unreachable',
    };
  }
}

function ghApi(pathname) {
  return ghJson(['api', pathname], { cwd: repoRoot });
}

function notify(alertType, title, details) {
  commandOutput('node', ['scripts/notify.mjs', alertType, title, details], {
    cwd: repoRoot,
    allowFailure: true,
  });
}

function createRollbackPr(currentSha, currentMessage) {
  const shortSha = currentSha.slice(0, 7);
  const branchName = `rollback-${shortSha}-${Date.now().toString().slice(-6)}`;
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'governada-rollback-'));
  const worktreePath = path.join(tempRoot, 'repo');

  try {
    commandOutput('git', ['worktree', 'add', '-b', branchName, worktreePath, 'origin/main'], {
      cwd: repoRoot,
    });
    commandOutput('git', ['revert', '--no-edit', currentSha], { cwd: worktreePath });
    commandOutput('git', ['push', '-u', 'origin', branchName], { cwd: worktreePath });

    const body = [
      '## Summary',
      '',
      `Automated rollback for \`${shortSha}\` due to production failure.`,
      '',
      '## Existing Code Audit',
      '',
      '- **Searched for**: current main head and prior production commit state',
      `- **Found**: broken deploy rooted at \`${shortSha}\``,
      '- **Decision**: create a revert PR so Railway redeploys from a known-good main branch state',
      '',
      '## Robustness',
      '',
      '- [x] Error states handled',
      '- [x] Loading states meaningful',
      '- [x] Empty states guide users',
      '- [x] Edge cases considered',
      '- [ ] Mobile verified (if UI)',
      '',
      '## Impact',
      '',
      `- **What changed**: Reverts \`${shortSha}\` to recover production.`,
      '- **User-facing**: No direct feature change; this restores the prior known-good behavior.',
      '- **Risk**: High - emergency production rollback.',
      '- **Scope**: main branch revert only.',
    ].join('\n');

    const prUrl = ghOutput(
      [
        'pr',
        'create',
        '--repo',
        REPO,
        '--title',
        `revert: rollback ${shortSha} (${currentMessage})`,
        '--body',
        body,
        '--head',
        branchName,
        '--base',
        'main',
      ],
      { cwd: worktreePath },
    );

    return { branchName, prUrl };
  } finally {
    commandOutput('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: repoRoot,
      allowFailure: true,
    });
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createIncidentIssue({ currentShortSha, currentMessage, currentHealth, rollbackPrUrl }) {
  const body = [
    '## Rollback Required',
    '',
    `**Broken commit:** \`${currentShortSha}\` - ${currentMessage}`,
    `**Observed production health:** HTTP ${currentHealth.httpCode}, status=${currentHealth.healthStatus}`,
    rollbackPrUrl ? `**Revert PR:** ${rollbackPrUrl}` : '**Revert PR:** not created',
    '',
    '## Action Required',
    '',
    '- [ ] Perform a Railway dashboard rollback to the previous successful deployment if immediate recovery is required.',
    '- [ ] Merge the revert PR through the normal protected-main flow.',
    '- [ ] Investigate root cause and land a forward fix before re-deploying.',
  ].join('\n');

  return ghOutput(
    [
      'issue',
      'create',
      '--repo',
      REPO,
      '--title',
      `Rollback required: ${currentShortSha} broke production`,
      '--body',
      body,
      '--label',
      'bug',
      '--label',
      'urgent',
    ],
    { cwd: repoRoot, allowFailure: true },
  );
}

console.log('=== Governada Rollback ===');
console.log('');

console.log('Step 1: Checking current production health...');
const currentHealth = await fetchHealth();

if (currentHealth.httpCode === '200' && currentHealth.healthStatus === 'healthy' && !force) {
  console.log(
    `Production appears healthy (HTTP ${currentHealth.httpCode}, status=${currentHealth.healthStatus}).`,
  );
  console.log('Use --force to continue anyway.');
  process.exit(0);
}

console.log(
  `Production is unhealthy: HTTP ${currentHealth.httpCode}, status=${currentHealth.healthStatus}`,
);
console.log('');

console.log('Step 2: Identifying commits...');
const currentCommit = ghApi(`repos/${REPO}/commits/main`);
const commitList = ghApi(`repos/${REPO}/commits?sha=main&per_page=2`);
const currentSha = currentCommit.sha;
const prevSha = commitList[1]?.sha;
const currentShortSha = currentSha.slice(0, 7);
const prevShortSha = prevSha?.slice(0, 7) ?? 'unknown';
const currentMessage = currentCommit.commit.message.split('\n')[0];

console.log(`  Current (broken): ${currentShortSha} - ${currentMessage}`);
console.log(`  Previous (target): ${prevShortSha}`);
console.log('');

let rollbackPrUrl = '';

if (revertCommit) {
  console.log('Step 3: Reverting HEAD commit on main...');

  if (dryRun) {
    console.log(`  DRY RUN: would create a rollback PR reverting ${currentShortSha}.`);
  } else {
    const rollbackPr = createRollbackPr(currentSha, currentMessage);
    rollbackPrUrl = rollbackPr.prUrl;
    console.log(`  Created rollback PR: ${rollbackPrUrl}`);
  }
} else {
  console.log('Step 3: Skipping git revert (use --revert-commit to auto-revert)');
}

console.log('');
console.log('Step 4: Coordinating rollback...');

if (dryRun) {
  console.log(
    '  DRY RUN: Railway CLI redeploy is intentionally skipped because it only redeploys the latest deployment.',
  );
  console.log(
    '  DRY RUN: immediate recovery still requires a Railway dashboard rollback to a previous successful deployment.',
  );
} else {
  console.log(
    '  Railway CLI redeploy is intentionally skipped because it only redeploys the latest deployment.',
  );
  console.log(
    '  Immediate recovery requires a Railway dashboard rollback to a previous successful deployment.',
  );
  if (rollbackPrUrl) {
    console.log(`  Revert PR ready for protected merge: ${rollbackPrUrl}`);
  } else {
    console.log('  No revert PR was created. Re-run with --revert-commit to prepare one.');
  }
}

console.log('');
console.log('Step 5: Reporting follow-up...');

if (dryRun) {
  console.log('  DRY RUN: skipping issue creation and notifications.');
}

console.log('');

if (dryRun) {
  console.log('=== DRY RUN COMPLETE ===');
  console.log(`Would target broken commit ${currentShortSha} and previous commit ${prevShortSha}.`);
  process.exit(0);
}

const issueUrl = createIncidentIssue({
  currentShortSha,
  currentMessage,
  currentHealth,
  rollbackPrUrl,
});

console.log('=== ROLLBACK REQUIRES FOLLOW-UP ===');
console.log('Immediate platform recovery is still required.');
console.log(`Issue: ${issueUrl || 'issue creation failed'}`);

notify(
  'deploy_blocked',
  'Rollback requires manual platform action',
  `Production is unhealthy on ${currentShortSha}. ${rollbackPrUrl ? `Revert PR: ${rollbackPrUrl}. ` : ''}Use the Railway dashboard to roll back to the previous successful deployment immediately. Issue: ${issueUrl || 'issue creation failed'}`,
);

process.exit(1);
