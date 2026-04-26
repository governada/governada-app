export const GITHUB_SHIP_CONFIRMATION = 'github.ship.pr';
export const GITHUB_SHIP_OPERATIONS = new Set(['publish']);

export function parseGithubShipArgs(argv) {
  const operation = argv[0] || '';
  if (argv.includes('--help') || argv.includes('-h') || !operation) {
    return { help: true };
  }

  if (!GITHUB_SHIP_OPERATIONS.has(operation)) {
    throw new Error(`Unknown operation: ${operation}. Expected publish.`);
  }

  const args = {
    base: 'origin/main',
    confirm: '',
    execute: false,
    head: '',
    operation,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--execute') {
      args.execute = true;
    } else if (value === '--base') {
      args.base = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--base=')) {
      args.base = value.slice('--base='.length);
    } else if (value === '--confirm') {
      args.confirm = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--confirm=')) {
      args.confirm = value.slice('--confirm='.length);
    } else if (value === '--head') {
      args.head = requireNextValue(argv, index, value);
      index += 1;
    } else if (value.startsWith('--head=')) {
      args.head = value.slice('--head='.length);
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
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

export function buildGithubShipPlan(args) {
  if (args.help) {
    return { help: true };
  }

  if (!args.execute && args.confirm) {
    throw new Error('--confirm is only valid with --execute.');
  }

  if (args.execute && args.confirm !== GITHUB_SHIP_CONFIRMATION) {
    throw new Error(`--execute requires --confirm ${GITHUB_SHIP_CONFIRMATION}.`);
  }

  assertAllowedShipBranchName(args.head, '--head');
  assertAllowedBaseRef(args.base);

  return {
    base: args.base,
    description: `publish local HEAD diff to ${args.head} from ${args.base}`,
    execute: args.execute,
    head: args.head,
    operation: args.operation,
  };
}

export function assertAllowedShipBranchName(value, flag = 'branch') {
  if (!value) {
    throw new Error(`${flag} is required.`);
  }

  if (
    !/^(?:codex|feat)\/[A-Za-z0-9._/-]+$/u.test(value) ||
    value === 'main' ||
    value.includes(':') ||
    value.includes('..') ||
    value.includes('//') ||
    value.startsWith('-')
  ) {
    throw new Error(`${flag} must be a same-repository codex/* or feat/* branch name.`);
  }
}

function assertAllowedBaseRef(value) {
  if (!value || value !== 'origin/main') {
    throw new Error('--base must be origin/main for github.ship.pr v1.');
  }
}

export function printGithubShipUsage() {
  console.log(`Usage:
  npm run github:ship -- publish --head <codex-or-feat-branch> [--base origin/main]
  npm run github:ship -- publish --head <codex-or-feat-branch> --execute --confirm ${GITHUB_SHIP_CONFIRMATION}

Dry-run is the default. Live branch publishing uses the local GitHub runtime broker and GitHub Git Data APIs. It refuses main, cross-repo refs, force push, dirty worktrees, and no-op publishes.`);
}
