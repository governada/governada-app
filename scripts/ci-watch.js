const { runCommand, runGhJson, sleep } = require('./lib/runtime');

function parseArgs(argv) {
  const args = { branch: '' };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--branch' && argv[index + 1]) {
      args.branch = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--branch=')) {
      args.branch = value.slice('--branch='.length);
    }
  }

  return args;
}

function currentBranch() {
  const result = runCommand('git', ['branch', '--show-current']);
  return result.status === 0 ? result.stdout.trim() : '';
}

function selectRun(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return null;
  }

  return runs.find((run) => run.workflowName === 'CI') || runs[0];
}

function summarize(run) {
  const workflow = run.workflowName || 'CI';
  const status = run.status || 'unknown';
  const conclusion = run.conclusion ? `/${run.conclusion}` : '';
  const title = run.displayTitle ? ` - ${run.displayTitle}` : '';
  return `${workflow}: ${status}${conclusion}${title}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const branch = args.branch || currentBranch();

  if (!branch) {
    console.error('Could not determine branch. Pass --branch <name>.');
    process.exit(1);
  }

  console.log(`Watching latest CI run for branch ${branch}...`);

  let lastSummary = '';
  let seenRunId = '';

  while (true) {
    const runs = runGhJson([
      'run',
      'list',
      '--branch',
      branch,
      '--limit',
      '10',
      '--json',
      'databaseId,status,conclusion,workflowName,displayTitle,url',
    ]);

    const run = selectRun(runs);
    if (!run) {
      console.log('No workflow runs found yet. Waiting...');
      await sleep(10000);
      continue;
    }
    const runId = String(run.databaseId || '');
    const summary = summarize(run);

    if (runId !== seenRunId || summary !== lastSummary) {
      console.log(summary);
      if (run.url) {
        console.log(run.url);
      }
      seenRunId = runId;
      lastSummary = summary;
    }

    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        process.exit(0);
      }

      console.error(`CI finished with conclusion=${run.conclusion || 'unknown'}.`);
      process.exit(1);
    }

    await sleep(10000);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
