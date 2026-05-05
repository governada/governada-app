#!/usr/bin/env node

import { existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AGENT_TOKEN_KEY = 'OP_AGENT_SERVICE_ACCOUNT_TOKEN';
const DEFAULT_AGENT_VAULT = 'Governada-Agent';
const HUMAN_SSH_HOST = process.env.GOVERNADA_ENV_DOCTOR_SSH_HOST || 'github-governada';

function findRepoRoot(startDir) {
  let current = startDir;

  while (true) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return startDir;
    }

    current = parent;
  }
}

function checkoutKind(repoRoot) {
  try {
    return lstatSync(path.join(repoRoot, '.git')).isDirectory() ? 'shared checkout' : 'worktree';
  } catch {
    return 'unknown';
  }
}

function hasHumanSshLane(repoRoot) {
  if (process.env.GOVERNADA_ENV_DOCTOR_DISABLE_HUMAN_LANE === '1') {
    return false;
  }

  const result = spawnSync('ssh', ['-G', HUMAN_SSH_HOST], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 5000,
  });

  if (result.status !== 0) {
    return false;
  }

  const output = result.stdout.toLowerCase();
  return output.includes(`hostname ${HUMAN_SSH_HOST}`) || output.includes('identityagent ');
}

function activeLaneLine(repoRoot) {
  if (process.env[AGENT_TOKEN_KEY]) {
    const vault = process.env.GOVERNADA_OP_AGENT_VAULT || DEFAULT_AGENT_VAULT;
    return `Active credential lane: agent (${AGENT_TOKEN_KEY}, vault=${vault})`;
  }

  if (hasHumanSshLane(repoRoot)) {
    return 'Active credential lane: human (SSH+1Password Desktop)';
  }

  return 'Active credential lane: NONE';
}

function main() {
  const scriptPath = fileURLToPath(import.meta.url);
  const repoRoot = findRepoRoot(path.dirname(scriptPath));

  console.log(activeLaneLine(repoRoot));
  console.log('Env doctor: Governada local environment bootstrap');
  console.log(`OK: checkout kind: ${checkoutKind(repoRoot)}`);
}

main();
