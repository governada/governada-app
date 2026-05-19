#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_GIT_TIMEOUT_MS = 30000;
const DEFAULT_BEHIND_THRESHOLD = Number.parseInt(
  process.env.CHECKOUT_FRESHNESS_BEHIND_THRESHOLD || '1',
  10,
);

function parseArgs(argv) {
  const options = {
    mode: 'session-start',
    repo: process.cwd(),
    remoteRef: 'origin/main',
    noFetch: false,
    behindThreshold: Number.isFinite(DEFAULT_BEHIND_THRESHOLD) ? DEFAULT_BEHIND_THRESHOLD : 1,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--mode') {
      options.mode = argv[++index] || '';
      continue;
    }

    if (arg === '--repo') {
      options.repo = argv[++index] || '';
      continue;
    }

    if (arg === '--remote-ref') {
      options.remoteRef = argv[++index] || '';
      continue;
    }

    if (arg === '--behind-threshold') {
      options.behindThreshold = Number.parseInt(argv[++index] || '', 10);
      continue;
    }

    if (arg === '--no-fetch') {
      options.noFetch = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/check-checkout-freshness.mjs [options]

Options:
  --mode session-start|refresh  Warn-only SessionStart mode or explicit refresh mode.
  --repo <path>                 Checkout to inspect. Defaults to cwd.
  --remote-ref <ref>            Remote ref to compare against. Defaults to origin/main.
  --behind-threshold <n>        Minimum behind count for SessionStart warnings. Defaults to 1.
  --no-fetch                    Skip git fetch; useful for deterministic tests.`);
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  if (!['session-start', 'refresh'].includes(options.mode)) {
    throw new Error(`Unsupported mode: ${options.mode}`);
  }

  if (!Number.isFinite(options.behindThreshold) || options.behindThreshold < 1) {
    options.behindThreshold = 1;
  }

  return options;
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs || DEFAULT_GIT_TIMEOUT_MS,
  });

  const normalized = {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
    signal: result.signal,
  };

  if (options.allowFailure) {
    return normalized;
  }

  if (normalized.status !== 0 || normalized.error) {
    const detail = [normalized.stderr, normalized.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(detail || `git ${args.join(' ')} failed`);
  }

  return normalized;
}

function gitOutput(args, cwd, options = {}) {
  return git(args, { cwd, ...options }).stdout.trimEnd();
}

function resolveGitRoot(repo) {
  return gitOutput(['-C', repo, 'rev-parse', '--show-toplevel'], process.cwd());
}

function resolveSharedRoot(repoRoot) {
  const commonDir = gitOutput(
    ['-C', repoRoot, 'rev-parse', '--path-format=absolute', '--git-common-dir'],
    process.cwd(),
  );

  if (path.basename(commonDir) === '.git') {
    return path.dirname(commonDir);
  }

  return repoRoot;
}

function fetchRemote(repoRoot, mode) {
  const result = git(['fetch', 'origin', 'main', '--quiet'], {
    cwd: repoRoot,
    allowFailure: true,
    timeoutMs: DEFAULT_GIT_TIMEOUT_MS,
  });

  if (result.status === 0 && !result.error) {
    return true;
  }

  const detail = firstLine(result.stderr || result.error?.message || 'unknown fetch failure');
  if (mode === 'refresh') {
    console.error(`session:refresh: unable to fetch origin/main: ${detail}`);
    process.exit(1);
  }

  console.log(`Checkout freshness: unable to fetch origin/main (${detail}).`);
  return false;
}

function revCount(repoRoot, range) {
  const value = Number.parseInt(gitOutput(['rev-list', '--count', range], repoRoot), 10);
  return Number.isFinite(value) ? value : 0;
}

function parseStatus(repoRoot) {
  const output = gitOutput(['status', '--porcelain=v1', '-z', '--untracked-files=all'], repoRoot);
  const entries = output.split('\0').filter(Boolean);
  const untracked = [];
  const tracked = [];

  for (const entry of entries) {
    const status = entry.slice(0, 2);
    const file = entry.slice(3);
    if (!file) {
      continue;
    }

    if (status === '??') {
      untracked.push(file);
      continue;
    }

    tracked.push({ status, file });
  }

  return { untracked, tracked };
}

function existsInRef(repoRoot, remoteRef, file) {
  const result = git(['cat-file', '-e', `${remoteRef}:${file}`], {
    cwd: repoRoot,
    allowFailure: true,
  });
  return result.status === 0 && !result.error;
}

function shellQuote(value) {
  return `'${value.replace(/'/gu, `'\\''`)}'`;
}

