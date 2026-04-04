const { loadLocalEnv } = require('./lib/runtime');

loadLocalEnv();

const type = (process.argv[2] || 'all').toLowerCase();

const heartbeatMap = {
  proposals: 'HEARTBEAT_URL_PROPOSALS',
  batch: 'HEARTBEAT_URL_BATCH',
  daily: 'HEARTBEAT_URL_DAILY',
  deploy: 'HEARTBEAT_URL_DEPLOY',
};

async function pingHeartbeat(name) {
  const url = process.env[heartbeatMap[name]];

  if (!url) {
    console.log(`  SKIP: ${name.toUpperCase()} (no URL configured)`);
    return;
  }

  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (response && (response.status === 200 || response.status === 204)) {
    console.log(`  OK: ${name.toUpperCase()} heartbeat pinged`);
  } else {
    console.log(
      `  WARN: ${name.toUpperCase()} heartbeat failed (HTTP ${response ? response.status : '000'})`,
    );
  }
}

async function main() {
  console.log('Pinging heartbeats...');

  if (type === 'all') {
    for (const name of Object.keys(heartbeatMap)) {
      await pingHeartbeat(name);
    }
    return;
  }

  if (!(type in heartbeatMap)) {
    console.log(`Unknown type: ${type}`);
    console.log('Usage: node scripts/uptime-check.js [proposals|batch|daily|deploy|all]');
    process.exit(1);
  }

  await pingHeartbeat(type);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
