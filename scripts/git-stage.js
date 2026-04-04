const { runCommand } = require('./lib/runtime');

const HELP = `
Usage:
  npm run git:stage -- --all
  npm run git:stage -- <path> [more paths...]

Stages files using a stable repo wrapper so Windows Codex agents can avoid raw \`git add\`.
`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP.trim());
    process.exit(0);
  }

  if (argv.length === 0 || argv.includes('--all')) {
    return ['add', '-A'];
  }

  return ['add', ...argv];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
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
