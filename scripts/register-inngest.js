const DEFAULT_BASE_URL = 'https://governada.io';

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL };

  for (const arg of argv) {
    if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
    } else if (!arg.startsWith('--') && !args._baseUrlSet) {
      args.baseUrl = arg;
      args._baseUrlSet = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  delete args._baseUrlSet;
  return args;
}

async function registerInngest(baseUrl) {
  const target = `${baseUrl.replace(/\/$/, '')}/api/inngest`;
  console.log(`Registering Inngest functions via ${target}...`);

  const response = await fetch(target, {
    method: 'PUT',
    signal: AbortSignal.timeout(30000),
  }).catch((error) => {
    throw new Error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  const body = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Inngest registration failed (${response.status}). ${body}`.trim());
  }

  console.log(`Inngest registration succeeded (${response.status}).`);
  if (body.trim()) {
    console.log(body.trim());
  }
}

async function main() {
  const { baseUrl } = parseArgs(process.argv.slice(2));
  await registerInngest(baseUrl);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  registerInngest,
};
