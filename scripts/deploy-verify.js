const { spawnSync } = require('node:child_process');

if (process.argv.includes('--register-inngest')) {
  console.error('scripts/deploy-verify.js no longer supports --register-inngest.');
  console.error('Use npm run inngest:register -- <base-url> only after explicit approval.');
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'deploy:verify', '--', ...process.argv.slice(2)], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
