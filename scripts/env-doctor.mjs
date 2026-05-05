#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const AGENT_TOKEN_KEY = 'OP_AGENT_SERVICE_ACCOUNT_TOKEN';
const DEFAULT_AGENT_VAULT = 'Governada-Agent';
const HUMAN_SSH_HOST = process.env.GOVERNADA_ENV_DOCTOR_SSH_HOST || 'github-governada';
const SSH_CONFIG = process.env.SSH_CONFIG || path.join(os.homedir(), '.ssh', 'config');

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

function stripSshConfigComment(value) {
  let quote = '';

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? '' : char;
      continue;
    }

    if (char === '#' && !quote) {
      return value.slice(0, index).trim();
    }
  }

  return value.trim();
}

function hostBlockMatches(line, host) {
  const [, value = ''] = line.match(/^host\s+(.+)$/iu) || [];
  return stripSshConfigComment(value)
    .split(/\s+/u)
    .some((pattern) => pattern.toLowerCase() === host.toLowerCase());
}

function hasHumanSshLane() {
  if (process.env.GOVERNADA_ENV_DOCTOR_DISABLE_HUMAN_LANE === '1') {
    return false;
  }

  if (!existsSync(SSH_CONFIG)) {
    return false;
  }

  let inMatchingHostBlock = false;
  let hasIdentityConfig = false;

  for (const rawLine of readFileSync(SSH_CONFIG, 'utf8').split(/\r?\n/u)) {
    const line = stripSshConfigComment(rawLine.trim());
    if (!line) {
      continue;
    }

    if (/^host\s+/iu.test(line)) {
      if (inMatchingHostBlock && (hasIdentityConfig || process.env.SSH_AUTH_SOCK)) {
        return true;
      }
      inMatchingHostBlock = hostBlockMatches(line, HUMAN_SSH_HOST);
      hasIdentityConfig = false;
      continue;
    }

    if (inMatchingHostBlock && /^(identityagent|identityfile)\s+/iu.test(line)) {
      const [, value = ''] = line.match(/^\S+\s+(.+)$/u) || [];
      if (value.trim() && value.trim().toLowerCase() !== 'none') {
        hasIdentityConfig = true;
      }
    }
  }

  return inMatchingHostBlock && (hasIdentityConfig || Boolean(process.env.SSH_AUTH_SOCK));
}

function activeLaneLine(repoRoot) {
  if (process.env[AGENT_TOKEN_KEY]) {
    const vault = process.env.GOVERNADA_OP_AGENT_VAULT || DEFAULT_AGENT_VAULT;
    return `Active credential lane: agent (${AGENT_TOKEN_KEY}, vault=${vault})`;
  }

  if (hasHumanSshLane()) {
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
