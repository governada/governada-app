import { spawnSync } from 'node:child_process';

import { buildGithubMergeApprovalPrompt } from './lib/github-merge-approval.mjs';

function printUsage() {
  console.log(`Usage:
  npm run github:merge-ready -- --pr <number>
  npm run github:merge-ready:legacy -- --pr <number>

Runs the required pre-merge check and merge doctor before printing the exact approval prompt.`);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    return { help: true };
  }

  const args = {
    legacy: false,
    prNumber: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--legacy') {
      args.legacy = true;
    } else if (value === '--pr') {
      args.prNumber = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--pr=')) {
      args.prNumber = value.slice('--pr='.length);
    } else if (!value.startsWith('--') && !args.prNumber) {
      args.prNumber = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  if (!/^[1-9]\d*$/u.test(args.prNumber || '')) {
    throw new Error('--pr must be a positive pull request number.');
  }

  return args;
}

function requireNextValue(argv, index, flag) {
  const nextValue = argv[index + 1];
  if (!nextValue || nextValue.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return nextValue;
}

function writeOutput(stdout, stderr) {
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }
}

function runNodeScript(scriptPath, args, options = {}) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    writeOutput(stdout, stderr);
    process.exit(result.status ?? 1);
  }

  if (options.filterOutput) {
    const filtered = options.filterOutput(`${stdout}${stderr}`);
    if (filtered) {
      process.stdout.write(filtered);
    }
  } else {
    writeOutput(stdout, stderr);
  }

  return `${stdout}${stderr}`;
}

function extractPreMergeApproval(output) {
  const promptPattern =
    /\n?Exact merge approval prompt:\n(?<prompt>I approve github\.merge for governada\/app PR #(?<prNumber>[1-9]\d*) if CI checks are green and the head SHA remains unchanged at (?<expectedHead>[a-f0-9]{40})\.)\n?/iu;
  const match = output.match(promptPattern);

  if (!match?.groups?.prompt || !match.groups.expectedHead) {
    throw new Error('pre-merge check did not report an exact merge approval prompt.');
  }

  return {
    expectedHead: match.groups.expectedHead,
    sanitizedOutput: output
      .replace(/\n?OK: Safe to merge PR #[1-9]\d+\.\n?/giu, '\nOK: Pre-merge checks passed.\n')
      .replace(promptPattern, '\nApproval prompt withheld until merge doctor passes.\n'),
  };
}

function printApproval({ expectedHead, legacy, prNumber }) {
  console.log('');
  console.log('OK: Merge readiness gates passed.');
  console.log(
    `Doctor lane: ${legacy ? 'legacy app-local broker fallback' : 'default stable-host doctor'}`,
  );
  console.log(`Expected head SHA: ${expectedHead}`);
  console.log('');
  console.log('Exact merge approval prompt:');
  console.log(
    buildGithubMergeApprovalPrompt({
      expectedHead,
      prNumber: Number(prNumber),
    }),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  console.log(`Checking merge readiness for PR #${args.prNumber}...`);
  console.log('');

  let preMergeApproval;
  const preMergeOutput = runNodeScript('scripts/pre-merge-check.js', [args.prNumber], {
    filterOutput(output) {
      preMergeApproval = extractPreMergeApproval(output);
      return preMergeApproval.sanitizedOutput;
    },
  });

  if (!preMergeApproval) {
    preMergeApproval = extractPreMergeApproval(preMergeOutput);
  }

  const doctorArgs = [
    ...(args.legacy ? ['--legacy'] : []),
    '--pr',
    args.prNumber,
    '--expected-head',
    preMergeApproval.expectedHead,
  ];

  console.log('');
  console.log(
    `Running merge doctor for PR #${args.prNumber} with expected head ${preMergeApproval.expectedHead}...`,
  );
  runNodeScript('scripts/github-merge-doctor.mjs', doctorArgs);

  printApproval({
    expectedHead: preMergeApproval.expectedHead,
    legacy: args.legacy,
    prNumber: args.prNumber,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
