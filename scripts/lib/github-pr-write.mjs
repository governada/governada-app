import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { EXPECTED_REPO } from './github-app-auth.mjs';

export const GITHUB_WRITE_PR_CONFIRMATION = 'github.write.pr';
export const GITHUB_WRITE_PR_OPERATIONS = new Set(['create', 'ready', 'update']);

const BLOCKED_BODY_FILE_BASENAMES = new Set([
  '.env.local',
  '.env.local.refs',
  '.mcp.json',
  'settings.local.json',
]);

export function parseGithubPrWriteArgs(argv) {
  const operation = argv[0] || '';
  if (argv.includes('--help') || argv.includes('-h') || !operation) {
    return { help: true };
  }

  if (!GITHUB_WRITE_PR_OPERATIONS.has(operation)) {
    throw new Error(`Unknown operation: ${operation}. Expected create, ready, or update.`);
  }

  const args = {
    base: 'main',
    bodyFile: '',
    confirm: '',
    execute: false,
    head: '',
    operation,
    prNumber: '',
    title: '',
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--execute') {
      args.execute = true;
    } else if (value === '--base') {
      args.base = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--base=')) {
      args.base = value.slice('--base='.length);
    } else if (value === '--body-file') {
      args.bodyFile = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--body-file=')) {
      args.bodyFile = value.slice('--body-file='.length);
    } else if (value === '--confirm') {
      args.confirm = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--confirm=')) {
      args.confirm = value.slice('--confirm='.length);
    } else if (value === '--head') {
      args.head = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--head=')) {
      args.head = value.slice('--head='.length);
    } else if (value === '--pr') {
      args.prNumber = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--pr=')) {
      args.prNumber = value.slice('--pr='.length);
    } else if (value === '--title') {
      args.title = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--title=')) {
      args.title = value.slice('--title='.length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return args;
}

function requireNextValue(argv, index, flag) {
  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return nextValue;
}

export function buildGithubPrWritePlan(args, repoRoot) {
  if (args.help) {
    return { help: true };
  }

  if (!args.execute && args.confirm) {
    throw new Error('--confirm is only valid with --execute.');
  }

  if (args.execute && args.confirm !== GITHUB_WRITE_PR_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${GITHUB_WRITE_PR_CONFIRMATION}.`);
  }

  if (args.operation === 'create') {
    return buildCreatePullRequestPlan(args, repoRoot);
  }

  if (args.operation === 'ready') {
    return buildReadyPullRequestPlan(args);
  }

  return buildUpdatePullRequestPlan(args, repoRoot);
}

function buildCreatePullRequestPlan(args, repoRoot) {
  assertBranchName(args.base, '--base');
  assertBranchName(args.head, '--head');
  assertPresent(args.title, '--title is required for create.');
  assertPresent(args.bodyFile, '--body-file is required for create.');

  const body = readPrBodyFile(repoRoot, args.bodyFile);
  return {
    body: {
      base: args.base,
      body,
      draft: true,
      head: args.head,
      maintainer_can_modify: false,
      title: args.title,
    },
    description: `create draft PR from ${args.head} into ${args.base}`,
    execute: args.execute,
    method: 'POST',
    operation: args.operation,
    path: `/repos/${EXPECTED_REPO}/pulls`,
  };
}

function buildUpdatePullRequestPlan(args, repoRoot) {
  assertPrNumber(args.prNumber);

  const body = {};
  if (args.title) {
    body.title = args.title;
  }

  if (args.bodyFile) {
    body.body = readPrBodyFile(repoRoot, args.bodyFile);
  }

  if (Object.keys(body).length === 0) {
    throw new Error('update requires --title or --body-file.');
  }

  return {
    body,
    description: `update PR #${args.prNumber}`,
    execute: args.execute,
    method: 'PATCH',
    operation: args.operation,
    path: `/repos/${EXPECTED_REPO}/pulls/${args.prNumber}`,
    prNumber: Number(args.prNumber),
  };
}

function buildReadyPullRequestPlan(args) {
  assertPrNumber(args.prNumber);

  return {
    body: {
      pullRequestNumber: Number(args.prNumber),
    },
    description: `mark PR #${args.prNumber} ready for review`,
    execute: args.execute,
    graphQlMutation: 'markPullRequestReadyForReview',
    method: 'POST',
    operation: args.operation,
    path: '/graphql',
    prNumber: Number(args.prNumber),
  };
}

export function assertAllowedGithubPrWritePlan(plan) {
  if (plan.operation === 'create') {
    if (plan.method !== 'POST' || plan.path !== `/repos/${EXPECTED_REPO}/pulls`) {
      throw new Error('create operation must use POST /repos/{repo}/pulls.');
    }
    return;
  }

  if (plan.operation === 'update') {
    if (plan.method !== 'PATCH' || !/^\/repos\/governada\/app\/pulls\/[1-9]\d*$/u.test(plan.path)) {
      throw new Error('update operation must use PATCH /repos/{repo}/pulls/{number}.');
    }
    return;
  }

  if (plan.operation === 'ready') {
    if (
      plan.method !== 'POST' ||
      plan.path !== '/graphql' ||
      plan.graphQlMutation !== 'markPullRequestReadyForReview'
    ) {
      throw new Error('ready operation must use GraphQL markPullRequestReadyForReview.');
    }
    return;
  }

  throw new Error(`Unsupported operation: ${plan.operation}`);
}

export function redactGithubPrWritePlan(plan) {
  const redactedBody = { ...plan.body };
  if (typeof redactedBody.body === 'string') {
    redactedBody.body = `[body text: ${redactedBody.body.length} chars]`;
  }

  return {
    body: redactedBody,
    description: plan.description,
    execute: plan.execute,
    method: plan.method,
    operation: plan.operation,
    path: plan.path,
  };
}

export function printGithubPrWriteUsage() {
  console.log(`Usage:
  npm run github:pr-write -- create --head <branch> --title <title> --body-file <path> [--base main] [--execute --confirm ${GITHUB_WRITE_PR_CONFIRMATION}]
  npm run github:pr-write -- update --pr <number> [--title <title>] [--body-file <path>] [--execute --confirm ${GITHUB_WRITE_PR_CONFIRMATION}]
  npm run github:pr-write -- ready --pr <number> [--execute --confirm ${GITHUB_WRITE_PR_CONFIRMATION}]

Dry-run is the default. Live mode is limited to draft PR creation, title/body update on draft PRs, or marking a draft PR ready for review.`);
}

function assertPresent(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

function assertPrNumber(value) {
  if (!/^[1-9]\d*$/u.test(value || '')) {
    throw new Error('--pr must be a positive pull request number.');
  }
}

function assertBranchName(value, flag) {
  assertPresent(value, `${flag} is required.`);

  if (
    value.includes(':') ||
    value.startsWith('-') ||
    value.includes('..') ||
    value.includes('//') ||
    !/^[A-Za-z0-9._/-]+$/u.test(value)
  ) {
    throw new Error(`${flag} must be a same-repository branch name.`);
  }
}

function readPrBodyFile(repoRoot, bodyFile) {
  const resolved = path.resolve(repoRoot, bodyFile);
  const relative = path.relative(repoRoot, resolved);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('--body-file must be inside the current repository.');
  }

  if (BLOCKED_BODY_FILE_BASENAMES.has(path.basename(resolved))) {
    throw new Error('--body-file must not point at local secret/config files.');
  }

  if (!existsSync(resolved)) {
    throw new Error(`--body-file does not exist: ${relative}`);
  }

  const realRepoRoot = realpathSync(repoRoot);
  const realBodyFile = realpathSync(resolved);
  const realRelative = path.relative(realRepoRoot, realBodyFile);

  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('--body-file must be inside the current repository.');
  }

  if (BLOCKED_BODY_FILE_BASENAMES.has(path.basename(realBodyFile))) {
    throw new Error('--body-file must not point at local secret/config files.');
  }

  return readFileSync(realBodyFile, 'utf8');
}
