import { spawnSync } from 'node:child_process';

import {
  EXPECTED_REPO,
  GITHUB_OPERATION_CLASSES,
  githubApiErrorMessage,
  redactSensitiveText,
} from './lib/github-app-auth.mjs';
import { callGithubBroker, isGithubBrokerAvailable } from './lib/github-broker-client.mjs';
import {
  buildGithubShipPlan,
  parseGithubShipArgs,
  printGithubShipUsage,
} from './lib/github-ship.mjs';
import { getScriptContext } from './lib/runtime.mjs';
import { formatSecretScanFindings, scanGitHubShipContentForSecrets } from './lib/secret-scan.mjs';

function pass(message) {
  console.log(`OK: ${message}`);
}

function block(blockers, message) {
  blockers.push(message);
  console.log(`BLOCKED: ${message}`);
}

async function main() {
  const blockers = [];
  const { repoRoot } = getScriptContext(import.meta.url);
  const parsedArgs = parseGithubShipArgs(process.argv.slice(2));
  if (parsedArgs.help) {
    printGithubShipUsage();
    return;
  }

  const plan = buildGithubShipPlan(parsedArgs);
  const localPlan = buildLocalGitPublishPlan(repoRoot, plan);

  console.log('GitHub ship: Governada autonomous GitHub App lane');
  console.log('Capability: github.app.installation.governada.pilot');
  console.log(`Operation class: ${GITHUB_OPERATION_CLASSES.shipPr}`);
  console.log(
    `Mutation policy: ${plan.execute ? 'execute explicitly requested' : 'dry-run only; no GitHub write endpoint is called'}`,
  );
  console.log(`Planned operation: ${plan.description}`);
  console.log(`Changed paths: ${localPlan.entries.length}`);

  if (!plan.execute) {
    for (const entry of localPlan.entries) {
      console.log(`  ${entry.action}: ${entry.path}`);
    }
    console.log('');
    console.log('GitHub ship result: DRY_RUN');
    return;
  }

  if (!isGithubBrokerAvailable(repoRoot)) {
    block(
      blockers,
      'GitHub runtime broker socket is not available; start npm run github:runtime-broker from a human Terminal before live branch publish',
    );
  } else {
    pass('GitHub runtime broker socket is available');
  }

  if (blockers.length === 0) {
    await publishBranchThroughBroker({ blockers, localPlan, plan, repoRoot });
  }

  console.log('');
  if (blockers.length > 0) {
    console.log(`GitHub ship result: BLOCKED (${blockers.length})`);
    process.exit(1);
  }

  console.log('GitHub ship result: OK');
}

function buildLocalGitPublishPlan(repoRoot, plan) {
  const status = gitText(repoRoot, ['status', '--porcelain']);
  if (status) {
    throw new Error(
      'github.ship.pr publish requires a clean worktree; commit or discard changes first',
    );
  }

  const baseSha = gitText(repoRoot, ['rev-parse', plan.base]);
  const headSha = gitText(repoRoot, ['rev-parse', 'HEAD']);
  const baseTreeSha = gitText(repoRoot, ['rev-parse', `${baseSha}^{tree}`]);
  if (baseSha === headSha) {
    throw new Error('github.ship.pr publish has no commits beyond origin/main');
  }

  const entries = readDiffEntries(repoRoot, baseSha);
  if (entries.length === 0) {
    throw new Error('github.ship.pr publish has no file changes to publish');
  }

  return {
    baseSha,
    baseTreeSha,
    entries,
    headSha,
  };
}

function readDiffEntries(repoRoot, baseSha) {
  const diff = gitBuffer(repoRoot, ['diff', '--name-status', '-z', `${baseSha}..HEAD`]);
  const parts = diff.toString('utf8').split('\0').filter(Boolean);
  const entries = [];

  for (let index = 0; index < parts.length; ) {
    const status = parts[index];
    index += 1;

    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = parts[index];
      const newPath = parts[index + 1];
      index += 2;
      entries.push({ action: 'delete', path: oldPath });
      entries.push(readUpsertEntry(repoRoot, newPath));
      continue;
    }

    const filePath = parts[index];
    index += 1;
    if (status.startsWith('D')) {
      entries.push({ action: 'delete', path: filePath });
    } else {
      entries.push(readUpsertEntry(repoRoot, filePath));
    }
  }

  return entries;
}

function readUpsertEntry(repoRoot, filePath) {
  const mode = readGitFileMode(repoRoot, filePath);
  const content = gitBuffer(repoRoot, ['show', `HEAD:${filePath}`]);
  const maxBytes = 1024 * 1024;
  if (content.byteLength > maxBytes) {
    throw new Error(`github.ship.pr publish refuses files over 1 MiB: ${filePath}`);
  }

  const secretScanFindings = scanGitHubShipContentForSecrets({ content, filePath });
  if (secretScanFindings.length > 0) {
    throw new Error(
      `github.ship.pr publish blocked likely secret material: ${formatSecretScanFindings(secretScanFindings)}`,
    );
  }

  return {
    action: 'upsert',
    contentBase64: content.toString('base64'),
    mode,
    path: filePath,
  };
}

