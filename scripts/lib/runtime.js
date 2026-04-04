const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { getContext } = require('../set-gh-context.js');

const repoRoot = path.resolve(__dirname, '..', '..');

function loadLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const parsed = parseEnvFile(fs.readFileSync(envPath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }

  return true;
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

function runCommand(command, args, options = {}) {
  const env = {
    ...process.env,
    ...(options.env || {}),
  };
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    env,
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function runGh(args) {
  return runCommand('gh', args, { env: getContext() });
}

function runGhJson(args) {
  const result = runGh(args);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || 'gh command failed. Check `gh auth status` and repo access.');
  }

  return JSON.parse(result.stdout);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  loadLocalEnv,
  repoRoot,
  runCommand,
  runGh,
  runGhJson,
  sleep,
};
