const DEFAULT_TIMEOUT_MS = 90000;
const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_PATH = '/api/health';

function parseArgs(argv) {
  const args = {
    target: '',
    path: DEFAULT_PATH,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    intervalMs: DEFAULT_INTERVAL_MS,
  };

  for (const arg of argv) {
    if (arg.startsWith('--path=')) {
      args.path = arg.slice('--path='.length);
    } else if (arg.startsWith('--timeout=')) {
      args.timeoutMs = Number.parseInt(arg.slice('--timeout='.length), 10);
    } else if (arg.startsWith('--interval=')) {
      args.intervalMs = Number.parseInt(arg.slice('--interval='.length), 10);
    } else if (!arg.startsWith('--') && !args.target) {
      args.target = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.target) {
    throw new Error(
      'Usage: npm run preview:ready -- <url> [--path=/api/health] [--timeout=90000] [--interval=2000]',
    );
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${args.timeoutMs}`);
  }

  if (!Number.isFinite(args.intervalMs) || args.intervalMs <= 0) {
    throw new Error(`Invalid interval: ${args.intervalMs}`);
  }

  return args;
}

function normalizeTarget(target, healthPath) {
  const url = target.includes('://') ? new URL(target) : new URL(`http://${target}`);
  if (url.pathname === '/' || url.pathname === '') {
    url.pathname = healthPath.startsWith('/') ? healthPath : `/${healthPath}`;
  }
  return url.toString();
}

async function pollUntilReady({ target, path, timeoutMs, intervalMs }) {
  const readyUrl = normalizeTarget(target, path);
  const startedAt = Date.now();
  let attempt = 0;
  let lastStatus = 'no response';
  let lastError = '';

  console.log(`Waiting for preview readiness: ${readyUrl}`);
  console.log(`Timeout: ${timeoutMs}ms, interval: ${intervalMs}ms`);

  while (Date.now() - startedAt < timeoutMs) {
    attempt += 1;
    try {
      const response = await fetch(readyUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(Math.min(intervalMs, 10000)),
      });

      lastStatus = `${response.status} ${response.statusText || ''}`.trim();
      if (response.ok) {
        const elapsedMs = Date.now() - startedAt;
        console.log(`Ready after ${attempt} attempt(s) in ${elapsedMs}ms: ${lastStatus}`);
        return true;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      lastStatus = lastError || 'request failed';
    }

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= timeoutMs) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const elapsedMs = Date.now() - startedAt;
  throw new Error(
    `Timed out after ${elapsedMs}ms waiting for ${readyUrl}. Last status: ${lastStatus}${lastError ? ` (${lastError})` : ''}`,
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await pollUntilReady(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  normalizeTarget,
  pollUntilReady,
};
