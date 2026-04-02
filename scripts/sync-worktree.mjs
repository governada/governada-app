#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, readFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { getScriptContext } from './lib/runtime.mjs';

const { repoRoot } = getScriptContext(import.meta.url);
const gitEntry = lstatSync(path.join(repoRoot, '.git'));
const isSharedCheckout = gitEntry.isDirectory();
const branch = git(['branch', '--show-current']);
const commonGitDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir']);
const mainCheckoutRoot = path.dirname(commonGitDir);

function git(args, options = {}) {
  const { allowFailure = false, quiet = false, cwd = repoRoot } = options;

  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: quiet ? ['ignore', 'ignore', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }

    const stderr = error.stderr?.toString?.().trim();
    if (stderr) {
      console.error(stderr);
    }
    throw error;
  }
}

function gitOk(args, options = {}) {
  try {
    execFileSync('git', args, {
      cwd: options.cwd ?? repoRoot,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function realDiffLines(args) {
  const output = git(args, { allowFailure: true });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const [added = '0', removed = '0'] = line.split(/\s+/u);
      return added !== '0' || removed !== '0';
    });
}

function hasRelevantUntrackedFiles() {
  const output = git(['ls-files', '--others', '--exclude-standard'], { allowFailure: true });
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((file) => !file.startsWith('.claude/'));
}

function cleanupCrlfPhantoms() {
  if (gitOk(['diff', '--quiet', 'HEAD'])) {
    return;
  }

  const realUnstaged = realDiffLines(['diff', '--numstat', 'HEAD']);
  if (realUnstaged.length > 0) {
    return;
  }

  const changedFiles = git(['diff', '--name-only', 'HEAD'], { allowFailure: true })
    .split(/\r?\n/u)
    .filter(Boolean);

  if (changedFiles.length === 0) {
    return;
  }

  git(['checkout', '--', '.'], { quiet: true });
  console.log(`Git: discarded ${changedFiles.length} CRLF phantom diff(s).`);
}

function hasRealChanges() {
  const unstaged = realDiffLines(['diff', '--numstat', 'HEAD']);
  const staged = realDiffLines(['diff', '--cached', '--numstat', 'HEAD']);
  return unstaged.length > 0 || staged.length > 0 || hasRelevantUntrackedFiles();
}

function revCount(range) {
  const value = Number.parseInt(git(['rev-list', '--count', range]), 10);
  return Number.isFinite(value) ? value : 0;
}

function ensureEnvLocal() {
  if (isSharedCheckout) {
    return;
  }

  const worktreeEnv = path.join(repoRoot, '.env.local');
  const mainEnv = path.join(mainCheckoutRoot, '.env.local');
  if (!existsSync(worktreeEnv) && existsSync(mainEnv)) {
    copyFileSync(mainEnv, worktreeEnv);
    console.log('.env.local: copied from main checkout.');
  }
}

function ensureNodeModulesLink() {
  if (isSharedCheckout) {
    return;
  }

  const worktreeNodeModules = path.join(repoRoot, 'node_modules');
  const mainNodeModules = path.join(mainCheckoutRoot, 'node_modules');
  const worktreePackageJson = path.join(repoRoot, 'package.json');
  const mainPackageJson = path.join(mainCheckoutRoot, 'package.json');

  if (existsSync(worktreeNodeModules) || !existsSync(mainNodeModules)) {
    return;
  }

  const samePackageJson =
    existsSync(worktreePackageJson) &&
    existsSync(mainPackageJson) &&
    readFileSync(worktreePackageJson, 'utf8') === readFileSync(mainPackageJson, 'utf8');

  if (!samePackageJson) {
    console.log('node_modules: package.json differs from main checkout. Run npm ci.');
    return;
  }

  try {
    symlinkSync(
      mainNodeModules,
      worktreeNodeModules,
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    console.log('node_modules: linked from main checkout.');
  } catch (error) {
    console.log(`node_modules: link failed (${error.message}). Run npm ci.`);
  }
}

function printDirtyBlock(kind) {
  console.log('');
  console.log(`BLOCKED: ${kind} is behind origin/main and has uncommitted changes.`);
  console.log('Run one of these, then re-run npm run worktree:sync:');
  console.log('  git stash && git rebase origin/main && git stash pop');
  console.log("  git add -A && git commit -m 'wip: save progress' && git rebase origin/main");
  console.log('');
}

console.log(`Syncing ${isSharedCheckout ? 'shared checkout' : 'worktree'} on '${branch}'...`);
git(['fetch', 'origin', 'main', '--quiet']);
cleanupCrlfPhantoms();

if (isSharedCheckout) {
  if (!['main', 'master'].includes(branch)) {
    console.error(`Shared checkout is on '${branch}'. Only main/master can be synced here.`);
    process.exit(1);
  }

  const ahead = revCount('origin/main..HEAD');
  const behind = revCount('HEAD..origin/main');

  if (ahead > 0) {
    console.error(
      `Shared checkout has ${ahead} local commit(s) ahead of origin/main. Reconcile manually.`,
    );
    process.exit(1);
  }

  if (behind === 0) {
    console.log('Shared checkout is already up to date.');
    process.exit(0);
  }

  if (hasRealChanges()) {
    printDirtyBlock('Shared checkout');
    process.exit(1);
  }

  git(['pull', '--ff-only', 'origin', branch], { quiet: true });
  console.log(`Shared checkout fast-forwarded ${behind} commit(s).`);
  process.exit(0);
}

const ahead = revCount('origin/main..HEAD');
const behind = revCount('HEAD..origin/main');

if (behind > 0 && hasRealChanges()) {
  printDirtyBlock('Worktree');
  process.exit(1);
}

if (behind > 0) {
  try {
    git(['rebase', 'origin/main'], { quiet: true });
    console.log(`Git: rebased ${behind} commit(s) from origin/main.`);
  } catch {
    git(['rebase', '--abort'], { allowFailure: true, quiet: true });
    console.error('Rebase onto origin/main failed. Resolve manually with: git rebase origin/main');
    process.exit(1);
  }
} else {
  console.log(`Git: already up to date with origin/main (ahead ${ahead} commit(s)).`);
}

ensureEnvLocal();
ensureNodeModulesLink();
