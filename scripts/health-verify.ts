import { pathToFileURL } from 'node:url';
import {
  runSmokeChecks,
  waitForReleaseReady,
  type VerificationProfile,
} from './lib/deployVerification';

function parseArgValue(args: string[], flag: string): string | null {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : null;
}

function parseNumberArg(args: string[], flag: string, fallback: number): number {
  const value = parseArgValue(args, flag);
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${flag} value: ${value}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run health:verify -- [base-url] [options]

Options:
  --base-url=<url>       Health target, defaults to https://governada.io
  --expected-sha=<sha>   Wait for this release SHA before checks
  --profile=<name>      production or preview
  --timeout-ms=<ms>     Readiness wait timeout
  --interval-ms=<ms>    Readiness poll interval
  --quiet               Reduce per-check output
  --help                Show this help
`);
}

export function parseDeployVerifyArgs(args: string[]) {
  const quiet = args.includes('--quiet');
  const baseUrl =
    parseArgValue(args, '--base-url') ||
    args.find((arg) => !arg.startsWith('--')) ||
    process.env.DEPLOY_VERIFY_URL ||
    process.env.SMOKE_TEST_URL ||
    'https://governada.io';
  const expectedSha = parseArgValue(args, '--expected-sha') || process.env.EXPECTED_RELEASE_SHA;
  const profile =
    (parseArgValue(args, '--profile') as VerificationProfile | null) ||
    ((process.env.DEPLOY_VERIFY_PROFILE as VerificationProfile | undefined) ?? 'production');
  const timeoutMs = parseNumberArg(args, '--timeout-ms', 10 * 60 * 1000);
  const intervalMs = parseNumberArg(args, '--interval-ms', 10_000);

  if (profile !== 'production' && profile !== 'preview') {
    throw new Error(`Unsupported health-verify profile: ${profile}`);
  }

  return { baseUrl, expectedSha, intervalMs, profile, quiet, timeoutMs };
}

export async function main(rawArgs = process.argv.slice(2)) {
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printHelp();
    return;
  }

  const { baseUrl, expectedSha, intervalMs, profile, quiet, timeoutMs } =
    parseDeployVerifyArgs(rawArgs);

  console.log(`\nHealth verification: ${baseUrl} [${profile}]`);
  if (expectedSha) {
    console.log(`Expected release: ${expectedSha.slice(0, 12)}`);
  }
  console.log('');

  const ready = await waitForReleaseReady({
    baseUrl,
    expectedSha,
    intervalMs,
    timeoutMs,
  });

  console.log(
    `Ready after ${ready.attempts} attempt(s)${ready.releaseCommitSha ? ` with release ${ready.releaseCommitSha.slice(0, 12)}` : ''}.\n`,
  );

  const { failed, results } = await runSmokeChecks({
    baseUrl,
    expectedSha,
    profile,
    quiet,
  });

  console.log(`\n${results.length - failed}/${results.length} verification checks passed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
