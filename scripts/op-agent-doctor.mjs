#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const AGENT_TOKEN_KEY = 'OP_AGENT_SERVICE_ACCOUNT_TOKEN';
const OP_CLI_SERVICE_ACCOUNT_TOKEN_KEY = ['OP', 'SERVICE', 'ACCOUNT', 'TOKEN'].join('_');
const DEFAULT_ENV_FILE = '/Users/tim/dev/agent-runtime/env/governada-agent.env';
const DEFAULT_VAULT = 'Governada-Agent';
const DEFAULT_EXPECTED_ITEMS = [
  {
    item: 'governada-posthog-staging',
    fields: ['POSTHOG_PERSONAL_API_KEY', 'POSTHOG_PROJECT_ID', 'NEXT_PUBLIC_POSTHOG_HOST'],
  },
];
const FORBIDDEN_ITEM_NAME_PATTERNS = ['prod', 'production', 'mainnet', 'admin', 'deploy', 'rotate'];
const MIN_OP_VERSION = [2, 18, 0];
const OP_TIMEOUT_MS = 15000;

function usage() {
  return `Usage: npm run op:agent-doctor -- [--agent-env-file <path>] [--vault <name>] [--item "<item>=FIELD_A,FIELD_B"]

Defaults:
  env file: ${DEFAULT_ENV_FILE}
  vault:    ${DEFAULT_VAULT}
  items:    PostHog staging read-only automation item`;
}

