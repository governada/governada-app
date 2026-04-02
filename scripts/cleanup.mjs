#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const workspace = path.resolve(repoRoot, '..');
const mode = process.argv[2] ?? 'dry-run';

const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const CYAN = '\x1b[0;36m';
const NC = '\x1b[0m';

function color(code, text) {
  return `${code}${text}${NC}`;
}

function runGit(args, { cwd = repoRoot, quiet = false, allowFailure = false } = {}) {
  try {
    const output = execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: quiet ? ['ignore', 'ignore', 'ignore'] : ['ignore', 'pipe', 'pipe'],
    });

    return typeof output === 'string' ? output.trim() : '';
  } catch (error) {
    if (allowFailure) {
      return '';
    }

    const stderr = error.stderr?.toString?.().trim();
    const detail = stderr ? `: ${stderr}` : '';
    throw new Error(`git ${args.join(' ')} failed${detail}`);
  }
}

function safeRunGit(args, options = {}) {
  try {
    return runGit(args, { ...options, allowFailure: false });
  } catch (error) {
    console.log(color(YELLOW, `  WARN: ${error.message}`));
    return '';
  }
}

function runGitOk(args, { cwd = repoRoot } = {}) {
  try {
    execFileSync('git', args, {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function runGitLines(args, { cwd = repoRoot } = {}) {
  const output = runGit(args, { cwd });
  return output ? output.split(/\r?\n/) : [];
}

function safeDelete(target) {
  try {
    rmSync(target, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup mirrors the bash script's "keep going" behavior.
  }
}

function countLines(text) {
  if (!text) {
    return 0;
  }

  return text.split(/\r?\n/).filter(Boolean).length;
}

function parseWorktrees() {
  const entries = [];
  const lines = runGitLines(['worktree', 'list', '--porcelain']);
  let current = {};

  for (const line of lines) {
    if (!line.trim()) {
      if (current.worktree) {
        entries.push(current);
      }
      current = {};
      continue;
    }

    const [key, ...rest] = line.split(' ');
    const value = rest.join(' ');

    if (key === 'worktree') {
      current.worktree = value;
    } else if (key === 'branch') {
      current.branch = value.replace(/^refs\/heads\//, '');
    } else if (key === 'HEAD') {
      current.head = value;
    }
  }

  if (current.worktree) {
    entries.push(current);
  }

  return entries;
}

function revCount(range) {
  const output = runGit(['rev-list', '--count', range]);
  const value = Number.parseInt(output, 10);
  return Number.isFinite(value) ? value : 0;
}

console.log(color(CYAN, '=== Governada Workspace Cleanup ==='));
console.log(`Workspace: ${workspace}`);
console.log(`Mode: ${mode}`);
console.log('');

const ORPHANED = [];
const MERGED_WORKTREES = [];
const STALE_WORKTREES = [];
const ACTIVE_WORKTREES = [];
const STALE_FILES = [];
const GONE_BRANCHES = [];
const LOCAL_ONLY_BRANCHES = [];

console.log(color(CYAN, '[1/8] Pruning git worktree metadata...'));
safeRunGit(['worktree', 'prune'], { quiet: true });
console.log('  Done.');
console.log('');

console.log(color(CYAN, '[2/8] Scanning for orphaned directories...'));
for (const entry of readdirSync(workspace, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('governada-')) {
    continue;
  }

  const dir = path.join(workspace, entry.name);
  if (entry.name === path.basename(repoRoot)) {
    continue;
  }

  const gitPath = path.join(dir, '.git');
  if (!statSync(gitPath, { throwIfNoEntry: false })) {
    ORPHANED.push(dir);
    console.log(color(RED, `  ORPHANED: ${entry.name} (no .git -- leftover from removed worktree)`));
  }
}

if (ORPHANED.length === 0) {
  console.log(color(GREEN, '  None found.'));
}
console.log('');

console.log(color(CYAN, '[3/8] Checking worktrees for merged branches...'));
safeRunGit(['fetch', 'origin', '--quiet'], { quiet: true });

for (const worktree of parseWorktrees()) {
  const wtPath = worktree.worktree;
  const wtName = path.basename(wtPath);
  const wtBranch = worktree.branch;

  if (path.resolve(wtPath) === repoRoot) {
    continue;
  }

  if (!wtBranch || wtBranch === '(detached)') {
    console.log(color(YELLOW, `  NO BRANCH: ${wtName} (detached or missing branch metadata)`));
    STALE_WORKTREES.push(wtPath);
    continue;
  }

  if (!runGitOk(['rev-parse', '--verify', `origin/${wtBranch}`])) {
    console.log(color(YELLOW, `  NO REMOTE: ${wtName} (${wtBranch} -- no remote branch)`));
    STALE_WORKTREES.push(wtPath);
    continue;
  }

  const ahead = revCount(`origin/main..origin/${wtBranch}`);
  const behind = revCount(`origin/${wtBranch}..origin/main`);

  if (ahead === 0) {
    console.log(color(GREEN, `  MERGED: ${wtName} (${wtBranch} -- 0 ahead, ${behind} behind)`));
    MERGED_WORKTREES.push(wtPath);
  } else if (behind > 20) {
    console.log(color(YELLOW, `  STALE: ${wtName} (${wtBranch} -- ${ahead} ahead, ${behind} behind main)`));
    STALE_WORKTREES.push(wtPath);
  } else {
    console.log(color(GREEN, `  ACTIVE: ${wtName} (${wtBranch} -- ${ahead} ahead, ${behind} behind)`));
    ACTIVE_WORKTREES.push(wtPath);
  }
}
console.log('');

console.log(color(CYAN, '[4/8] Checking for uncommitted changes...'));
for (const worktree of parseWorktrees()) {
  const wtPath = worktree.worktree;
  const wtName = path.basename(wtPath);
  const changes = runGitLines(['status', '--short'], { cwd: wtPath });

  if (changes.length > 0) {
    console.log(color(YELLOW, `  ${wtName}:`));
    for (const line of changes.slice(0, 5)) {
      console.log(`    ${line}`);
    }

    if (changes.length > 5) {
      console.log(`    ... and ${changes.length - 5} more`);
    }
  }
}
console.log('');

console.log(color(CYAN, '[5/8] Checking for stale files in workspace root...'));
for (const entry of readdirSync(workspace, { withFileTypes: true })) {
  if (!entry.isFile()) {
    continue;
  }

  if (!entry.name.endsWith('.zip') && !entry.name.endsWith('.bak') && !entry.name.endsWith('.tar.gz')) {
    continue;
  }

  const fullPath = path.join(workspace, entry.name);
  const size = statSync(fullPath).size;
  STALE_FILES.push(fullPath);
  console.log(color(YELLOW, `  STALE FILE: ${entry.name} (${size} bytes)`));
}

if (STALE_FILES.length === 0) {
  console.log(color(GREEN, '  None found.'));
}
console.log('');

console.log(color(CYAN, '[6/8] Build manifest sync check...'));
const vision = path.join(repoRoot, 'docs/strategy/ultimate-vision.md');
const manifest = path.join(repoRoot, 'docs/strategy/context/build-manifest.md');
const visionExists = Boolean(statSync(vision, { throwIfNoEntry: false }));
const manifestExists = Boolean(statSync(manifest, { throwIfNoEntry: false }));

if (manifestExists && visionExists) {
  const visionMod = statSync(vision).mtimeMs;
  const manifestMod = statSync(manifest).mtimeMs;

  if (visionMod > manifestMod) {
    console.log(color(YELLOW, '  STALE: build-manifest.md is older than ultimate-vision.md -- consider updating'));
  } else {
    console.log(color(GREEN, '  IN SYNC: build-manifest.md is up to date'));
  }
} else if (!manifestExists) {
  console.log(color(YELLOW, '  MISSING: docs/strategy/context/build-manifest.md not found'));
}
console.log('');

console.log(color(CYAN, '[7/8] Checking for stale local branches...'));
safeRunGit(['fetch', '--prune', '--quiet'], { quiet: true });

for (const line of runGitLines([
  'for-each-ref',
  'refs/heads',
  '--format=%(refname:short)\t%(upstream:short)\t%(upstream:track)',
])) {
  if (!line) {
    continue;
  }

  const [branch, upstream = '', track = ''] = line.split('\t');
  if (branch === 'main' || branch === 'master') {
    continue;
  }

  if (track.includes('gone')) {
    GONE_BRANCHES.push(branch);
  } else if (!upstream) {
    LOCAL_ONLY_BRANCHES.push(branch);
  }
}

if (GONE_BRANCHES.length > 0) {
  console.log(color(YELLOW, `  ${GONE_BRANCHES.length} branches with deleted remote (squash-merged or remote-deleted)`));
  for (const branch of GONE_BRANCHES.slice(0, 10)) {
    console.log(color(YELLOW, `    GONE: ${branch}`));
  }
  if (GONE_BRANCHES.length > 10) {
    console.log(`    ... and ${GONE_BRANCHES.length - 10} more`);
  }
} else {
  console.log(color(GREEN, '  No stale branches.'));
}

if (LOCAL_ONLY_BRANCHES.length > 0) {
  console.log(color(YELLOW, `  ${LOCAL_ONLY_BRANCHES.length} local-only branches (never pushed or tracking removed)`));
  for (const branch of LOCAL_ONLY_BRANCHES.slice(0, 5)) {
    console.log(color(YELLOW, `    LOCAL: ${branch}`));
  }
  if (LOCAL_ONLY_BRANCHES.length > 5) {
    console.log(`    ... and ${LOCAL_ONLY_BRANCHES.length - 5} more`);
  }
} else {
  console.log(color(GREEN, '  No local-only branches.'));
}
console.log('');

console.log(color(CYAN, '[8/8] Checking for stale stashes...'));
const stashList = runGitLines(['stash', 'list']);
const stashCount = stashList.filter(Boolean).length;
if (stashCount > 0) {
  console.log(color(YELLOW, `  ${stashCount} stash(es) found`));
  for (const line of stashList.slice(0, 5)) {
    console.log(`    ${line}`);
  }
  if (stashCount > 5) {
    console.log(`    ... and ${stashCount - 5} more`);
  }
} else {
  console.log(color(GREEN, '  No stashes.'));
}
console.log('');

console.log(color(CYAN, '=== Summary ==='));
console.log(`  Orphaned dirs:      ${ORPHANED.length}`);
console.log(`  Merged worktrees:   ${MERGED_WORKTREES.length}`);
console.log(`  Stale worktrees:    ${STALE_WORKTREES.length}`);
console.log(`  Active worktrees:   ${ACTIVE_WORKTREES.length}`);
console.log(`  Stale files:        ${STALE_FILES.length}`);
console.log(`  Gone branches:      ${GONE_BRANCHES.length}`);
console.log(`  Local-only branches: ${LOCAL_ONLY_BRANCHES.length}`);
console.log(`  Stashes:            ${stashCount}`);
console.log('');

if (mode === '--clean' || mode === '--clean-all') {
  console.log(color(CYAN, '=== Cleaning ==='));

  for (const wt of MERGED_WORKTREES) {
    const wtName = path.basename(wt);
    console.log(`  Removing merged worktree: ${color(GREEN, wtName)}`);
    safeDelete(path.join(wt, 'node_modules'));
    runGit(['worktree', 'remove', wt, '--force'], { quiet: true });
  }

  for (const wt of STALE_WORKTREES) {
    const wtName = path.basename(wt);
    console.log(`  Removing stale worktree: ${color(YELLOW, wtName)}`);
    safeDelete(path.join(wt, 'node_modules'));
    runGit(['worktree', 'remove', wt, '--force'], { quiet: true });
  }

  if (mode === '--clean-all') {
    for (const dir of ORPHANED) {
      const dirname = path.basename(dir);
      console.log(`  Removing orphaned dir: ${color(RED, dirname)}`);
      safeDelete(path.join(dir, 'node_modules'));
      safeDelete(dir);
    }
  }

  if (GONE_BRANCHES.length > 0) {
    console.log('');
    console.log(`  Deleting ${GONE_BRANCHES.length} branches with gone remotes...`);
    let deleted = 0;
    let failed = 0;
    for (const branch of GONE_BRANCHES) {
      try {
        execFileSync('git', ['branch', '-D', branch], { cwd: repoRoot, stdio: 'ignore' });
        deleted += 1;
      } catch {
        failed += 1;
        console.log(color(RED, `    FAILED: ${branch} (may be current branch or have unmerged work)`));
      }
    }
    console.log(`    Deleted: ${color(GREEN, String(deleted))}, Failed: ${failed}`);
  }

  safeRunGit(['worktree', 'prune'], { quiet: true });

  console.log('');
  console.log(color(GREEN, 'Cleanup complete.'));
} else {
  const totalIssues =
    ORPHANED.length +
    MERGED_WORKTREES.length +
    STALE_WORKTREES.length +
    STALE_FILES.length +
    GONE_BRANCHES.length;

  if (totalIssues > 0) {
    console.log('Run with --clean to remove merged/stale worktrees and prune branches.');
    console.log('Run with --clean-all to also remove orphaned directories.');
  } else {
    console.log(color(GREEN, 'Workspace is clean!'));
  }
}
