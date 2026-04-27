const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scriptPath = path.join(__dirname, 'rollback.mjs');
const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(2)], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
