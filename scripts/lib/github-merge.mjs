import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { EXPECTED_REPO } from './github-app-auth.mjs';
import { GITHUB_MERGE_CONFIRMATION, parseGithubMergeApproval } from './github-merge-approval.mjs';

const FULL_SHA_RE = /^[a-f0-9]{40}$/iu;
const ALLOWED_MERGE_METHODS = new Set(['merge', 'rebase', 'squash']);
const SUCCESSFUL_CHECK_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);
const BLOCKING_MERGE_STATES = new Set(['behind', 'blocked', 'dirty', 'draft', 'unknown']);

export function parseGithubMergeArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const args = {
    approval: '',
    approvalFile: '',
    confirm: '',
    execute: false,
    expectedHead: '',
    method: 'squash',
    prNumber: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--execute') {
      args.execute = true;
    } else if (value === '--approval') {
      args.approval = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--approval=')) {
      args.approval = value.slice('--approval='.length);
    } else if (value === '--approval-file') {
      args.approvalFile = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--approval-file=')) {
      args.approvalFile = value.slice('--approval-file='.length);
    } else if (value === '--confirm') {
      args.confirm = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--confirm=')) {
      args.confirm = value.slice('--confirm='.length);
    } else if (value === '--expected-head') {
      args.expectedHead = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--expected-head=')) {
      args.expectedHead = value.slice('--expected-head='.length);
    } else if (value === '--method') {
      args.method = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--method=')) {
      args.method = value.slice('--method='.length);
    } else if (value === '--pr') {
      args.prNumber = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--pr=')) {
      args.prNumber = value.slice('--pr='.length);
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

export function buildGithubMergePlan(args, repoRoot, env = process.env) {
  if (args.help) {
    return { help: true };
  }

  if (!args.execute && args.confirm) {
    throw new Error('--confirm is only valid with --execute.');
  }

  if (args.execute && args.confirm !== GITHUB_MERGE_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${GITHUB_MERGE_CONFIRMATION}.`);
  }

  assertPrNumber(args.prNumber);
  assertExpectedHead(args.expectedHead);

  if (!ALLOWED_MERGE_METHODS.has(args.method)) {
    throw new Error('--method must be one of merge, rebase, or squash.');
  }

  const approvalText = readApprovalText(args, repoRoot, env);
  if (args.execute) {
    const approval = parseGithubMergeApproval({
      expectedHead: args.expectedHead,
      prNumber: Number(args.prNumber),
      text: approvalText,
    });

    if (!approval.ok) {
      throw new Error(`merge approval is not current or specific: ${approval.reasons.join('; ')}`);
    }
  }

  return {
    approvalText: args.execute ? approvalText : '',
    body: {
      merge_method: args.method,
      sha: args.expectedHead,
    },
    description: `merge PR #${args.prNumber} with expected head ${args.expectedHead}`,
    execute: args.execute,
    expectedHead: args.expectedHead,
    method: 'PUT',
    mergeMethod: args.method,
    operation: 'merge',
    path: `/repos/${EXPECTED_REPO}/pulls/${args.prNumber}/merge`,
    prNumber: Number(args.prNumber),
  };
}

export function assertAllowedGithubMergePlan(plan) {
  if (
    plan.operation !== 'merge' ||
    plan.method !== 'PUT' ||
    !/^\/repos\/governada\/app\/pulls\/[1-9]\d*\/merge$/u.test(plan.path)
  ) {
    throw new Error('merge operation must use PUT /repos/{repo}/pulls/{number}/merge.');
  }

  if (plan.body?.sha !== plan.expectedHead) {
    throw new Error('merge operation must pin the expected head SHA in the request body.');
  }

  if (!ALLOWED_MERGE_METHODS.has(plan.body?.merge_method)) {
    throw new Error('merge operation must use an allowed merge method.');
  }
}

export function redactGithubMergePlan(plan) {
  return {
    body: plan.body,
    description: plan.description,
    execute: plan.execute,
    method: plan.method,
    operation: plan.operation,
    path: plan.path,
  };
}

export function evaluatePullRequestForMerge(pullRequest, expectedHead, repo = EXPECTED_REPO) {
  const blockers = [];
  const passes = [];
  const prNumber = pullRequest?.number || 'unknown';

  if (pullRequest?.state === 'open') {
    passes.push(`PR #${prNumber} is open`);
  } else {
    blockers.push(`PR #${prNumber} is ${pullRequest?.state || 'unknown'}, expected open`);
  }

  if (pullRequest?.draft === false) {
    passes.push(`PR #${prNumber} is ready for review`);
  } else {
    blockers.push(`PR #${prNumber} is draft or draft state is unknown`);
  }

  if (pullRequest?.base?.repo?.full_name === repo && pullRequest?.base?.ref === 'main') {
    passes.push(`PR #${prNumber} targets ${repo}:main`);
  } else {
    blockers.push(
      `PR #${prNumber} targets ${pullRequest?.base?.repo?.full_name || 'unknown'}:${pullRequest?.base?.ref || 'unknown'}, expected ${repo}:main`,
    );
  }

  if (pullRequest?.head?.repo?.full_name === repo) {
    passes.push(`PR #${prNumber} head is same-repository`);
  } else {
    blockers.push(
      `PR #${prNumber} head repo is ${pullRequest?.head?.repo?.full_name || 'unknown'}, expected ${repo}`,
    );
  }

  if (pullRequest?.head?.sha === expectedHead) {
    passes.push(`PR #${prNumber} head SHA matches ${expectedHead}`);
  } else {
    blockers.push(
      `PR #${prNumber} head SHA is ${pullRequest?.head?.sha || 'unknown'}, expected ${expectedHead}`,
    );
  }

  if (pullRequest?.head?.ref === 'main') {
    blockers.push('merge lane must not operate on main as the PR head branch');
  }

  const mergeableState = pullRequest?.mergeable_state || '';
  if (!mergeableState) {
    blockers.push(`PR #${prNumber} mergeable_state is unknown`);
  } else if (BLOCKING_MERGE_STATES.has(mergeableState)) {
    blockers.push(`PR #${prNumber} mergeable_state is ${mergeableState}`);
  } else if (mergeableState) {
    passes.push(`PR #${prNumber} mergeable_state is ${mergeableState}`);
  }

  if (hasReviewGateRecord(pullRequest?.body || '')) {
    passes.push(`PR #${prNumber} records Review Gate v0`);
  } else {
    blockers.push(`PR #${prNumber} body does not record Review Gate v0`);
  }

  return { blockers, passes };
}

export function evaluateGithubChecksForMerge({ checkRuns, combinedStatus, ...options }) {
  const blockers = [];
  const passes = [];
  const runs = Array.isArray(checkRuns) ? checkRuns : [];
  const statuses = Array.isArray(combinedStatus?.statuses) ? combinedStatus.statuses : [];
  const totalCount = Number.isFinite(Number(options.checkRunsTotalCount))
    ? Number(options.checkRunsTotalCount)
    : runs.length;

  if (totalCount > runs.length) {
    blockers.push(
      `check runs response is truncated (${runs.length}/${totalCount}); paginate before merge`,
    );
  }

  for (const run of runs) {
    if (run.status !== 'completed') {
      blockers.push(`check run "${run.name || run.id || 'unknown'}" is ${run.status || 'unknown'}`);
      continue;
    }

    if (!SUCCESSFUL_CHECK_CONCLUSIONS.has(run.conclusion)) {
      blockers.push(
        `check run "${run.name || run.id || 'unknown'}" concluded ${run.conclusion || 'unknown'}`,
      );
    }
  }

  for (const status of statuses) {
    if (status.state !== 'success') {
      blockers.push(
        `commit status "${status.context || status.id || 'unknown'}" is ${status.state || 'unknown'}`,
      );
    }
  }

  if (combinedStatus?.state && combinedStatus.state !== 'success') {
    blockers.push(`combined commit status is ${combinedStatus.state}`);
  }

  if (runs.length === 0 && statuses.length === 0) {
    blockers.push('no check runs or commit statuses were found for the expected head');
  }

  if (blockers.length === 0) {
    const checkCount = runs.length + statuses.length;
    passes.push(`${checkCount} check/status result(s) are green`);
  }

  return { blockers, passes };
}

export function hasReviewGateRecord(body) {
  const text = String(body || '').toLowerCase();
  return (
    text.includes('review gate') &&
    (/\breview tier\b/u.test(text) || /\btier\s*:?\s*l[0-4]\b/u.test(text)) &&
    /\bfindings?\b/u.test(text)
  );
}

export function printGithubMergeUsage() {
  console.log(`Usage:
  npm run github:merge -- --pr <number> --expected-head <40-char-sha> [--method squash|merge|rebase]
  npm run github:merge -- --pr <number> --expected-head <40-char-sha> --execute --confirm ${GITHUB_MERGE_CONFIRMATION} --approval-file <path>

Dry-run is the default. Live mode requires prompt-specific approval naming repo, PR number, ${GITHUB_MERGE_CONFIRMATION}, expected head SHA, green checks, and unchanged head.`);
}

function assertPrNumber(value) {
  if (!/^[1-9]\d*$/u.test(value || '')) {
    throw new Error('--pr must be a positive pull request number.');
  }
}

function assertExpectedHead(value) {
  if (!FULL_SHA_RE.test(value || '')) {
    throw new Error('--expected-head must be a 40-character commit SHA.');
  }
}

function readApprovalText(args, repoRoot, env) {
  if (args.approval && args.approvalFile) {
    throw new Error('Use --approval or --approval-file, not both.');
  }

  if (args.approval) {
    return args.approval;
  }

  if (args.approvalFile) {
    const resolved = path.resolve(repoRoot, args.approvalFile);
    const relative = path.relative(repoRoot, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('--approval-file must be inside the current repository.');
    }

    if (!existsSync(resolved)) {
      throw new Error(`--approval-file does not exist: ${relative}`);
    }

    const realRepoRoot = realpathSync(repoRoot);
    const realApprovalFile = realpathSync(resolved);
    const realRelative = path.relative(realRepoRoot, realApprovalFile);
    if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error('--approval-file must be inside the current repository.');
    }

    return readFileSync(resolved, 'utf8');
  }

  return env.GOVERNADA_GITHUB_MERGE_APPROVAL || '';
}
