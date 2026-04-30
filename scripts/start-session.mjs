#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const brainRoot = process.env.GOVERNADA_BRAIN_ROOT || '/Users/tim/dev/governada/governada-brain';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 5 * 1024 * 1024,
    ...options,
  });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || '',
  };
}

function oneLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function recentMarkdown(dir, limit = 3) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const path = join(dir, name);
      return { name, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limit);
}

function frontmatterValue(content, key) {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const status = run('git', ['status', '-sb']).stdout || 'git status unavailable';
const branch = status.split('\n')[0]?.replace(/^##\s*/, '') || 'unknown branch';
const doctor = run('npm', ['run', '-s', 'session:doctor']);
const doctorStatus = doctor.stdout.match(/^Status:\s*(.+)$/m)?.[1];
const doctorLine = doctor.ok
  ? oneLine(doctorStatus ? `status ${doctorStatus}` : 'session:doctor passed')
  : oneLine(doctor.stderr || doctor.stdout || `session:doctor failed (${doctor.status})`);

const plans = recentMarkdown(join(brainRoot, 'plans'), 8);
const branchTokens = new Set(
  branch
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3),
);
let activePlan = plans.find((plan) =>
  basename(plan.name, '.md')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((token) => branchTokens.has(token)),
);
activePlan ||= plans.find((plan) => {
  const content = readFileSync(plan.path, 'utf8');
  return /status:\s*(approved|active|in_progress)|implementation_allowed:\s*true/i.test(content);
});

let activePlanLine = 'none found';
if (activePlan) {
  const content = readFileSync(activePlan.path, 'utf8');
  const statusValue = frontmatterValue(content, 'status') || 'unknown';
  activePlanLine = `${activePlan.name} (${statusValue})`;
}

const learnings = recentMarkdown(join(brainRoot, 'learnings'), 3).map((entry) => entry.name);
const commits = run('git', ['log', '--oneline', '-3']).stdout.split('\n').filter(Boolean);
const porcelainChanges = status.split('\n').slice(1).filter(Boolean).length;
const staged = run('git', ['diff', '--name-only', '--cached'])
  .stdout.split('\n')
  .filter(Boolean).length;
const branchDiff = run('git', ['diff', '--name-only', 'origin/main...HEAD'])
  .stdout.split('\n')
  .filter(Boolean).length;

const lines = [
  'Start session briefing',
  `cwd: ${process.cwd()}`,
  `branch: ${branch}`,
  `session:doctor: ${doctorLine}`,
  `active plan: ${activePlanLine}`,
  `recent learnings: ${learnings.length ? learnings.join(', ') : 'none found'}`,
  `git status: ${oneLine(status)}`,
  `branch diff: ${branchDiff} files; staged: ${staged}; local changes: ${porcelainChanges}`,
  `recent commit: ${commits[0] || 'none'}`,
  `recent commit: ${commits[1] || 'none'}`,
  `recent commit: ${commits[2] || 'none'}`,
  'open work: inspect active plan, then choose plan/review/ship path',
  'What do you want to work on?',
];

console.log(lines.join('\n'));
