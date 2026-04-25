const { runGh } = require('./lib/runtime');

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(
      'Usage: npm run pr:merge -- <PR#> [--method squash|merge|rebase] [--commit-title "..."] [--commit-message "..."]',
    );
    process.exit(0);
  }

  const args = {
    prNumber: argv[0] || '',
    method: 'squash',
    commitTitle: '',
    commitMessage: '',
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--method' && argv[index + 1]) {
      args.method = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--method=')) {
      args.method = value.slice('--method='.length);
    } else if (value === '--commit-title' && argv[index + 1]) {
      args.commitTitle = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--commit-title=')) {
      args.commitTitle = value.slice('--commit-title='.length);
    } else if (value === '--commit-message' && argv[index + 1]) {
      args.commitMessage = argv[index + 1];
      index += 1;
    } else if (value.startsWith('--commit-message=')) {
      args.commitMessage = value.slice('--commit-message='.length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!args.prNumber) {
    throw new Error('Usage: npm run pr:merge -- <PR#> [--method squash|merge|rebase]');
  }

  if (!['squash', 'merge', 'rebase'].includes(args.method)) {
    throw new Error("--method must be one of 'squash', 'merge', or 'rebase'.");
  }

  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repo = process.env.GH_REPO || 'governada/app';
  const request = [
    'api',
    `repos/${repo}/pulls/${args.prNumber}/merge`,
    '-X',
    'PUT',
    '-f',
    `merge_method=${args.method}`,
  ];

  if (args.commitTitle) {
    request.push('-f', `commit_title=${args.commitTitle}`);
  }

  if (args.commitMessage) {
    request.push('-f', `commit_message=${args.commitMessage}`);
  }

  const result = runGh(request);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status);
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
