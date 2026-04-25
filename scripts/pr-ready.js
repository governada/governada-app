const { runGh } = require('./lib/runtime');

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npm run pr:ready -- [PR#|url|branch] [--undo]');
    process.exit(0);
  }

  const repo = process.env.GH_REPO || 'governada/app';
  const result = runGh(['pr', 'ready', ...args, '--repo', repo]);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status);
}

main();
