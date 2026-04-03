const { runGh } = require('./lib/runtime');

function main() {
  const status = runGh(['auth', 'status', '--hostname', 'github.com']);
  process.stdout.write(status.stdout);
  process.stderr.write(status.stderr);

  if (status.status !== 0) {
    process.exit(status.status);
  }

  const user = runGh(['api', 'user', '--jq', '.login']);
  if (user.status === 0) {
    const login = user.stdout.trim();
    if (login) {
      console.log(`Active GitHub user: ${login}`);
    }
  }

  const repo = process.env.GH_REPO || 'governada/governada-app';
  console.log(`Repo context: ${repo}`);
}

main();
