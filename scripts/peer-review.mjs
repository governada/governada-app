#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

function usage() {
  console.log(`Usage: npm run peer-review -- [--diff | <plan-or-diff-path> | -]

Inputs:
  --diff  Review current branch diff against origin/main, falling back to unstaged diff.
  <path>  Review a plan or diff file.
  -       Read review input from stdin.

Model command:
  PEER_REVIEW_CMD overrides the default.
  Default is Codex CLI when available: codex exec --sandbox read-only --ask-for-approval never -`);
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

function commandExists(command) {
  const result = run('sh', ['-lc', `command -v ${JSON.stringify(command)} >/dev/null 2>&1`]);
  return result.status === 0;
}

function currentDiff() {
  const branchDiff = run('git', ['diff', '--no-ext-diff', 'origin/main...HEAD']);
  if (branchDiff.status === 0 && branchDiff.stdout.trim()) {
    return `${branchDiff.stdout}${untrackedSnapshot()}`;
  }

  const stagedDiff = run('git', ['diff', '--no-ext-diff', '--cached']);
  if (stagedDiff.status === 0 && stagedDiff.stdout.trim()) {
    return `${stagedDiff.stdout}${untrackedSnapshot()}`;
  }

  const unstagedDiff = run('git', ['diff', '--no-ext-diff']);
  if (unstagedDiff.status === 0 && unstagedDiff.stdout.trim()) {
    return `${unstagedDiff.stdout}${untrackedSnapshot()}`;
  }

  return untrackedSnapshot();
}

function untrackedSnapshot() {
  const status = run('git', ['status', '--porcelain']);
  if (status.status !== 0 || !status.stdout.trim()) return '';

  const paths = status.stdout
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim())
    .filter(Boolean);

  const snapshots = [];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    let content = readFileSync(path, 'utf8');
    if (content.length > 20000) {
      content = `${content.slice(0, 20000)}\n[truncated]\n`;
    }
    snapshots.push(`\n\n--- untracked file: ${path} ---\n${content}`);
  }

  return snapshots.join('');
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

let mode = 'diff';
let inputPath = '';

for (const arg of args) {
  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  }
  if (arg === '--diff') {
    mode = 'diff';
    continue;
  }
  if (arg === '-') {
    mode = 'stdin';
    continue;
  }
  inputPath = arg;
  mode = 'path';
}

let reviewInput = '';
let inputLabel = 'current diff';

if (mode === 'stdin') {
  reviewInput = await readStdin();
  inputLabel = 'stdin';
} else if (mode === 'path') {
  if (!existsSync(inputPath)) {
    console.error(`PEER REVIEW BLOCKED: input path does not exist: ${inputPath}`);
    console.error(
      'Remediation: pass an existing diff/plan path, --diff, or pipe content with "-".',
    );
    process.exit(2);
  }
  reviewInput = readFileSync(inputPath, 'utf8');
  inputLabel = inputPath;
} else {
  reviewInput = currentDiff();
}

if (!reviewInput.trim()) {
  console.error('PEER REVIEW BLOCKED: no diff or plan content found.');
  console.error(
    'Remediation: pass a plan path, pipe a diff, or create a branch diff against origin/main.',
  );
  process.exit(2);
}

const prompt = `You are a skeptical second reviewer for Governada.

Review the following ${inputLabel}. Focus on correctness, missing enforcement, confusing operator experience, and tests or verification gaps. Be concise. Return:

- Blocking concerns
- Non-blocking concerns
- Suggested verification

<review_input>
${reviewInput}
</review_input>
`;

const configuredCommand = process.env.PEER_REVIEW_CMD;
let result;

if (configuredCommand) {
  result = run('sh', ['-lc', configuredCommand], { input: prompt });
} else if (commandExists('codex')) {
  result = run('codex', ['exec', '--sandbox', 'read-only', '--ask-for-approval', 'never', '-'], {
    input: prompt,
  });
} else {
  console.error('PEER REVIEW BLOCKED: Codex CLI was not found and PEER_REVIEW_CMD is not set.');
  console.error(
    "Remediation: install Codex CLI or run with PEER_REVIEW_CMD='your-review-command'.",
  );
  process.exit(2);
}

if (result.error) {
  console.error(`PEER REVIEW BLOCKED: failed to start review command: ${result.error.message}`);
  process.exit(2);
}

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  console.error(`PEER REVIEW BLOCKED: review command exited with status ${result.status}.`);
  process.exit(result.status || 1);
}

if (result.stderr.trim()) {
  console.error(result.stderr.trim());
}

console.log(result.stdout.trim());
