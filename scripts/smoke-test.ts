import { pathToFileURL } from 'node:url';
import { runSmokeChecks, type VerificationProfile } from './lib/deployVerification';

function parseArgValue(args: string[], flag: string): string | null {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : null;
}

export function parseSmokeTestArgs(args: string[]) {
  const quiet = args.includes('--quiet');
  const baseUrl =
    parseArgValue(args, '--base-url') ||
    args.find((arg) => !arg.startsWith('--')) ||
    process.env.SMOKE_TEST_URL ||
    'https://governada.io';
  const expectedSha = parseArgValue(args, '--expected-sha') || process.env.EXPECTED_RELEASE_SHA;
  const profile =
    (parseArgValue(args, '--profile') as VerificationProfile | null) ||
    ((process.env.DEPLOY_VERIFY_PROFILE as VerificationProfile | undefined) ?? 'production');

  if (profile !== 'production' && profile !== 'preview') {
    throw new Error(`Unsupported smoke-test profile: ${profile}`);
  }

  return { baseUrl, expectedSha, profile, quiet };
}

export async function main(rawArgs = process.argv.slice(2)) {
  const { baseUrl, expectedSha, profile, quiet } = parseSmokeTestArgs(rawArgs);

  console.log(`\nSmoke testing: ${baseUrl} [${profile}]${quiet ? ' (quiet mode)' : ''}\n`);

  const { failed, results } = await runSmokeChecks({
    baseUrl,
    expectedSha,
    profile,
    quiet,
  });

  console.log(`\n${results.length - failed}/${results.length} checks passed.\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
