#!/usr/bin/env node

const DEFAULT_PREVIEW_TEMPLATE = 'https://pr-{pr}-governada-app.up.railway.app';

function parseArgValue(args, flag) {
  const match = args.find((arg) => arg.startsWith(`${flag}=`));
  return match ? match.slice(flag.length + 1) : null;
}

function parseArgs(args) {
  const url = parseArgValue(args, '--url');
  const pr = parseArgValue(args, '--pr');
  const expectedSha =
    parseArgValue(args, '--expected-sha') ?? process.env.EXPECTED_RELEASE_SHA ?? null;
  const template =
    parseArgValue(args, '--template') ??
    process.env.RAILWAY_PREVIEW_URL_TEMPLATE ??
    process.env.PREVIEW_URL_TEMPLATE ??
    DEFAULT_PREVIEW_TEMPLATE;

  if (args.includes('--help') || args.includes('-h')) {
    return { help: true };
  }

  if (!url && !pr) {
    throw new Error('Provide --url=<preview-url> or --pr=<number>');
  }

  if (url && pr) {
    throw new Error('Use only one of --url or --pr');
  }

  return { expectedSha, pr, template, url };
}

function normalizeBaseUrl(rawUrl) {
  const url = rawUrl.includes('://') ? new URL(rawUrl) : new URL(`https://${rawUrl}`);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/+$/, '');
}

function resolvePreviewUrl({ pr, template, url }) {
  if (url) return normalizeBaseUrl(url);
  if (!/^\d+$/.test(pr)) {
    throw new Error(`Invalid PR number: ${pr}`);
  }
  return normalizeBaseUrl(template.replaceAll('{pr}', pr));
}

function releaseMatchesExpected(actualCommitSha, expectedCommitSha) {
  const actual = actualCommitSha?.trim().toLowerCase();
  const expected = expectedCommitSha?.trim().toLowerCase();
  if (!expected) return true;
  if (!actual) return false;
  return actual === expected || actual.startsWith(expected) || expected.startsWith(actual);
}

async function fetchWithTimeout(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Governada-PreviewVerify/1.0',
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
  });
  return response;
}

async function checkReady(baseUrl, expectedSha) {
  const response = await fetchWithTimeout(`${baseUrl}/api/health/ready`, {
    headers: { Accept: 'application/json' },
  });
  if (response.status !== 200) {
    return `ready endpoint returned ${response.status}`;
  }

  const body = await response.json();
  if (body?.status !== 'ok') {
    return `ready endpoint status was ${body?.status ?? 'missing'}`;
  }

  if (expectedSha && !releaseMatchesExpected(body?.release?.commit_sha, expectedSha)) {
    return `ready endpoint release ${body?.release?.commit_sha ?? 'missing'} does not match ${expectedSha}`;
  }

  return null;
}

async function checkHomepage(baseUrl) {
  const response = await fetchWithTimeout(`${baseUrl}/`, {
    headers: { Accept: 'text/html' },
  });
  if (response.status !== 200) {
    return `homepage returned ${response.status}`;
  }

  const html = await response.text();
  if (
    !html.includes('type="application/ld+json"') &&
    !html.includes("type='application/ld+json'")
  ) {
    return 'homepage is missing application/ld+json structured data';
  }
  if (!html.includes('https://schema.org')) {
    return 'homepage structured data is missing schema.org context';
  }

  return null;
}

async function runPreviewVerify({
  expectedSha = null,
  pr = null,
  template = DEFAULT_PREVIEW_TEMPLATE,
  url,
}) {
  const baseUrl = resolvePreviewUrl({ pr, template, url });
  const checks = [
    ['Health readiness', () => checkReady(baseUrl, expectedSha)],
    ['Homepage JSON-LD', () => checkHomepage(baseUrl)],
  ];

  console.log(`Preview verification: ${baseUrl}`);
  if (expectedSha) {
    console.log(`Expected release: ${expectedSha.slice(0, 12)}`);
  }
  console.log('');

  let failed = 0;
  for (const [name, check] of checks) {
    const error = await check();
    if (error) {
      failed += 1;
      console.log(`[FAIL] ${name} - ${error}`);
    } else {
      console.log(`[PASS] ${name}`);
    }
  }

  console.log(`\n${checks.length - failed}/${checks.length} preview checks passed.\n`);
  return { baseUrl, failed };
}

function printHelp() {
  console.log(`Usage: npm run preview:verify -- --url=<url>
       npm run preview:verify -- --pr=<number> [--template=https://...{pr}...]

Options:
  --url=<url>            Preview URL to verify
  --pr=<number>          Resolve URL from RAILWAY_PREVIEW_URL_TEMPLATE or --template
  --template=<template>  URL template containing {pr}
  --expected-sha=<sha>   Assert /api/health/ready serves the expected release
  --help                Show this help
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const result = await runPreviewVerify(args);
  if (result.failed > 0) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export {
  checkHomepage,
  checkReady,
  normalizeBaseUrl,
  parseArgs,
  releaseMatchesExpected,
  resolvePreviewUrl,
  runPreviewVerify,
};
