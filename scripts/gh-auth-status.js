const { runGh } = require('./lib/runtime');
const { redactSensitiveText } = require('./lib/gh-auth');

function writeFailure(result) {
  const detail = redactSensitiveText(result.stderr || result.stdout || '').trim();
  if (detail) {
    process.stderr.write(`${detail}\n`);
  }
}

function main() {
  const user = runGh(['api', 'user', '--jq', '.login']);
  if (user.status !== 0) {
    console.error('GitHub API auth: FAILED');
    writeFailure(user);
    process.exit(user.status);
  }

  const login = user.stdout.trim();
  console.log('GitHub API auth: OK');
  if (login) {
    console.log(`Active GitHub user: ${login}`);
  }

  if (process.env.GH_TOKEN_OP_REF || process.env.GITHUB_TOKEN_OP_REF) {
    console.log('GitHub token source: 1Password reference');
  }

  const repo = process.env.GH_REPO || 'governada/app';
  const repoCheck = runGh(['api', `repos/${repo}`, '--jq', '.full_name']);
  if (repoCheck.status !== 0) {
    console.error(`Repo access: FAILED (${repo})`);
    writeFailure(repoCheck);
    process.exit(repoCheck.status);
  }

  console.log(`Repo context: ${repo}`);
  console.log(`Repo access: OK (${repoCheck.stdout.trim() || repo})`);
}

main();
