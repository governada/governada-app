const fs = require('node:fs');

const { runCommand } = require('./lib/runtime');

const HELP = `
Usage:
  npm run git:push
  npm run git:push -- --branch <name>
  npm run git:push -- --set-upstream

Pushes the current branch with a stable repo wrapper so Windows Codex agents can avoid raw \`git push\`.
If the branch has no upstream, the wrapper automatically uses \`git push -u origin <branch>\`.
The wrapper mirrors the repo's Husky pre-push checks, then disables Husky for the actual push to avoid
the Windows Git Bash \`sh.exe\` crash that can block agentic pushes in Codex Desktop.
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

function upstreamBranch() {
  const result = runCommand('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  return result.status === 0 ? result.stdout.trim() : '';
}

function runOrExit(command, args, options = {}) {
  const result = runCommand(command, args, options);

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function changedTypeScriptFiles() {
  const headCheck = runCommand('git', ['rev-parse', '--verify', 'HEAD~1']);
  if (headCheck.status !== 0) {
    return [];
  }

  const diff = runCommand('git', ['diff', '--name-only', 'HEAD~1', 'HEAD']);
  if (diff.status !== 0) {
    return [];
  }

  return diff.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter((value) => value && /\.(ts|tsx)$/u.test(value) && fs.existsSync(value));
}

function runPushChecks() {
  console.log('Running push checks...');
  runOrExit('npm', ['run', 'type-check']);

  const files = changedTypeScriptFiles();
  if (files.length === 0) {
    return;
  }

  runOrExit('npx', ['eslint', '--cache', '--quiet', ...files]);
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

  const upstream = upstreamBranch();
  const expectedUpstream = `origin/${branch}`;
  const args =
    parsed.setUpstream || upstream !== expectedUpstream
      ? ['push', '-u', 'origin', branch]
      : ['push'];

  runPushChecks();
  runOrExit('git', args, { env: { HUSKY: '0' } });
}

main();
