const { registerInngest } = require('./register-inngest.js');
const { runCommand, sleep } = require('./lib/runtime');

const DEFAULT_BASE_URL = 'https://governada.io';
const DEFAULT_DELAY_SECONDS = 180;

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    delaySeconds: DEFAULT_DELAY_SECONDS,
    registerInngest: false,
  };

  for (const arg of argv) {
    if (arg === '--register-inngest') {
      args.registerInngest = true;
    } else if (arg.startsWith('--delay=')) {
      args.delaySeconds = Number.parseInt(arg.slice('--delay='.length), 10);
    } else if (arg.startsWith('--base-url=')) {
      args.baseUrl = arg.slice('--base-url='.length);
    } else if (!arg.startsWith('--') && args.baseUrl === DEFAULT_BASE_URL) {
      args.baseUrl = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.delaySeconds) || args.delaySeconds < 0) {
    throw new Error(`Invalid delay: ${args.delaySeconds}`);
  }

  return args;
}

function runOrThrow(command, args, options = {}) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    const detail = `${result.stdout || ''}${result.stderr || ''}`.trim();
    throw new Error(detail || `${command} ${args.join(' ')} failed`);
  }
}

async function verifyDeployment({ baseUrl, delaySeconds, registerInngest: shouldRegisterInngest }) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  if (delaySeconds > 0) {
    console.log(`Waiting ${delaySeconds}s for deployment to settle...`);
    await sleep(delaySeconds * 1000);
  }

  console.log('Running smoke test...');
  runOrThrow('npm', ['run', 'smoke-test', '--', normalizedBaseUrl, '--quiet']);

  console.log('Pinging deploy heartbeat...');
  runOrThrow('npm', ['run', 'uptime-check', '--', 'deploy']);

  if (shouldRegisterInngest) {
    await registerInngest(normalizedBaseUrl);
  }

  console.log('Deployment verification complete.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await verifyDeployment(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  verifyDeployment,
};
