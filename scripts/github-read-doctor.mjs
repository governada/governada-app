import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { redactSensitiveText } from './lib/github-app-auth.mjs';

const DEFAULT_AGENT_RUNTIME_BIN = '/Users/tim/dev/agent-runtime/bin/agent-runtime';
const LEGACY_SCRIPT = fileURLToPath(new URL('./github-read-doctor-app.mjs', import.meta.url));

function usage() {
  return `Usage:
  npm run github:read-doctor
  npm run github:read-doctor -- --legacy

Default mode routes github.read through the stable agent-runtime host.
--legacy runs the pre-Slice-5a app-local doctor as an explicit compatibility fallback.`;
}

function parseArgs(argv) {
  const parsed = {
    help: false,
    legacy: false,
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--legacy' || arg === '--compatibility-fallback') {
      parsed.legacy = true;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }

  return parsed;
}

function runNodeScript(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: path.dirname(scriptPath),
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writeOutput(result) {
  if (result.error) {
    process.stderr.write(redactSensitiveText(`${result.error.message || String(result.error)}\n`));
  }
  if (result.stdout) {
    process.stdout.write(redactSensitiveText(result.stdout));
  }
  if (result.stderr) {
    process.stderr.write(redactSensitiveText(result.stderr));
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return 0;
  }

  if (parsed.legacy) {
    console.log('GitHub read doctor route: app-local compatibility fallback');
    console.log('Compatibility note: stable-host routing is the default Slice 5a path.');
    const result = runNodeScript(LEGACY_SCRIPT);
    writeOutput(result);
    return result.status ?? 1;
  }

  const agentRuntimeBin = DEFAULT_AGENT_RUNTIME_BIN;
  if (!existsSync(agentRuntimeBin)) {
    console.error(`BLOCKED: stable agent-runtime command is missing: ${agentRuntimeBin}`);
    console.error('Compatibility fallback: npm run github:read-doctor -- --legacy');
    return 1;
  }

  console.log('GitHub read doctor route: stable agent-runtime host');
  console.log(`Stable host command: ${agentRuntimeBin}`);
  console.log('Operation class: github.read');
  console.log('Compatibility fallback: npm run github:read-doctor -- --legacy');

  const result = runNodeScript(agentRuntimeBin, [
    'github',
    'doctor',
    '--domain',
    'governada',
    '--operation',
    'github.read',
  ]);
  writeOutput(result);
  return result.status ?? 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(redactSensitiveText(error?.message || String(error)));
  process.exitCode = 1;
}
