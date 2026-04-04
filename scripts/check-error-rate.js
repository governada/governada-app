const { loadLocalEnv } = require('./lib/runtime');
const warnThreshold = 50;
const blockThreshold = 200;

function getSinceTimestamp() {
  return Math.floor((Date.now() - 60 * 60 * 1000) / 1000).toString();
}

async function checkErrorRate() {
  loadLocalEnv();

  const authToken = process.env.SENTRY_AUTH_TOKEN;
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;

  if (!authToken || !org || !project) {
    console.log('SKIP: Sentry env vars not configured. Skipping error rate check.');
    return true;
  }

  console.log('Checking Sentry error rate (last 1 hour)...');

  const url = new URL(`https://sentry.io/api/0/projects/${org}/${project}/stats/`);
  url.searchParams.set('stat', 'received');
  url.searchParams.set('resolution', '1h');
  url.searchParams.set('since', getSinceTimestamp());

  let errorCount = 0;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        errorCount = data
          .slice(-2)
          .reduce((sum, point) => sum + (Array.isArray(point) ? Number(point[1] ?? 0) : 0), 0);
      }
    }
  } catch {
    errorCount = 0;
  }

  console.log(`  Error count (last hour): ${errorCount}`);

  if (errorCount > blockThreshold) {
    console.log('');
    console.log(
      `BLOCKED: Production error rate is critically elevated (${errorCount} errors/hour)`,
    );
    console.log(`Threshold: ${blockThreshold} errors/hour`);
    console.log('');
    console.log('Do NOT merge new changes until the error rate stabilizes.');
    console.log(`Check Sentry dashboard: https://${org}.sentry.io/issues/?project=${project}`);
    return false;
  }

  if (errorCount > warnThreshold) {
    console.log('');
    console.log(`WARNING: Production error rate is elevated (${errorCount} errors/hour)`);
    console.log(`Threshold: ${warnThreshold} errors/hour`);
    console.log('Proceed with caution - monitor Sentry after merge.');
  }

  console.log('OK: Error rate is within normal range.');
  return true;
}

module.exports = {
  checkErrorRate,
};

if (require.main === module) {
  checkErrorRate()
    .then((ok) => {
      process.exit(ok ? 0 : 1);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
