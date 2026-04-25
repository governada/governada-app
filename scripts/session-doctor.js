const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

const EXPECTED_ORIGIN_REMOTE = 'git@github-governada:governada/app.git';

function parseArgs(argv) {
  const options = {
    strict: false,
  };

  for (const arg of argv) {
    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/session-doctor.js [--strict]');
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function runOrEmpty(command, args, cwd = repoRoot) {
  const result = runCommand(command, args, { cwd });
  return result.status === 0 ? result.stdout.trimEnd() : '';
}

function getTopLevel() {
  return runOrEmpty('git', ['rev-parse', '--show-toplevel']);
}

function getBranch(cwd = repoRoot) {
  const branch = runOrEmpty('git', ['branch', '--show-current'], cwd);
  return branch || '(detached)';
}

function getStatusLines(cwd = repoRoot) {
  const status = runOrEmpty('git', ['status', '--short'], cwd);
  return status ? status.split(/\r?\n/).filter(Boolean) : [];
}

function getStashLines() {
  const stashes = runOrEmpty('git', ['stash', 'list']);
  return stashes ? stashes.split(/\r?\n/).filter(Boolean) : [];
}

function getOriginRemote() {
  return runOrEmpty('git', ['remote', 'get-url', 'origin']);
}

function parseWorktrees() {
  const porcelain = runOrEmpty('git', ['worktree', 'list', '--porcelain']);
  if (!porcelain) {
    return [];
  }

  const worktrees = [];
  for (const block of porcelain.split(/\r?\n\r?\n/).filter(Boolean)) {
    const worktree = { path: '', branch: '(detached)' };
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('worktree ')) {
        worktree.path = line.slice('worktree '.length).trim();
      } else if (line.startsWith('branch ')) {
        worktree.branch = line
          .slice('branch '.length)
          .trim()
          .replace(/^refs\/heads\//, '');
      } else if (line === 'detached') {
        worktree.branch = '(detached)';
      }
    }

    if (worktree.path) {
      worktrees.push(worktree);
    }
  }

  return worktrees;
}

function getSharedCheckoutRoot(topLevel) {
  const commonDir = runOrEmpty(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    topLevel,
  );

  return commonDir ? path.dirname(commonDir) : topLevel;
}

function getOrphanedWorktreeDirectories(worktrees, topLevel) {
  const sharedRoot = getSharedCheckoutRoot(topLevel);
  const worktreesRoot = path.join(sharedRoot, '.claude', 'worktrees');
  if (!fs.existsSync(worktreesRoot)) {
    return [];
  }

  const registeredPaths = new Set(worktrees.map((worktree) => path.resolve(worktree.path)));

  return fs
    .readdirSync(worktreesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(worktreesRoot, entry.name))
    .filter((worktreePath) => !registeredPaths.has(path.resolve(worktreePath)))
    .map((worktreePath) => {
      const gitPointerPath = path.join(worktreePath, '.git');
      const gitStatus = runCommand('git', ['-C', worktreePath, 'status', '--short'], {
        cwd: repoRoot,
      });
      const reason =
        fs.existsSync(gitPointerPath) && gitStatus.status !== 0
          ? 'not registered; git metadata is broken or points outside this checkout'
          : 'not registered by git worktree list';

      return { path: worktreePath, reason };
    });
}

function existsMaybe(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function fileLabel(relativePath) {
  return existsMaybe(relativePath) ? relativePath : `${relativePath} (missing)`;
}

function printSection(title, lines) {
  console.log(`${title}:`);
  if (lines.length === 0) {
    console.log('  - none');
    return;
  }

  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}

function isSharedCheckout(topLevel) {
  const gitDir = runOrEmpty('git', ['rev-parse', '--path-format=absolute', '--git-dir'], topLevel);
  const commonDir = runOrEmpty(
    'git',
    ['rev-parse', '--path-format=absolute', '--git-common-dir'],
    topLevel,
  );

  if (!gitDir || !commonDir) {
    return false;
  }

  return path.resolve(gitDir) === path.resolve(commonDir);
}

function hasGoneUpstream(branch) {
  if (!branch || branch === '(detached)') {
    return false;
  }

  const details = runOrEmpty('git', ['branch', '-vv', '--list', branch]);
  return details.includes(': gone]');
}

function getWorktreeDiagnostics(worktrees, topLevel) {
  const resolvedTopLevel = path.resolve(topLevel);

  return worktrees.map((worktree) => {
    const statusLines = getStatusLines(worktree.path);
    const resolvedPath = path.resolve(worktree.path);

    return {
      ...worktree,
      isCurrent: resolvedPath === resolvedTopLevel,
      dirtyCount: statusLines.length,
      goneUpstream: hasGoneUpstream(worktree.branch),
    };
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const topLevel = getTopLevel() || repoRoot;
  const branch = getBranch();
  const statusLines = getStatusLines();
  const stashLines = getStashLines();
  const originRemote = getOriginRemote();
  const worktrees = parseWorktrees();
  const sharedCheckout = isSharedCheckout(topLevel);
  const checkoutLabel = sharedCheckout ? 'shared checkout' : 'worktree';
  const worktreeDiagnostics = getWorktreeDiagnostics(worktrees, topLevel);
  const orphanedWorktreeDirectories = getOrphanedWorktreeDirectories(worktrees, topLevel);
  const dirtyWorktrees = worktreeDiagnostics.filter(
    (worktree) => worktree.dirtyCount > 0 && !worktree.isCurrent,
  );
  const goneUpstreamWorktrees = worktreeDiagnostics.filter((worktree) => worktree.goneUpstream);
  const blockingIssues = [];
  const advisories = [];

  if (sharedCheckout && !['main', 'master'].includes(branch)) {
    blockingIssues.push(`Shared checkout should stay on main/master. Current branch: ${branch}.`);
  }

  if (statusLines.length > 0) {
    blockingIssues.push(
      `${sharedCheckout ? 'Shared checkout' : 'Current worktree'} has ${statusLines.length} local change(s).`,
    );
  }

  if (stashLines.length > 0) {
    blockingIssues.push(`Repo has ${stashLines.length} stash(es).`);
  }

  if (dirtyWorktrees.length > 0) {
    blockingIssues.push(`Repo has ${dirtyWorktrees.length} other dirty worktree(s).`);
  }

  if (goneUpstreamWorktrees.length > 0) {
    blockingIssues.push(
      `${goneUpstreamWorktrees.length} worktree(s) track an upstream branch that is gone.`,
    );
  }

  if (originRemote !== EXPECTED_ORIGIN_REMOTE) {
    blockingIssues.push(
      `origin remote should be ${EXPECTED_ORIGIN_REMOTE}. Current: ${originRemote || '(missing)'}.`,
    );
  }

  if (worktrees.length > 5) {
    advisories.push(
      `Repo has ${worktrees.length} worktrees open. Prune merged or abandoned worktrees before opening more.`,
    );
  }

  if (orphanedWorktreeDirectories.length > 0) {
    advisories.push(
      `Repo has ${orphanedWorktreeDirectories.length} orphaned .claude/worktrees director${orphanedWorktreeDirectories.length === 1 ? 'y' : 'ies'}. Confirm ownership before deleting.`,
    );
  }

  console.log('=== Session Doctor ===');
  console.log(`Repo: ${topLevel}`);
  console.log(`Checkout: ${checkoutLabel}`);
  console.log(`Branch: ${branch}`);
  console.log(
    `Status: ${statusLines.length === 0 ? 'clean' : `dirty (${statusLines.length} changes)`}`,
  );
  console.log(`Stashes: ${stashLines.length}`);
  console.log(`Origin: ${originRemote || '(missing)'}`);
  console.log(`Worktrees: ${worktrees.length}`);
  console.log('');

  if (statusLines.length > 0) {
    printSection('Changed files', statusLines.slice(0, 10));
    if (statusLines.length > 10) {
      console.log(`  - ... and ${statusLines.length - 10} more`);
    }
    console.log('');
  }

  printSection('Stashes', stashLines.slice(0, 5));
  if (stashLines.length > 5) {
    console.log(`  - ... and ${stashLines.length - 5} more`);
  }
  console.log('');

  printSection(
    'Worktrees',
    worktrees.map((worktree) => `${worktree.branch} -> ${worktree.path}`),
  );
  console.log('');

  printSection(
    'Dirty worktrees',
    dirtyWorktrees.map(
      (worktree) => `${worktree.branch} -> ${worktree.path} (${worktree.dirtyCount} changes)`,
    ),
  );
  console.log('');

  printSection(
    'Gone upstream worktrees',
    goneUpstreamWorktrees.map((worktree) => `${worktree.branch} -> ${worktree.path}`),
  );
  console.log('');

  printSection(
    'Orphaned worktree directories',
    orphanedWorktreeDirectories.map((worktree) => `${worktree.path} (${worktree.reason})`),
  );
  console.log('');

  printSection('Session files', [
    fileLabel('.cursor/tasks/lessons.md'),
    fileLabel('.cursor/tasks/todo.md'),
  ]);
  console.log('');

  if (blockingIssues.length > 0) {
    printSection(options.strict ? 'Blocking issues' : 'Warnings', blockingIssues);
    console.log('');
  }

  if (advisories.length > 0) {
    printSection('Advisories', advisories);
    console.log('');
  }

  if (options.strict) {
    if (blockingIssues.length > 0) {
      console.error(`STRICT FAILED: ${blockingIssues.length} hygiene issue(s) found.`);
      process.exit(1);
    }

    console.log('STRICT OK: local hygiene checks passed.');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}
