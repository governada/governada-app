const fs = require('node:fs');
const path = require('node:path');

const { repoRoot, runCommand } = require('./lib/runtime');

function runOrEmpty(command, args, cwd = repoRoot) {
  const result = runCommand(command, args, { cwd });
  return result.status === 0 ? result.stdout.trimEnd() : '';
}

function getTopLevel() {
  return runOrEmpty('git', ['rev-parse', '--show-toplevel']);
}

function getBranch() {
  const branch = runOrEmpty('git', ['branch', '--show-current']);
  return branch || '(detached)';
}

function getStatusLines() {
  const status = runOrEmpty('git', ['status', '--short']);
  return status ? status.split(/\r?\n/).filter(Boolean) : [];
}

function getStashLines() {
  const stashes = runOrEmpty('git', ['stash', 'list']);
  return stashes ? stashes.split(/\r?\n/).filter(Boolean) : [];
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

function main() {
  const topLevel = getTopLevel() || repoRoot;
  const branch = getBranch();
  const statusLines = getStatusLines();
  const stashLines = getStashLines();
  const worktrees = parseWorktrees();

  console.log('=== Session Doctor ===');
  console.log(`Repo: ${topLevel}`);
  console.log(`Branch: ${branch}`);
  console.log(
    `Status: ${statusLines.length === 0 ? 'clean' : `dirty (${statusLines.length} changes)`}`,
  );
  console.log(`Stashes: ${stashLines.length}`);
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

  printSection('Session files', [
    fileLabel('.cursor/tasks/lessons.md'),
    fileLabel('.cursor/tasks/todo.md'),
  ]);
}

if (require.main === module) {
  main();
}
