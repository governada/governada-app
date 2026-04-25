import { pathToFileURL } from 'node:url';

import { formatInngestDoctorReport, runInngestDoctor } from './lib/inngestDoctor';

function parseArgValue(args: string[], flag: string): string | null {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : null;
}

export function parseInngestDoctorArgs(args: string[]) {
  const baseUrl =
    parseArgValue(args, '--base-url') ||
    args.find((arg) => !arg.startsWith('--')) ||
    process.env.INNGEST_DOCTOR_URL ||
    process.env.DEPLOY_VERIFY_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'https://governada.io';
  const requireLiveFunctionCountMatch = args.includes('--require-live-match');

  const unknown = args.find((arg) => {
    if (!arg.startsWith('--')) return false;
    return arg !== '--require-live-match' && !arg.startsWith('--base-url=');
  });
  if (unknown) {
    throw new Error(`Unknown argument: ${unknown}`);
  }

  return { baseUrl, requireLiveFunctionCountMatch };
}

export async function main(rawArgs = process.argv.slice(2)) {
  const options = parseInngestDoctorArgs(rawArgs);
  const report = await runInngestDoctor(options);

  console.log(formatInngestDoctorReport(report));

  if (report.status === 'BLOCKED') {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
