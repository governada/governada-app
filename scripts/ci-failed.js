const { runCommand, runGh, runGhJson } = require('./lib/runtime');

function parseArgs(argv) {
  const args = { branch: '', runId: '', tail: 20 };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--branch' && argv[index + 1]) {
      args.branch = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--branch=')) {
      args.branch = value.slice('--branch='.length);
    } else if (value === '--run-id' && argv[index + 1]) {
      args.runId = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--run-id=')) {
      args.runId = value.slice('--run-id='.length);
    } else if (value === '--tail' && argv[index + 1]) {
      args.tail = Number.parseInt(argv[index + 1], 10);
      index += 1;
    } else if (value.startsWith('--tail=')) {
      args.tail = Number.parseInt(value.slice('--tail='.length), 10);
    }
  }

  if (!Number.isInteger(args.tail) || args.tail <= 0) {
    args.tail = 20;
  }

  return args;
}

function currentBranch() {
  const result = runCommand('git', ['branch', '--show-current']);
  return result.status === 0 ? result.stdout.trim() : '';
}

function selectRelevantLines(lines, tailCount) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].includes('##[error]')) {
      const start = Math.max(0, index - Math.floor(tailCount / 2));
      const end = Math.min(lines.length, start + tailCount);
      return lines.slice(start, end);
    }
  }

  return lines.slice(-tailCount);
}

function selectRun(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }

  return runs.find((run) => run.workflowName === 'CI') || runs[0];
}

function resolveRunId(args) {
  if (args.runId) {
    return args.runId;
  }

  const branch = args.branch || currentBranch();
  if (!branch) {
    throw new Error('Could not determine branch. Pass --branch or --run-id.');
  }

  const runs = runGhJson([
    'run',
    'list',
    '--branch',
    branch,
    '--limit',
    '10',
    '--json',
    'databaseId,workflowName',
  ]);

  const run = selectRun(runs);
  if (!run || !run.databaseId) {
    throw new Error(`No workflow runs found for branch ${branch}.`);
  }

  return String(run.databaseId);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const runId = resolveRunId(args);
  const result = runGh(['run', 'view', runId, '--log-failed']);
  const combined = `${result.stdout || ''}${result.stderr || ''}`.trimEnd();

  if (result.status !== 0) {
    throw new Error(combined || `Failed to fetch failed logs for run ${runId}.`);
  }

  const lines = combined.split(/\r?\n/);
  const selected = selectRelevantLines(lines, args.tail);
  for (const line of selected) {
    console.log(line);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
