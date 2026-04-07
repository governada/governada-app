import { fetchWithTimeout, loadLocalEnv } from './lib/runtime.mjs';

loadLocalEnv(import.meta.url, ['HEARTBEAT_URL_*']);

const type = process.argv[2] ?? 'all';
const knownTypes = [
  'proposals',
  'batch',
  'daily',
  'deploy',
  'scoring',
  'alignment',
  'freshness_guard',
  'epoch_summary',
];

async function pingHeartbeat(name) {
  const envKey = `HEARTBEAT_URL_${name}`;
  const url = process.env[envKey];

  if (!url) {
    console.log(`  SKIP: ${name} (no URL configured)`);
    return;
  }

  try {
    const response = await fetchWithTimeout(url, {}, 5000);
    if (response.status === 200 || response.status === 204) {
      console.log(`  OK: ${name} heartbeat pinged`);
    } else {
      console.log(`  WARN: ${name} heartbeat failed (HTTP ${response.status})`);
    }
  } catch {
    console.log(`  WARN: ${name} heartbeat failed (HTTP 000)`);
  }
}

console.log('Pinging heartbeats...');

if (type === 'all') {
  for (const heartbeatType of knownTypes) {
    await pingHeartbeat(heartbeatType.toUpperCase());
  }
  process.exit(0);
}

if (!knownTypes.includes(type)) {
  console.log(`Unknown type: ${type}`);
  console.log(
    'Usage: uptime-check.mjs [proposals|batch|daily|deploy|scoring|alignment|freshness_guard|epoch_summary|all]',
  );
  process.exit(1);
}

await pingHeartbeat(type.toUpperCase());
