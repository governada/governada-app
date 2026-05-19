#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const DEFAULT_REPO = 'governada/app';
export const REQUIRED_MERGE_CHECKS = ['checks', 'test', 'validate-pr-body'];
export const INFORMATIONAL_CHECKS = ['Supabase Preview'];

const DEFAULT_CHECK_TIMEOUT_MS = Number.parseInt(
  process.env.GITHUB_MERGE_CHECK_TIMEOUT_MS || String(10 * 60 * 1000),
  10,
);
const DEFAULT_CHECK_POLL_MS = Number.parseInt(
  process.env.GITHUB_MERGE_CHECK_POLL_MS || String(10 * 1000),
  10,
);

const SUCCESS_VALUES = new Set(['success', 'successful', 'passed', 'pass', 'neutral', 'skipped']);
const FAILURE_VALUES = new Set([
  'action_required',
  'cancelled',
  'canceled',
  'error',
  'failure',
  'failed',
  'startup_failure',
  'timed_out',
]);
const PENDING_VALUES = new Set([
  'expected',
  'in_progress',
  'pending',
  'queued',
  'requested',
  'waiting',
]);

function numberFromEnv(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseGithubMergeArgs(argv, env = process.env) {
  const options = {
    checkPollMs: numberFromEnv(env.GITHUB_MERGE_CHECK_POLL_MS, DEFAULT_CHECK_POLL_MS),
    checkTimeoutMs: numberFromEnv(env.GITHUB_MERGE_CHECK_TIMEOUT_MS, DEFAULT_CHECK_TIMEOUT_MS),
    forceMergeWithFailingChecks: false,
    help: false,
    mergeArgs: [],
    prNumber: '',
    repo: DEFAULT_REPO,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    if (arg === '--force-merge-with-failing-checks') {
      options.forceMergeWithFailingChecks = true;
      continue;
    }

    if (arg === '--check-timeout-ms') {
      options.checkTimeoutMs = parseNonNegativeInt(argv[++index], arg);
      continue;
    }

    if (arg.startsWith('--check-timeout-ms=')) {
      options.checkTimeoutMs = parseNonNegativeInt(arg.slice('--check-timeout-ms='.length), arg);
      continue;
    }

    if (arg === '--check-poll-ms') {
      options.checkPollMs = parseNonNegativeInt(argv[++index], arg);
      continue;
    }

    if (arg.startsWith('--check-poll-ms=')) {
      options.checkPollMs = parseNonNegativeInt(arg.slice('--check-poll-ms='.length), arg);
      continue;
    }

    if (arg === '--pr') {
      options.prNumber = parsePrNumber(argv[++index]);
      continue;
    }

    if (arg.startsWith('--pr=')) {
      options.prNumber = parsePrNumber(arg.slice('--pr='.length));
      continue;
    }

    if (arg === '--repo' || arg === '-R') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) {
        throw new Error(`${arg} requires a repository value.`);
      }
      options.repo = value;
      options.mergeArgs.push(arg, value);
      continue;
    }

    if (arg.startsWith('--repo=')) {
      options.repo = arg.slice('--repo='.length);
      options.mergeArgs.push(arg);
      continue;
    }

    if (arg.startsWith('-R') && arg.length > 2) {
      options.repo = arg.slice(2);
      options.mergeArgs.push(arg);
      continue;
    }

    const positionalPr = !arg.startsWith('-') ? parsePrNumber(arg, { optional: true }) : '';
    if (!options.prNumber && positionalPr) {
      options.prNumber = positionalPr;
      continue;
    }

    options.mergeArgs.push(arg);
  }

  return options;
}

