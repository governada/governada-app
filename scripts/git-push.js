const { runCommand } = require('./lib/runtime');

const HELP = `
Usage:
  npm run git:push
  npm run git:push -- --branch <name>
  npm run git:push -- --set-upstream

Pushes the current branch with a stable repo wrapper so Windows Codex agents can avoid raw \`git push\`.
If the branch has no upstream, the wrapper automatically uses \`git push -u origin <branch>\`.
`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP.trim());
    process.exit(0);
  }

  const parsed = {
    branch: '',
    setUpstream: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--branch' && argv[index + 1]) {
      parsed.branch = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--branch=')) {
      parsed.branch = value.slice('--branch='.length);
      continue;
    }

    if (value === '--set-upstream') {
      parsed.setUpstream = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return parsed;
}

function currentBranch() {
  const result = runCommand('git', ['branch', '--show-current']);
  return result.status === 0 ? result.stdout.trim() : '';
}

function hasUpstream() {
  const result = runCommand('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  return result.status === 0;
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

  const branch = parsed.branch || currentBranch();
  if (!branch) {
    console.error('Could not determine the current branch. Pass --branch <name>.');
    process.exit(1);
  }

  const args = parsed.setUpstream || !hasUpstream() ? ['push', '-u', 'origin', branch] : ['push'];
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
