import { fetchWithTimeout, loadLocalEnv } from './lib/runtime.mjs';

loadLocalEnv(import.meta.url, ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT']);

const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;

if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) {
  console.log('SKIP: Sentry env vars not configured. Skipping error rate check.');
  process.exit(0);
}

const since = Math.floor(Date.now() / 1000) - 3600;
const url = new URL(`https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/`);
url.searchParams.set('stat', 'received');
url.searchParams.set('resolution', '1h');
url.searchParams.set('since', `${since}`);

console.log('Checking Sentry error rate (last 1 hour)...');

let errorCount = 0;

try {
  const response = await fetchWithTimeout(
    url,
    {
      headers: {
        Authorization: `Bearer ${SENTRY_AUTH_TOKEN}`,
      },
    },
    10000,
  );

  if (response.ok) {
    const data = await response.json();
    if (Array.isArray(data)) {
      errorCount = data.slice(-2).reduce((sum, point) => sum + Number(point?.[1] ?? 0), 0);
    }
  }
} catch {
  errorCount = 0;
}

const warnThreshold = 50;
const blockThreshold = 200;

console.log(`  Error count (last hour): ${errorCount}`);

if (errorCount > blockThreshold) {
  console.log('');
  console.log(`BLOCKED: Production error rate is critically elevated (${errorCount} errors/hour)`);
  console.log(`Threshold: ${blockThreshold} errors/hour`);
  console.log('');
  console.log('Do NOT merge new changes until the error rate stabilizes.');
  console.log(
    `Check Sentry dashboard: https://${SENTRY_ORG}.sentry.io/issues/?project=${SENTRY_PROJECT}`,
  );
  process.exit(1);
}

if (errorCount > warnThreshold) {
  console.log('');
  console.log(`WARNING: Production error rate is elevated (${errorCount} errors/hour)`);
  console.log(`Threshold: ${warnThreshold} errors/hour`);
  console.log('Proceed with caution - monitor Sentry after merge.');
}

console.log('OK: Error rate is within normal range.');