function parseNonNegativeInt(value, flag) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${flag} requires a non-negative integer value.`);
  }
  return parsed;
}

function parsePrNumber(value, { optional = false } = {}) {
  const text = String(value || '').trim();
  const match = text.match(/(?:^#?|\/pull\/)([1-9]\d*)$/u);
  if (match) {
    return match[1];
  }
  if (/^[1-9]\d*$/u.test(text)) {
    return text;
  }
  if (optional) {
    return '';
  }
  throw new Error(`Expected a pull request number, got: ${text || '(empty)'}`);
}

export function buildGhPrMergeArgs(options) {
  const args = ['pr', 'merge', options.prNumber, ...options.mergeArgs];
  if (!hasRepoArg(options.mergeArgs)) {
    args.push('--repo', options.repo || DEFAULT_REPO);
  }
  return args;
}

function hasRepoArg(args) {
  return args.some(
    (arg) => arg === '--repo' || arg === '-R' || arg.startsWith('--repo=') || /^-R./u.test(arg),
  );
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();
}

function checkLabel(item) {
  return (
    item?.name ||
    item?.context ||
    item?.title ||
    item?.workflowName ||
    item?.workflow ||
    item?.app?.name ||
    item?.__typename ||
    'unknown'
  );
}

function matchesCheckName(item, requiredName) {
  const required = normalizeName(requiredName);
  const label = normalizeName(checkLabel(item));
  const candidates = [
    label,
    normalizeName(item?.context),
    normalizeName(item?.name),
    normalizeName(item?.title),
  ].filter(Boolean);

  return candidates.some(
    (candidate) =>
      candidate === required ||
      candidate.endsWith(` / ${required}`) ||
      candidate.endsWith(`/${required}`),
  );
}

function checkTime(item) {
  for (const key of [
    'completedAt',
    'completed_at',
    'startedAt',
    'started_at',
    'createdAt',
    'created_at',
  ]) {
    const value = item?.[key];
    if (!value) {
      continue;
    }
    const time = Date.parse(value);
    if (Number.isFinite(time)) {
      return time;
    }
  }
  return Number(item?.databaseId || item?.id || 0) || 0;
}

function newestMatchingItem(items, requiredName) {
  const matches = items.filter((item) => matchesCheckName(item, requiredName));
  return matches.sort((left, right) => checkTime(right) - checkTime(left))[0] || null;
}

function normalizeValue(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/gu, '_')
    .toLowerCase();
}

function classifyCheck(item) {
  const state = normalizeValue(item?.state);
  const status = normalizeValue(item?.status);
  const conclusion = normalizeValue(item?.conclusion);

  if (state) {
    if (SUCCESS_VALUES.has(state)) return 'success';
    if (FAILURE_VALUES.has(state)) return 'failure';
    if (PENDING_VALUES.has(state)) return 'pending';
  }

  if (status && status !== 'completed') {
    if (SUCCESS_VALUES.has(status)) return 'success';
    if (FAILURE_VALUES.has(status)) return 'failure';
    return 'pending';
  }

  if (conclusion) {
    if (SUCCESS_VALUES.has(conclusion)) return 'success';
    if (FAILURE_VALUES.has(conclusion)) return 'failure';
    if (PENDING_VALUES.has(conclusion)) return 'pending';
    return 'failure';
  }

  if (status === 'completed') {
    return 'success';
  }

  return 'pending';
}

function statusDetail(item) {
  const values = [
    item?.state ? `state=${item.state}` : '',
    item?.status ? `status=${item.status}` : '',
    item?.conclusion ? `conclusion=${item.conclusion}` : '',
  ].filter(Boolean);
  return values.length > 0 ? values.join(' ') : 'status unknown';
}

export function normalizeStatusCheckRollup(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (Array.isArray(input?.statusCheckRollup)) {
    return input.statusCheckRollup;
  }
  if (Array.isArray(input?.statusCheckRollup?.nodes)) {
    return input.statusCheckRollup.nodes;
  }
  if (Array.isArray(input?.nodes)) {
    return input.nodes;
  }
  return [];
}

export function evaluateRequiredChecks(
  statusCheckRollup,
  { informationalChecks = INFORMATIONAL_CHECKS, requiredChecks = REQUIRED_MERGE_CHECKS } = {},
) {
  const items = normalizeStatusCheckRollup(statusCheckRollup);
  const blockers = [];
  const passes = [];
  const warnings = [];

  for (const requiredName of requiredChecks) {
    const item = newestMatchingItem(items, requiredName);
    if (!item) {
      blockers.push(`${requiredName}: missing from statusCheckRollup`);
      continue;
    }

    const state = classifyCheck(item);
    if (state === 'success') {
      passes.push(`${requiredName}: green`);
      continue;
    }

    blockers.push(`${requiredName}: ${state} (${checkLabel(item)} ${statusDetail(item)})`);
  }

  for (const informationalName of informationalChecks) {
    const item = newestMatchingItem(items, informationalName);
    if (!item) {
      continue;
    }

    const state = classifyCheck(item);
    if (state !== 'success') {
      warnings.push(
        `${informationalName}: ${state} (${statusDetail(item)}); known-broken informational check, not a merge blocker for F7`,
      );
    }
  }

  return {
    blockers,
    ok: blockers.length === 0,
    passes,
    warnings,
  };
}

export function decideMergeGate(
  evaluation,
  { forceMergeWithFailingChecks = false, prNumber = '' } = {},
) {
  if (evaluation.ok) {
    return {
      audit: forceMergeWithFailingChecks
        ? `OVERRIDE UNUSED: --force-merge-with-failing-checks was supplied for PR #${prNumber}, but required checks are green.`
        : '',
      ok: true,
    };
  }

  if (forceMergeWithFailingChecks) {
    return {
      audit: `OVERRIDE: --force-merge-with-failing-checks used for PR #${prNumber}; required checks not green: ${evaluation.blockers.join('; ')}`,
      ok: true,
    };
  }

  return {
    audit: '',
    ok: false,
  };
}

