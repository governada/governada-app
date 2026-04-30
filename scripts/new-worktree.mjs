#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ENV_LOCAL_FILE, ENV_REFS_FILE } from './lib/env-bootstrap.mjs';
import { commandOutput, getScriptContext } from './lib/runtime.mjs';

const require = createRequire(import.meta.url);
const { classifyAuthFailure, formatClassification } = require('./lib/auth-failure-classifier.js');

const usage = 'npm run worktree:new -- <name> [--branch <branch>] [--no-node-modules-link]';
const GIT_FETCH_TIMEOUT_MS = 30000;

function parseArgs(argv) {
  const options = {
    branch: '',
    noNodeModulesLink: false,
    name: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--branch') {
      const branch = argv[index + 1];
      if (!branch) {
        throw new Error(`Missing value for --branch.\nUsage: ${usage}`);
      }

      options.branch = branch;
      index += 1;
      continue;
    }

    if (arg === '--no-node-modules-link') {
      options.noNodeModulesLink = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(usage);
      process.exit(0);
    }

    if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}\nUsage: ${usage}`);
    }

    if (options.name) {
      throw new Error(`Unexpected argument: ${arg}\nUsage: ${usage}`);
    }

    options.name = arg;
  }

  if (!options.name) {
    throw new Error(`Missing worktree name.\nUsage: ${usage}`);
  }

  return options;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  if (!slug) {
    throw new Error('Name must contain at least one alphanumeric character.');
  }

  return slug;
}

function git(args, options = {}) {
  try {
    return commandOutput('git', args, {
      allowFailure: options.allowFailure ?? false,
      cwd: options.cwd ?? repoRoot,
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    if (options.timeoutMs || args[0] === 'fetch') {
      const errorText = [
        error.stdout?.toString?.() || '',
        error.stderr?.toString?.() || '',
        error.message || String(error),
      ]
        .filter(Boolean)
        .join('\n');
      const classification = classifyAuthFailure(errorText, {
        timedOut: error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM',
        timeoutMs: options.timeoutMs,
        command: `git ${args.join(' ')}`,
      });
      if (classification.code !== 'unknown') {
        console.error(`Failure class: ${formatClassification(classification)}`);
        throw new Error(`git ${args.join(' ')} failed (${classification.code}).`);
      }
    }

    throw error;
  }
}

function getLines(value) {
  return value
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function revCount(range) {
  const value = Number.parseInt(git(['rev-list', '--count', range], { allowFailure: true }), 10);
  return Number.isFinite(value) ? value : 0;
}

function ensureSharedCheckoutReady(repoTopLevel) {
  if (path.resolve(repoTopLevel) !== path.resolve(repoRoot)) {
    throw new Error(`Run this script from the shared checkout at ${repoRoot}.`);
  }

  const gitDir = git(['rev-parse', '--path-format=absolute', '--git-dir'], { allowFailure: true });
  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    allowFailure: true,
  });
  if (!gitDir || !commonDir || path.resolve(gitDir) !== path.resolve(commonDir)) {
    throw new Error('Run this script from the shared checkout, not from an existing worktree.');
  }

  const branch = git(['branch', '--show-current'], { allowFailure: true }) || '(detached)';
  if (!['main', 'master'].includes(branch)) {
    throw new Error(
      `Shared checkout must stay on main/master before creating a new worktree. Current branch: ${branch}.`,
    );
  }

  const statusLines = getLines(git(['status', '--short'], { allowFailure: true }));
  if (statusLines.length > 0) {
    throw new Error(
      'Shared checkout is dirty. Clean it before creating another worktree. Run npm run session:doctor.',
    );
  }

  const stashCount = getLines(git(['stash', 'list'], { allowFailure: true })).length;
  if (stashCount > 0) {
    throw new Error(
      `Repo has ${stashCount} stash(es). Clear or export them before creating another worktree. Run npm run session:doctor.`,
    );
  }
}

function ensureNodeModulesLink(worktreePath, noNodeModulesLink) {
  if (noNodeModulesLink) {
    return;
  }

  const mainNodeModules = path.join(repoRoot, 'node_modules');
  const worktreeNodeModules = path.join(worktreePath, 'node_modules');
  const mainPackageJson = path.join(repoRoot, 'package.json');
  const worktreePackageJson = path.join(worktreePath, 'package.json');

  if (existsSync(worktreeNodeModules) || !existsSync(mainNodeModules)) {
    return;
  }

  const samePackageJson =
    existsSync(mainPackageJson) &&
    existsSync(worktreePackageJson) &&
    readFileSync(mainPackageJson, 'utf8') === readFileSync(worktreePackageJson, 'utf8');

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

function reportEnvBootstrap() {
  const sharedRefs = path.join(repoRoot, ENV_REFS_FILE);
  const sharedEnv = path.join(repoRoot, ENV_LOCAL_FILE);

  if (existsSync(sharedRefs)) {
    console.log(
      `${ENV_REFS_FILE}: available from shared checkout; no env file was copied. Use npm run env:run -- <command>.`,
    );
    return;
  }

  if (existsSync(sharedEnv)) {
    console.log(
      `${ENV_LOCAL_FILE}: present in shared checkout but not copied. Run npm run env:doctor for migration status.`,
    );
    return;
  }

  console.log(
    `${ENV_REFS_FILE}: not found. Run npm run env:doctor before commands that need local secrets.`,
  );
}

const { repoRoot } = getScriptContext(import.meta.url);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoTopLevel = git(['rev-parse', '--show-toplevel']);
  ensureSharedCheckoutReady(repoTopLevel);

  const slug = slugify(options.name);
  const branchName = options.branch || `feat/${slug}`;
  const worktreesRoot = path.join(repoRoot, '.claude', 'worktrees');
  const worktreePath = path.join(worktreesRoot, slug);

  if (existsSync(worktreePath)) {
    throw new Error(`Target worktree path already exists: ${worktreePath}`);
  }

  mkdirSync(worktreesRoot, { recursive: true });

  console.log('Fetching origin/main...');
  git(['fetch', 'origin', 'main'], { timeoutMs: GIT_FETCH_TIMEOUT_MS });

  const ahead = revCount('origin/main..HEAD');
  if (ahead > 0) {
    throw new Error(
      `Shared checkout has ${ahead} local commit(s) ahead of origin/main. Reconcile them before creating another worktree.`,
    );
  }

  console.log(`Creating worktree ${worktreePath} on branch ${branchName}...`);
  git(['worktree', 'add', worktreePath, '-b', branchName, 'origin/main']);

  reportEnvBootstrap();
  ensureNodeModulesLink(worktreePath, options.noNodeModulesLink);

  console.log('');
  console.log('Worktree ready:');
  console.log(`  Path:   ${worktreePath}`);
  console.log(`  Branch: ${branchName}`);
  console.log('');
  console.log('Next:');
  console.log(`  cd '${worktreePath}'`);
  console.log('  git status --short --branch');
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
