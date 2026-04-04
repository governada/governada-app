const DEFAULT_BASE_URL = 'https://governada.io';
const DEFAULT_TIMEOUT_MS = 10000;

const HELP = `
Usage:
  npm run health:ready
  npm run health:status
  npm run health:reconciliation
  node scripts/health-check.js --path /api/health [--select status] [--sync-type reconciliation]

Options:
  --path <route>        Route to fetch from the target base URL.
  --base-url <url>      Override the base URL. Defaults to https://governada.io.
  --select <field>      Dot-path field to print from the JSON response.
  --sync-type <type>    From /api/health, print the matching sync entry.
  --timeout <ms>        Request timeout in milliseconds.
  --compact             Print compact JSON.
`;

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP.trim());
    process.exit(0);
  }

  const parsed = {
    path: '',
    baseUrl: DEFAULT_BASE_URL,
    select: '',
    syncType: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    compact: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--path' && argv[index + 1]) {
      parsed.path = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--path=')) {
      parsed.path = value.slice('--path='.length);
      continue;
    }

    if (value === '--base-url' && argv[index + 1]) {
      parsed.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--base-url=')) {
      parsed.baseUrl = value.slice('--base-url='.length);
      continue;
    }

    if (value === '--select' && argv[index + 1]) {
      parsed.select = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--select=')) {
      parsed.select = value.slice('--select='.length);
      continue;
    }

    if (value === '--sync-type' && argv[index + 1]) {
      parsed.syncType = argv[index + 1];
      index += 1;
      continue;
    }

    if (value.startsWith('--sync-type=')) {
      parsed.syncType = value.slice('--sync-type='.length);
      continue;
    }

    if (value === '--timeout' && argv[index + 1]) {
      parsed.timeoutMs = Number.parseInt(argv[index + 1], 10);
      index += 1;
      continue;
    }

    if (value.startsWith('--timeout=')) {
      parsed.timeoutMs = Number.parseInt(value.slice('--timeout='.length), 10);
      continue;
    }

    if (value === '--compact') {
      parsed.compact = true;
      continue;
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  if (!parsed.path) {
    throw new Error('--path is required.');
  }

  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs <= 0) {
    throw new Error(`Invalid timeout: ${parsed.timeoutMs}`);
  }

  return parsed;
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

function pickField(value, select) {
  return select.split('.').reduce((current, key) => {
    if (current === null || current === undefined) {
      return undefined;
    }
    return current[key];
  }, value);
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Request failed (${response.status}): ${body}`);
    }

    return body ? JSON.parse(body) : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  let args;

  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('');
    console.error(HELP.trim());
    process.exit(1);
  }

  const url = `${normalizeBaseUrl(args.baseUrl)}${args.path}`;
  const payload = await fetchJson(url, args.timeoutMs);

  let output = payload;
  if (args.syncType) {
    if (!Array.isArray(payload?.syncs)) {
      throw new Error('Response does not contain a syncs array.');
    }

    output = payload.syncs.find((entry) => entry?.type === args.syncType) ?? null;
  }

  if (args.select) {
    output = pickField(output, args.select);
  }

  if (typeof output === 'string') {
    process.stdout.write(`${output}\n`);
    return;
  }

  const serialized = args.compact ? JSON.stringify(output) : JSON.stringify(output, null, 2);
  process.stdout.write(`${serialized}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
