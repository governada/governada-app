const { runCommand } = require('./lib/runtime');

const HELP = `
Usage:
  npm run git:commit -- --message "your commit message"
  npm run git:commit -- "your commit message"

Options:
  --message <text>  Commit message.
  --all             Stage tracked file modifications with \`git commit -a\`.
  --no-verify       Skip hooks.
  --allow-empty     Allow an empty commit.
`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP.trim());
    process.exit(0);
  }

  const parsed = {
    message: '',
    all: false,
    noVerify: false,
    allowEmpty: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--message' && argv[index + 1]) {
      parsed.message = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--message=')) {
      parsed.message = value.slice('--message='.length);
      continue;
    }

    if (value === '--all') {
      parsed.all = true;
      continue;
    }

    if (value === '--no-verify') {
      parsed.noVerify = true;
      continue;
    }

    if (value === '--allow-empty') {
      parsed.allowEmpty = true;
      continue;
    }

    if (!value.startsWith('--') && !parsed.message) {
      parsed.message = value;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!parsed.message.trim()) {
    throw new Error(
      'Commit message is required. Use --message "..." or pass it as the first argument.',
    );
  }

  return parsed;
}

function main() {
  let parsed;

  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(HELP.trim());
    process.exit(1);
  }

  const args = ['commit', '-m', parsed.message];
  if (parsed.all) {
    args.push('-a');
  }
  if (parsed.noVerify) {
    args.push('--no-verify');
  }
  if (parsed.allowEmpty) {
    args.push('--allow-empty');
  }

  const result = runCommand('git', args);

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status);
}

main();