function readGitFileMode(repoRoot, filePath) {
  const output = gitText(repoRoot, ['ls-tree', 'HEAD', '--', filePath]);
  const mode = output.split(/\s+/u)[0];
  if (!/^(100644|100755|120000)$/u.test(mode)) {
    throw new Error(`github.ship.pr publish does not support file mode ${mode} for ${filePath}`);
  }

  return mode;
}

async function publishBranchThroughBroker({ blockers, localPlan, plan, repoRoot }) {
  const remoteBranch = await brokerApi({
    path: `/repos/${EXPECTED_REPO}/git/ref/heads/${plan.head}`,
    repoRoot,
  });
  const branchExists = remoteBranch.ok;

  if (!remoteBranch.ok && remoteBranch.status !== 404) {
    block(
      blockers,
      githubApiErrorMessage(remoteBranch, `remote branch read failed for ${plan.head}`),
    );
    return;
  }

  const parentSha = branchExists ? remoteBranch.data?.object?.sha : localPlan.baseSha;
  if (!parentSha) {
    block(blockers, `remote branch ${plan.head} did not return a parent SHA`);
    return;
  }

  const baseTreeSha = branchExists
    ? await readRemoteCommitTreeSha({ blockers, repoRoot, sha: parentSha })
    : localPlan.baseTreeSha;
  if (!baseTreeSha) {
    return;
  }

  const treeEntries = [];
  for (const entry of localPlan.entries) {
    if (entry.action === 'delete') {
      treeEntries.push({
        path: entry.path,
        sha: null,
      });
      continue;
    }

    const blob = await brokerApi({
      body: {
        content: entry.contentBase64,
        encoding: 'base64',
      },
      method: 'POST',
      path: `/repos/${EXPECTED_REPO}/git/blobs`,
      repoRoot,
    });
    if (!blob.ok || !blob.data?.sha) {
      block(blockers, githubApiErrorMessage(blob, `blob create failed for ${entry.path}`));
      return;
    }

    treeEntries.push({
      mode: entry.mode,
      path: entry.path,
      sha: blob.data.sha,
      type: 'blob',
    });
  }

  const tree = await brokerApi({
    body: {
      base_tree: baseTreeSha,
      tree: treeEntries,
    },
    method: 'POST',
    path: `/repos/${EXPECTED_REPO}/git/trees`,
    repoRoot,
  });
  if (!tree.ok || !tree.data?.sha) {
    block(blockers, githubApiErrorMessage(tree, 'tree create failed'));
    return;
  }

  const commit = await brokerApi({
    body: {
      message: `chore: publish ${plan.head}`,
      parents: [parentSha],
      tree: tree.data.sha,
    },
    method: 'POST',
    path: `/repos/${EXPECTED_REPO}/git/commits`,
    repoRoot,
  });
  if (!commit.ok || !commit.data?.sha) {
    block(blockers, githubApiErrorMessage(commit, 'commit create failed'));
    return;
  }

  const refUpdate = branchExists
    ? await brokerApi({
        body: {
          force: false,
          sha: commit.data.sha,
        },
        method: 'PATCH',
        path: `/repos/${EXPECTED_REPO}/git/refs/heads/${plan.head}`,
        repoRoot,
      })
    : await brokerApi({
        body: {
          ref: `refs/heads/${plan.head}`,
          sha: commit.data.sha,
        },
        method: 'POST',
        path: `/repos/${EXPECTED_REPO}/git/refs`,
        repoRoot,
      });

  if (!refUpdate.ok) {
    block(blockers, githubApiErrorMessage(refUpdate, `branch publish failed for ${plan.head}`));
    return;
  }

  pass(`published ${plan.head} at ${commit.data.sha}`);
}

async function readRemoteCommitTreeSha({ blockers, repoRoot, sha }) {
  const commit = await brokerApi({
    path: `/repos/${EXPECTED_REPO}/git/commits/${sha}`,
    repoRoot,
  });
  if (!commit.ok || !commit.data?.tree?.sha) {
    block(blockers, githubApiErrorMessage(commit, `remote commit read failed for ${sha}`));
    return '';
  }

  return commit.data.tree.sha;
}

async function brokerApi({ body = undefined, method = 'GET', path, repoRoot }) {
  return callGithubBroker({
    repoRoot,
    request: {
      body,
      kind: 'github-api',
      method,
      operationClass: GITHUB_OPERATION_CLASSES.shipPr,
      path,
    },
  });
}

function gitText(repoRoot, args) {
  return gitBuffer(repoRoot, args).toString('utf8').trim();
}

function gitBuffer(repoRoot, args) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const detail =
      `${result.stdout?.toString?.() || ''}${result.stderr?.toString?.() || ''}`.trim();
    throw new Error(redactSensitiveText(detail || `git ${args.join(' ')} failed`));
  }

  return result.stdout;
}

main().catch((error) => {
  console.error(`BLOCKED: ${redactSensitiveText(error?.message || String(error))}`);
  console.error('');
  console.error('GitHub ship result: BLOCKED (1)');
  process.exit(1);
});
