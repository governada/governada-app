#!/usr/bin/env node

import { commandOutput, getScriptContext } from './lib/runtime.mjs';

const EXPECTED_USER = 'governada';
const CANONICAL_REMOTE = 'git@github-governada:governada/governada-app.git';
const { repoRoot } = getScriptContext(import.meta.url);

function log(message) {
  console.log(message);
}

function tryCommand(command, args) {
  try {
    return commandOutput(command, args, { cwd: repoRoot });
  } catch {
    return '';
  }
}

function embeddedCredentialRemote(remoteUrl) {
  return /^https:\/\/[^/@]+:[^@]+@github\.com\//u.test(remoteUrl);
}

log('Repairing GitHub auth for this repo...');

const currentUser = tryCommand('gh', ['api', 'user', '--jq', '.login']);

if (!currentUser) {
  console.error("GitHub auth is not ready. Run 'gh auth login' first, then re-run this script.");
  process.exit(1);
}

if (currentUser !== EXPECTED_USER) {
  log(`Switching gh account from ${currentUser} to ${EXPECTED_USER}...`);
  try {
    commandOutput('gh', ['auth', 'switch', '--user', EXPECTED_USER], { cwd: repoRoot });
  } catch {
    console.error(
      `Could not switch to ${EXPECTED_USER}. Run 'gh auth login' or 'gh auth switch --user ${EXPECTED_USER}' manually.`,
    );
    process.exit(1);
  }
}

const repairedUser = tryCommand('gh', ['api', 'user', '--jq', '.login']);
if (repairedUser !== EXPECTED_USER) {
  console.error(
    `GitHub auth is still using '${repairedUser || 'unknown'}' instead of '${EXPECTED_USER}'.`,
  );
  process.exit(1);
}

commandOutput('gh', ['auth', 'setup-git', '--hostname', 'github.com'], { cwd: repoRoot });
log(`GitHub auth: ready as ${EXPECTED_USER}.`);

const currentRemote = tryCommand('git', ['remote', 'get-url', 'origin']);
if (
  currentRemote &&
  (currentRemote !== CANONICAL_REMOTE || embeddedCredentialRemote(currentRemote))
) {
  commandOutput('git', ['remote', 'set-url', 'origin', CANONICAL_REMOTE], { cwd: repoRoot });
  log(`GitHub remote: set origin to ${CANONICAL_REMOTE}.`);
}