function classifyWork(repoRoot, remoteRef) {
  const status = parseStatus(repoRoot);
  const safeUntracked = [];
  const localUntracked = [];

  for (const file of status.untracked) {
    if (existsInRef(repoRoot, remoteRef, file)) {
      safeUntracked.push(file);
    } else {
      localUntracked.push(file);
    }
  }

  return {
    safeUntracked,
    localUntracked,
    tracked: status.tracked,
    hasWip: safeUntracked.length > 0 || localUntracked.length > 0 || status.tracked.length > 0,
  };
}

function colors() {
  if (process.env.NO_COLOR) {
    return { red: '', yellow: '', reset: '', bold: '' };
  }

  return {
    red: '\u001b[31m',
    yellow: '\u001b[33m',
    bold: '\u001b[1m',
    reset: '\u001b[0m',
  };
}

function printWarning({ repoRoot, remoteRef, behind, work }) {
  const color = colors();
  console.log(
    `${color.red}${color.bold}STALE CHECKOUT WARNING:${color.reset} shared checkout is ${behind} commit(s) behind ${remoteRef}, and local WIP may block refresh.`,
  );
  console.log(`Checkout: ${repoRoot}`);
  console.log('');

  if (work.safeUntracked.length > 0) {
    console.log('Untracked files already in main (safe to remove if not intentionally edited):');
    for (const file of work.safeUntracked) {
      console.log(`  - ${file} (already in ${remoteRef})`);
    }
    console.log('');
    console.log('Suggested remediation for safe-to-remove files:');
    console.log(`  rm -- ${work.safeUntracked.map(shellQuote).join(' ')}`);
    console.log('  npm run session:refresh');
    console.log('');
  }

  if (work.localUntracked.length > 0 || work.tracked.length > 0) {
    console.log('Local WIP requiring Tim/agent review before refresh:');
    for (const file of work.localUntracked) {
      console.log(`  - ${file} (untracked; not present in ${remoteRef})`);
    }
    for (const entry of work.tracked) {
      console.log(`  - ${entry.file} (${entry.status.trim() || 'modified'})`);
    }
    console.log('');
    console.log('Suggested remediation for WIP: stash, commit, or move it aside before refresh.');
  }
}

function printBehindSuggestion({ repoRoot, remoteRef, behind }) {
  const color = colors();
  console.log(
    `${color.yellow}Checkout freshness:${color.reset} shared checkout is ${behind} commit(s) behind ${remoteRef}.`,
  );
  console.log(`Checkout: ${repoRoot}`);
  console.log('Run: npm run session:refresh');
}

function firstLine(text) {
  return (
    String(text)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || 'unknown'
  );
}

function refresh(repoRoot, remoteRef, behind, work) {
  if (behind === 0) {
    console.log(`session:refresh: shared checkout is current with ${remoteRef}.`);
    return 0;
  }

  if (work.hasWip) {
    printWarning({ repoRoot, remoteRef, behind, work });
    return 2;
  }

  git(['merge', '--ff-only', remoteRef], { cwd: repoRoot });
  console.log(
    `session:refresh: shared checkout fast-forwarded ${behind} commit(s) from ${remoteRef}.`,
  );
  return 0;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveGitRoot(options.repo);
  const sharedRoot = resolveSharedRoot(repoRoot);
  const remoteRef = options.remoteRef;

  if (!options.noFetch) {
    fetchRemote(sharedRoot, options.mode);
  }

  const behind = revCount(sharedRoot, `HEAD..${remoteRef}`);
  const work = classifyWork(sharedRoot, remoteRef);

  if (options.mode === 'refresh') {
    process.exit(refresh(sharedRoot, remoteRef, behind, work));
  }

  if (behind < options.behindThreshold) {
    return;
  }

  if (work.hasWip) {
    printWarning({ repoRoot: sharedRoot, remoteRef, behind, work });
    return;
  }

  printBehindSuggestion({ repoRoot: sharedRoot, remoteRef, behind });
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
