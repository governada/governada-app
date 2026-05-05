#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const result = spawnSync(process.execPath, [path.join(scriptDir, 'gh-auth-status.js')], {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.status === 0) {
  process.exit(0);
}

console.error('');
console.error('Auth repair hint: this repo uses two lanes.');
console.error('  - git push/pull: SSH + 1Password Desktop (probed by SSH lines above)');
console.error(
  '  - GitHub API: GH_TOKEN_OP_REF resolved via bin/gh.sh using the agent service account',
);
console.error(
  '1. If SSH probe failed: open 1Password Developer -> SSH agent. Run: ssh -T git@github-governada',
);
console.error(
  '2. If API probe failed: confirm the agent runtime service-account token is available.',
);
console.error(
  '   - Check /Users/tim/dev/agent-runtime/env/governada-agent.env has OP_AGENT_SERVICE_ACCOUNT_TOKEN.',
);
console.error('   - Run: npm run op:agent-doctor.');
console.error(
  '   - Check .env.local.refs has GH_TOKEN_OP_REF=op://Governada-Agent/governada-app-agent/credential.',
);
console.error(
  '   - If 401/403 from gh API: PAT scope is wrong. See [[decisions/lean-agent-harness#addendum-3]].',
);
console.error('No GitHub token, Keychain cache, LaunchAgent, or broker repair is attempted.');
console.error('No automated rotation is performed - token rotation is a Tim manual action.');

process.exit(result.status ?? 1);