function runGh(ghBin, args, options = {}) {
  return spawnSync(ghBin, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs || 60_000,
  });
}

function readStatusCheckRollup({ ghBin, prNumber, repo }) {
  const result = runGh(ghBin, [
    'pr',
    'view',
    prNumber,
    '--repo',
    repo,
    '--json',
    'statusCheckRollup',
  ]);

  if (result.status !== 0 || result.error) {
    const detail = [result.stderr, result.error?.message].filter(Boolean).join('\n').trim();
    throw new Error(detail || `gh pr view ${prNumber} failed`);
  }

  const parsed = JSON.parse(result.stdout || '{}');
  return normalizeStatusCheckRollup(parsed);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForRequiredChecks({ ghBin, options }) {
  const deadline = Date.now() + options.checkTimeoutMs;
  let lastEvaluation = null;

  do {
    const rollup = readStatusCheckRollup({
      ghBin,
      prNumber: options.prNumber,
      repo: options.repo,
    });
    const evaluation = evaluateRequiredChecks(rollup);
    lastEvaluation = evaluation;

    const hasPendingOnly =
      !evaluation.ok &&
      evaluation.blockers.every(
        (blocker) => blocker.includes(': pending') || blocker.includes(': missing'),
      );

    if (evaluation.ok || !hasPendingOnly || options.forceMergeWithFailingChecks) {
      return evaluation;
    }

    if (Date.now() >= deadline) {
      return evaluation;
    }

    console.error(
      `Required merge checks still pending for PR #${options.prNumber}; polling again in ${options.checkPollMs}ms.`,
    );
    await sleep(options.checkPollMs);
  } while (Date.now() <= deadline);

  return lastEvaluation || evaluateRequiredChecks([]);
}

function printUsage() {
  console.log(`Usage:
  npm run github:merge -- <PR#> [gh pr merge flags]
  npm run github:merge -- --pr <PR#> [gh pr merge flags]

Required checks before merge:
  ${REQUIRED_MERGE_CHECKS.join(', ')}

Options consumed by this wrapper:
  --force-merge-with-failing-checks   Loud Tim-only override; still prints failing checks.
  --check-timeout-ms <ms>             Wait for pending required checks before refusing.
  --check-poll-ms <ms>                Poll interval while required checks are pending.

Supabase Preview is reported as a known-broken informational check until the preview-branch blocker is closed.`);
}

async function main() {
  const options = parseGithubMergeArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!options.prNumber) {
    throw new Error('Pass a pull request number as a positional argument or with --pr <number>.');
  }

  const ghBin = process.env.GOVERNADA_GH_BIN || 'gh';
  const evaluation = await waitForRequiredChecks({ ghBin, options });
  for (const warning of evaluation.warnings) {
    console.error(`WARNING: ${warning}`);
  }

  const decision = decideMergeGate(evaluation, {
    forceMergeWithFailingChecks: options.forceMergeWithFailingChecks,
    prNumber: options.prNumber,
  });

  if (!decision.ok) {
    console.error(`BLOCKED: required merge checks are not green for PR #${options.prNumber}.`);
    for (const blocker of evaluation.blockers) {
      console.error(`  - ${blocker}`);
    }
    console.error(
      'Use --force-merge-with-failing-checks only for explicit Tim-approved emergencies.',
    );
    process.exit(1);
  }

  if (decision.audit) {
    console.error(decision.audit);
  }

  if (evaluation.ok) {
    console.log(
      `Required merge checks passed for PR #${options.prNumber}: ${REQUIRED_MERGE_CHECKS.join(', ')}`,
    );
  }

  const mergeResult = runGh(ghBin, buildGhPrMergeArgs(options), {
    stdio: 'inherit',
    timeoutMs: 10 * 60 * 1000,
  });
  if (mergeResult.error) {
    throw mergeResult.error;
  }
  process.exit(mergeResult.status ?? 1);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
