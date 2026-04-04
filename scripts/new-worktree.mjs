#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { commandOutput, getScriptContext } from './lib/runtime.mjs';

const usage =
  'npm run worktree:new -- <name> [--branch <branch>] [--no-node-modules-link]';

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
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-+|-+$/gu, '');
  if (!slug) {
    throw new Error('Name must contain at least one alphanumeric character.');
  }

  return slug;
}

function git(args, options = {}) {
  return commandOutput('git', args, { cwd: options.cwd ?? repoRoot });
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

const { repoRoot } = getScriptContext(import.meta.url);

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoTopLevel = git(['rev-parse', '--show-toplevel']);

  if (path.resolve(repoTopLevel) !== path.resolve(repoRoot)) {
    throw new Error(`Run this script from the shared checkout at ${repoRoot}.`);
  }

  const slug = slugify(options.name);
  const branchName = options.branch || `feat/${slug}`;
  const worktreesRoot = path.join(repoRoot, '.claude', 'worktrees');
  const worktreePath = path.join(worktreesRoot, slug);

  if (existsSync(worktreePath)) {
    throw new Error(`Target worktree path already exists: ${worktreePath}`);
  }

  mkdirSync(worktreesRoot, { recursive: true });

  console.log('Fetching origin/main...');
  git(['fetch', 'origin', 'main']);

  console.log(`Creating worktree ${worktreePath} on branch ${branchName}...`);
  git(['worktree', 'add', worktreePath, '-b', branchName, 'origin/main']);

  const mainEnv = path.join(repoRoot, '.env.local');
  const worktreeEnv = path.join(worktreePath, '.env.local');
  if (existsSync(mainEnv) && !existsSync(worktreeEnv)) {
    copyFileSync(mainEnv, worktreeEnv);
    console.log('.env.local copied.');
  }

  ensureNodeModulesLink(worktreePath, options.noNodeModulesLink);

  console.log('');
  console.log('Worktree ready:');
  console.log(`  Path:   ${worktreePath}`);
  console.log(`  Branch: ${branchName}`);
  console.log('');
  console.log('Next:');
  console.log(`  Set-Location '${worktreePath}'`);
  console.log('  git status --short --branch');
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