function parseArgs(argv) {
  const options = {
    envFile: process.env.GOVERNADA_AGENT_OP_ENV_FILE || DEFAULT_ENV_FILE,
    items: [],
    vault: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--agent-env-file') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for --agent-env-file.\n${usage()}`);
      }
      options.envFile = value;
      index += 1;
      continue;
    }

    if (arg === '--vault') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for --vault.\n${usage()}`);
      }
      options.vault = value;
      index += 1;
      continue;
    }

    if (arg === '--item') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error(`Missing value for --item.\n${usage()}`);
      }
      options.items.push(parseItemSpec(value));
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log(usage());
      process.exit(0);
    }

    throw new Error(`Unknown option: ${arg}\n${usage()}`);
  }

  return options;
}

function parseItemSpec(value) {
  const separatorIndex = value.indexOf('=');
  if (separatorIndex === -1) {
    throw new Error(`Invalid --item value: ${value}. Expected "Item title=FIELD_A,FIELD_B".`);
  }

  const item = value.slice(0, separatorIndex).trim();
  const fields = value
    .slice(separatorIndex + 1)
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean);

  if (!item || fields.length === 0) {
    throw new Error(`Invalid --item value: ${value}. Expected "Item title=FIELD_A,FIELD_B".`);
  }

  return { item, fields };
}

function parseItemsEnv(value) {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseItemSpec);
}

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ') ? line.slice(7).trimStart() : line;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

function loadEnvFile(envFile) {
  if (!envFile || !existsSync(envFile)) {
    return { env: {}, source: 'process environment', secure: true };
  }

  const stat = statSync(envFile);
  const groupOrWorldReadable = (stat.mode & 0o077) !== 0;
  const env = parseEnvFile(readFileSync(envFile, 'utf8'));

  return {
    env,
    secure: !groupOrWorldReadable,
    source: envFile,
  };
}

function redactSensitiveText(text, sensitiveValues = []) {
  let redacted = String(text || '');

  for (const value of sensitiveValues) {
    if (value) {
      redacted = redacted.split(value).join('[redacted-op-service-account-token]');
    }
  }

  return redacted
    .replace(/\bops_[A-Za-z0-9_=-]{20,}\b/gu, '[redacted-op-service-account-token]')
    .replace(
      /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/gu,
      '[redacted-token]',
    )
    .replace(/op:\/\/[^\r\n'"]+/gu, 'op://[redacted]');
}

function firstLine(text) {
  return (
    String(text)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .find(Boolean) || ''
  );
}

function runOp(args, env, sensitiveValues = []) {
  const result = spawnSync('op', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: OP_TIMEOUT_MS,
  });

  const timedOut = result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM';
  return {
    error: result.error,
    signal: result.signal,
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: redactSensitiveText(result.stderr || result.error?.message || '', sensitiveValues),
    timedOut,
  };
}

function compareVersion(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    const actualPart = actual[index] || 0;
    const minimumPart = minimum[index] || 0;
    if (actualPart > minimumPart) {
      return 1;
    }
    if (actualPart < minimumPart) {
      return -1;
    }
  }

  return 0;
}

function parseVersion(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/u);
  if (!match) {
    return [];
  }

  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function resultSummary(result, sensitiveValues = []) {
  if (result.timedOut) {
    return `timed out after ${OP_TIMEOUT_MS}ms`;
  }

  const detail = firstLine(redactSensitiveText(result.stderr, sensitiveValues));
  return detail || `exit ${result.status}`;
}

function collectFields(value, fields = new Map()) {
  if (!value || typeof value !== 'object') {
    return fields;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectFields(entry, fields);
    }
    return fields;
  }

  if (typeof value.label === 'string' && Object.hasOwn(value, 'value')) {
    fields.set(value.label, value.value);
  }

  for (const entry of Object.values(value)) {
    if (entry && typeof entry === 'object') {
      collectFields(entry, fields);
    }
  }

  return fields;
}

function printCheck(ok, message) {
  console.log(`${ok ? 'OK' : 'BLOCKED'}: ${message}`);
}

function findForbiddenItemNames(items) {
  return items.filter((item) => {
    const name = String(item.item || item.title || item.name || '').toLowerCase();
    return FORBIDDEN_ITEM_NAME_PATTERNS.some((pattern) => name.includes(pattern));
  });
}

function parseItemNamesFromList(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => item?.title || item?.name)
    .filter((name) => typeof name === 'string' && name.trim())
    .map((name) => ({ item: name.trim() }));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const file = loadEnvFile(options.envFile);
  const mergedEnv = {
    ...file.env,
    ...process.env,
  };
  const token = mergedEnv[AGENT_TOKEN_KEY] || '';
  const legacyToken = mergedEnv[OP_CLI_SERVICE_ACCOUNT_TOKEN_KEY] || '';
  const sensitiveValues = [token, legacyToken];
  const vault = options.vault || mergedEnv.GOVERNADA_OP_AGENT_VAULT || DEFAULT_VAULT;
  const envItems = parseItemsEnv(mergedEnv.GOVERNADA_OP_AGENT_ITEMS || '');
  const expectedItems =
    options.items.length > 0
      ? options.items
      : envItems.length > 0
        ? envItems
        : DEFAULT_EXPECTED_ITEMS;
  const failures = [];

  console.log('1Password agent automation doctor');
  console.log(`Env source: ${file.source}`);
  console.log(`Vault: ${vault}`);
  console.log(`Expected items: ${expectedItems.length}`);

  if (!file.secure) {
    failures.push(`${file.source} is group/world readable; run chmod 600 before using it.`);
    printCheck(false, 'runtime env file permissions are too broad');
  } else if (file.source !== 'process environment') {
    printCheck(true, 'runtime env file permissions are owner-only');
  }

  if (legacyToken && !token) {
    failures.push(
      `${OP_CLI_SERVICE_ACCOUNT_TOKEN_KEY} is set but no longer recognized for this lane - rename to ${AGENT_TOKEN_KEY} per the lean-agent-harness ADR addendum.`,
    );
    printCheck(false, `${OP_CLI_SERVICE_ACCOUNT_TOKEN_KEY} is not recognized for this lane`);
  } else if (!token) {
    failures.push(`${AGENT_TOKEN_KEY} is missing from process env and ${options.envFile}.`);
    printCheck(false, `${AGENT_TOKEN_KEY} is missing`);
  } else if (!token.startsWith('ops_')) {
    failures.push(`${AGENT_TOKEN_KEY} is present but does not use the expected ops_ prefix.`);
    printCheck(false, `${AGENT_TOKEN_KEY} shape is not a 1Password service-account token`);
  } else {
    printCheck(true, `${AGENT_TOKEN_KEY} is present with ops_ prefix (value redacted)`);
  }

  const connectKeys = ['OP_CONNECT_HOST', 'OP_CONNECT_TOKEN'].filter((key) => mergedEnv[key]);
  if (connectKeys.length > 0) {
    failures.push(
      `${connectKeys.join('/')} ${connectKeys.length === 1 ? 'is' : 'are'} set and would override ${AGENT_TOKEN_KEY}.`,
    );
    printCheck(false, 'OP_CONNECT_HOST/OP_CONNECT_TOKEN must be unset for this lane');
  } else {
    printCheck(true, 'OP_CONNECT_HOST and OP_CONNECT_TOKEN are absent');
  }

  const version = runOp(['--version'], mergedEnv, sensitiveValues);
  if (version.status !== 0) {
    failures.push(`1Password CLI probe failed: ${resultSummary(version, sensitiveValues)}`);
    printCheck(false, '1Password CLI (`op`) is not available');
  } else {
    const parsedVersion = parseVersion(version.stdout);
    if (compareVersion(parsedVersion, MIN_OP_VERSION) < 0) {
      failures.push(
        `1Password CLI ${firstLine(version.stdout)} is below required ${MIN_OP_VERSION.join('.')}.`,
      );
      printCheck(false, '1Password CLI version is below service-account minimum');
    } else {
      printCheck(true, `1Password CLI ${firstLine(version.stdout)} supports service accounts`);
    }
  }

  const forbiddenExpectedItems = findForbiddenItemNames(expectedItems);
  if (forbiddenExpectedItems.length > 0) {
    failures.push(
      `Vault contains an item whose name matches a forbidden production/admin pattern - review against [[decisions/lean-agent-harness]] addendum scope before proceeding. Items: ${forbiddenExpectedItems.map((item) => item.item).join(', ')}`,
    );
    printCheck(false, 'configured item names match a forbidden production/admin pattern');
  } else {
    printCheck(true, 'configured item names avoid obvious production/admin patterns');
  }

  if (failures.length === 0) {
    const opEnv = {
      ...mergedEnv,
    };
    opEnv[OP_CLI_SERVICE_ACCOUNT_TOKEN_KEY] = token;
    delete opEnv.OP_CONNECT_HOST;
    delete opEnv.OP_CONNECT_TOKEN;

    const itemList = runOp(
      ['item', 'list', '--vault', vault, '--format', 'json'],
      opEnv,
      sensitiveValues,
    );

    if (itemList.status !== 0) {
      failures.push(`Cannot list items in ${vault}: ${resultSummary(itemList, sensitiveValues)}`);
      printCheck(false, `${vault}: item-list scope guard failed`);
    } else {
      const forbiddenVaultItems = findForbiddenItemNames(parseItemNamesFromList(itemList.stdout));
      if (forbiddenVaultItems.length > 0) {
        failures.push(
          `Vault contains an item whose name matches a forbidden production/admin pattern - review against [[decisions/lean-agent-harness]] addendum scope before proceeding. Items: ${forbiddenVaultItems.map((item) => item.item).join(', ')}`,
        );
        printCheck(false, `${vault}: forbidden production/admin-pattern item name found`);
      } else {
        printCheck(true, `${vault}: item names pass production/admin scope guard`);
      }
    }

    for (const expected of failures.length === 0 ? expectedItems : []) {
      const fieldSelectors = expected.fields.map((field) => `label=${field}`).join(',');
      const result = runOp(
        [
          'item',
          'get',
          expected.item,
          '--vault',
          vault,
          '--fields',
          fieldSelectors,
          '--format',
          'json',
          '--reveal',
        ],
        opEnv,
        sensitiveValues,
      );

      if (result.status !== 0) {
        failures.push(
          `${expected.item}: cannot read item from ${vault}: ${resultSummary(result, sensitiveValues)}`,
        );
        printCheck(false, `${expected.item}: item read failed`);
        continue;
      }

      let itemJson;
      try {
        itemJson = JSON.parse(result.stdout);
      } catch {
        failures.push(`${expected.item}: 1Password returned non-JSON item data.`);
        printCheck(false, `${expected.item}: item JSON parse failed`);
        continue;
      }

      const fieldMap = collectFields(itemJson);
      const missingFields = expected.fields.filter((field) => !fieldMap.has(field));
      const emptyFields = expected.fields.filter(
        (field) => fieldMap.has(field) && !fieldMap.get(field),
      );

      if (missingFields.length > 0 || emptyFields.length > 0) {
        if (missingFields.length > 0) {
          failures.push(`${expected.item}: missing fields ${missingFields.join(', ')}.`);
        }
        if (emptyFields.length > 0) {
          failures.push(`${expected.item}: empty fields ${emptyFields.join(', ')}.`);
        }
        printCheck(false, `${expected.item}: expected fields are not all readable`);
        continue;
      }

      printCheck(
        true,
        `${expected.item}: fields readable (${expected.fields.join(', ')}; values redacted)`,
      );
    }
  }

  if (failures.length > 0) {
    console.error('');
    console.error('Result: BLOCKED');
    for (const failure of failures) {
      console.error(`- ${redactSensitiveText(failure, sensitiveValues)}`);
    }
    process.exit(1);
  }

  console.log('Result: OK');
}

try {
  main();
} catch (error) {
  console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
