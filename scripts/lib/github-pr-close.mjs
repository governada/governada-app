import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

import { EXPECTED_REPO, GITHUB_OPERATION_CLASSES } from './github-app-auth.mjs';

const FULL_SHA_RE = /^[a-f0-9]{40}$/iu;

export const GITHUB_PR_CLOSE_CONFIRMATION = GITHUB_OPERATION_CLASSES.prClose;

export function parseGithubPrCloseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const args = {
    approval: '',
    approvalFile: '',
    confirm: '',
    execute: false,
    expectedHead: '',
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

export function buildGithubPrClosePlan(args, repoRoot, env = process.env) {
  if (args.help) {
    return { help: true };
  }

  if (!args.execute && args.confirm) {
    throw new Error('--confirm is only valid with --execute.');
  }

  if (!args.execute && (args.approval || args.approvalFile)) {
    throw new Error('--approval and --approval-file are only valid with --execute.');
  }

  if (args.execute && args.confirm !== GITHUB_PR_CLOSE_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${GITHUB_PR_CLOSE_CONFIRMATION}.`);
  }

  assertPrNumber(args.prNumber);
  assertExpectedHead(args.expectedHead);

  const approvalText = readApprovalText(args, repoRoot, env);
  if (args.execute) {
    const approval = parseGithubPrCloseApproval({
      expectedHead: args.expectedHead,
      prNumber: Number(args.prNumber),
      text: approvalText,
    });

    if (!approval.ok) {
      throw new Error(
        `PR close approval is not current or specific: ${approval.reasons.join('; ')}`,
      );
    }
  }

  return {
    approvalText: args.execute ? approvalText : '',
    body: {
      state: 'closed',
    },
    description: `close draft PR #${args.prNumber} with expected head ${args.expectedHead}`,
    execute: args.execute,
    expectedHead: args.expectedHead,
    method: 'PATCH',
    operation: 'close',
    path: `/repos/${EXPECTED_REPO}/pulls/${args.prNumber}`,
    prNumber: Number(args.prNumber),
  };
}

export function assertAllowedGithubPrClosePlan(plan) {
  if (
    plan.operation !== 'close' ||
    plan.method !== 'PATCH' ||
    !/^\/repos\/governada\/app\/pulls\/[1-9]\d*$/u.test(plan.path)
  ) {
    throw new Error('close operation must use PATCH /repos/{repo}/pulls/{number}.');
  }

  assertPrCloseBody(plan.body);
  assertExpectedHead(plan.expectedHead);
}

export function assertPrCloseBody(body) {
  const keys = Object.keys(body || {});
  if (keys.length !== 1 || body?.state !== 'closed') {
    throw new Error('github.pr.close may only set state=closed.');
  }
}

export function parseGithubPrCloseApproval({
  expectedHead,
  operationClass = GITHUB_PR_CLOSE_CONFIRMATION,
  prNumber,
  text,
}) {
  const reasons = [];
  const approvalText = String(text || '').trim();
  const normalizedText = approvalText.replace(/\s+/gu, ' ');
  const lowerText = normalizedText.toLowerCase();

  if (!approvalText) {
    reasons.push('approval text is missing');
    return { ok: false, reasons };
  }

  if (!/\bapprov(?:e|ed|ing)\b/u.test(lowerText)) {
    reasons.push('approval must explicitly approve the operation');
  }

  if (!lowerText.includes(operationClass)) {
    reasons.push(`approval must name ${operationClass}`);
  }

  if (!lowerText.includes(EXPECTED_REPO)) {
    reasons.push(`approval must name repo ${EXPECTED_REPO}`);
  }

  if (!approvalNamesPr(normalizedText, prNumber)) {
    reasons.push(`approval must name PR #${Number(prNumber)}`);
  }

  if (!expectedHead || !lowerText.includes(String(expectedHead).toLowerCase())) {
    reasons.push('approval must include the expected head SHA');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

function approvalNamesPr(text, prNumber) {
  if (!Number.isInteger(Number(prNumber)) || Number(prNumber) <= 0) {
    return false;
  }

  return (
    new RegExp(`\\bpr\\s*#?\\s*${Number(prNumber)}\\b`, 'iu').test(text) ||
    new RegExp(`\\bpull request\\s*#?\\s*${Number(prNumber)}\\b`, 'iu').test(text)
  );
}

export function evaluatePullRequestForClose(pullRequest, expectedHead, repo = EXPECTED_REPO) {
  const blockers = [];
  const passes = [];
  const prNumber = pullRequest?.number || 'unknown';

  if (pullRequest?.state === 'open') {
    passes.push(`PR #${prNumber} is open`);
  } else {
    blockers.push(`PR #${prNumber} is ${pullRequest?.state || 'unknown'}, expected open`);
  }

  if (pullRequest?.draft === true) {
    passes.push(`PR #${prNumber} is draft`);
  } else {
    blockers.push(`PR #${prNumber} is not draft; github.pr.close v1 only closes draft PRs`);
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
    blockers.push('github.pr.close must not operate on main as the PR head branch');
  }

  return { blockers, passes };
}

export function evaluateGithubPrCloseBrokerStatus(status, repo = EXPECTED_REPO) {
  const blockers = [];
  const passes = [];
  const supportedOperationClasses = Array.isArray(status?.supportedOperationClasses)
    ? status.supportedOperationClasses
    : [];

  if (status?.running === true) {
    passes.push('GitHub runtime broker is running');
  } else {
    blockers.push(
      `GitHub runtime broker is not running${status?.error ? `: ${status.error}` : ''}`,
    );
  }

  if (status?.repo === repo) {
    passes.push(`GitHub runtime broker is scoped to ${repo}`);
  } else {
    blockers.push(
      `GitHub runtime broker is scoped to ${status?.repo || 'unknown'}, expected ${repo}`,
    );
  }

  if (supportedOperationClasses.includes(GITHUB_OPERATION_CLASSES.prClose)) {
    passes.push(`GitHub runtime broker advertises ${GITHUB_OPERATION_CLASSES.prClose}`);
  } else {
    blockers.push(
      `GitHub runtime broker does not advertise ${GITHUB_OPERATION_CLASSES.prClose}; refresh the broker from current shared main before live PR close`,
    );
  }

  return { blockers, passes };
}

export function redactGithubPrClosePlan(plan) {
  return {
    body: plan.body,
    description: plan.description,
    execute: plan.execute,
    method: plan.method,
    operation: plan.operation,
    path: plan.path,
  };
}

export function printGithubPrCloseUsage() {
  console.log(`Usage:
  npm run github:pr-close -- --pr <number> --expected-head <40-char-sha>
  npm run github:pr-close -- --pr <number> --expected-head <40-char-sha> --execute --confirm ${GITHUB_PR_CLOSE_CONFIRMATION} --approval-file <path>

Dry-run is the default and reads the target PR through the broker when available. Live mode is limited to closing an open draft PR in governada/app after expected-head validation and prompt-specific approval.`);
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

  return env.GOVERNADA_GITHUB_PR_CLOSE_APPROVAL || '';
}
