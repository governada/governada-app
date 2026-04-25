import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

import { CORE_SYNC_TYPES, getExternalSyncHealthLevel, getSyncPolicy } from '@/lib/syncPolicy';

export type DoctorLevel = 'OK' | 'ADVISORY' | 'BLOCKED';
export type DoctorStatus = 'OK' | 'PASS_WITH_ADVISORIES' | 'BLOCKED';

export interface DoctorCheck {
  detail: string;
  label: string;
  level: DoctorLevel;
}

export interface InngestDoctorReport {
  baseUrl: string;
  checks: DoctorCheck[];
  local: {
    configFunctionCount: number;
    coreFunctionIds: string[];
    functionCount: number;
    routePath: string;
  };
  status: DoctorStatus;
}

export interface InngestDoctorOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  requireLiveFunctionCountMatch?: boolean;
  rootDir?: string;
}

interface ParsedInngestFunction {
  fileKey: string;
  functions: Array<{
    exportName: string | null;
    hasOnFailure: boolean;
    id: string;
    triggers: Array<{ cron?: string; event?: string }>;
  }>;
  functionIds: string[];
  triggers: Array<{ cron?: string; event?: string }>;
}

interface ParsedRouteRegistration {
  configFunctionCount: number;
  functionCount: number;
  registeredBindings: Array<{
    binding: string;
    fileKey: string;
    importedName: string;
  }>;
  registeredFiles: string[];
  routePath: string;
}

interface SyncHealthResponse {
  core_syncs?: Array<{
    lastSuccess?: boolean | null;
    stale?: boolean | null;
    staleMins?: number | null;
    type?: string;
  }>;
  status?: string;
}

const DEFAULT_BASE_URL = 'https://governada.io';
const CORE_FUNCTION_FILES: Record<string, string> = {
  alignment: 'sync-alignment',
  dreps: 'sync-dreps',
  proposals: 'sync-proposals',
  scoring: 'sync-drep-scores',
};
const FRESHNESS_GUARD_FILE = 'sync-freshness-guard';

export function normalizeInngestDoctorBaseUrl(value?: string | null): string {
  const raw = value?.trim() || DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, '');
}

function check(level: DoctorLevel, label: string, detail: string): DoctorCheck {
  return { detail, label, level };
}

function getPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function findProperty(
  objectLiteral: ts.ObjectLiteralExpression,
  propertyName: string,
): ts.Expression | null {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (!property.name) continue;
    if (getPropertyName(property.name) === propertyName) return property.initializer;
  }
  return null;
}

function stringLiteralValue(expression: ts.Expression | null): string | null {
  if (!expression) return null;
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }
  return null;
}

function collectTriggerObjects(
  expression: ts.Expression | null,
): Array<{ cron?: string; event?: string }> {
  if (!expression) return [];

  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.flatMap((element) => collectTriggerObjects(element));
  }

  if (!ts.isObjectLiteralExpression(expression)) return [];

  const cron = stringLiteralValue(findProperty(expression, 'cron')) ?? undefined;
  const event = stringLiteralValue(findProperty(expression, 'event')) ?? undefined;
  return cron || event ? [{ cron, event }] : [];
}

function createSourceFile(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

export function parseInngestFunctionFile(rootDir: string, fileKey: string): ParsedInngestFunction {
  const filePath = path.join(rootDir, 'inngest', 'functions', `${fileKey}.ts`);
  const sourceFile = createSourceFile(filePath);
  const functions: ParsedInngestFunction['functions'] = [];

  function getExportName(node: ts.CallExpression): string | null {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    return null;
  }

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const isCreateFunction =
        ts.isPropertyAccessExpression(expression) && expression.name.text === 'createFunction';

      if (isCreateFunction) {
        const options = node.arguments[0];
        if (options && ts.isObjectLiteralExpression(options)) {
          const id = stringLiteralValue(findProperty(options, 'id'));
          if (id) {
            functions.push({
              exportName: getExportName(node),
              hasOnFailure: Boolean(findProperty(options, 'onFailure')),
              id,
              triggers: collectTriggerObjects(findProperty(options, 'triggers')),
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return {
    fileKey,
    functions,
    functionIds: functions.map((fn) => fn.id),
    triggers: functions.flatMap((fn) => fn.triggers),
  };
}

export function parseInngestRouteRegistration(rootDir: string): ParsedRouteRegistration {
  const routePath = path.join(rootDir, 'app', 'api', 'inngest', 'route.ts');
  const sourceFile = createSourceFile(routePath);
  const bindingToImport = new Map<string, { fileKey: string; importedName: string }>();
  const registeredBindings = new Set<string>();

  function recordImport(node: ts.ImportDeclaration) {
    if (!ts.isStringLiteral(node.moduleSpecifier)) return;
    const modulePath = node.moduleSpecifier.text;
    const prefix = '@/inngest/functions/';
    if (!modulePath.startsWith(prefix)) return;

    const fileKey = modulePath.slice(prefix.length);
    const importClause = node.importClause;
    if (!importClause) return;

    if (importClause.name) {
      bindingToImport.set(importClause.name.text, {
        fileKey,
        importedName: importClause.name.text,
      });
    }

    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        bindingToImport.set(element.name.text, {
          fileKey,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    }
  }

  function recordServeCall(node: ts.CallExpression) {
    if (!ts.isIdentifier(node.expression) || node.expression.text !== 'serve') return;
    const options = node.arguments[0];
    if (!options || !ts.isObjectLiteralExpression(options)) return;

    const functions = findProperty(options, 'functions');
    if (!functions || !ts.isArrayLiteralExpression(functions)) return;

    for (const element of functions.elements) {
      if (ts.isIdentifier(element)) {
        registeredBindings.add(element.text);
      }
    }
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) recordImport(node);
    if (ts.isCallExpression(node)) recordServeCall(node);
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const registeredFunctionBindings = [...registeredBindings]
    .map((binding) => {
      const registeredImport = bindingToImport.get(binding);
      if (!registeredImport) return null;
      return { binding, ...registeredImport };
    })
    .filter((value): value is { binding: string; fileKey: string; importedName: string } =>
      Boolean(value),
    )
    .sort((a, b) => a.binding.localeCompare(b.binding));

  const registeredFiles = [
    ...new Set(registeredFunctionBindings.map((entry) => entry.fileKey)),
  ].sort();
  const configFunctionCount = registeredFunctionBindings.reduce((count, entry) => {
    const parsed = parseInngestFunctionFile(rootDir, entry.fileKey);
    const matched =
      parsed.functions.find((fn) => fn.exportName === entry.importedName) ??
      (parsed.functions.length === 1 ? parsed.functions[0] : null);
    return count + 1 + (matched?.hasOnFailure ? 1 : 0);
  }, 0);

  return {
    configFunctionCount,
    functionCount: registeredBindings.size,
    registeredBindings: registeredFunctionBindings,
    registeredFiles,
    routePath,
  };
}

function validateLocalRegistration(rootDir: string, route: ParsedRouteRegistration): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const registeredFiles = new Set(route.registeredFiles);

  for (const syncType of CORE_SYNC_TYPES) {
    const fileKey = CORE_FUNCTION_FILES[syncType];
    const policy = getSyncPolicy(syncType);
    const parsed = fileKey ? parseInngestFunctionFile(rootDir, fileKey) : null;

    if (!fileKey || !parsed) {
      checks.push(
        check('BLOCKED', `Local ${syncType} function`, 'No core function mapping exists.'),
      );
      continue;
    }

    if (!registeredFiles.has(fileKey)) {
      checks.push(
        check(
          'BLOCKED',
          `Local ${syncType} registration`,
          `${fileKey}.ts is not registered in app/api/inngest/route.ts.`,
        ),
      );
    } else {
      checks.push(
        check(
          'OK',
          `Local ${syncType} registration`,
          `${fileKey}.ts is registered in app/api/inngest/route.ts.`,
        ),
      );
    }

    if (policy.event && !parsed.triggers.some((trigger) => trigger.event === policy.event)) {
      checks.push(
        check(
          'BLOCKED',
          `Local ${syncType} event trigger`,
          `${fileKey}.ts is missing event trigger ${policy.event}.`,
        ),
      );
    } else if (policy.event) {
      checks.push(check('OK', `Local ${syncType} event trigger`, `${policy.event} is configured.`));
    }

    const crons = parsed.triggers.map((trigger) => trigger.cron).filter(Boolean);
    if (crons.length === 0) {
      checks.push(
        check(
          'BLOCKED',
          `Local ${syncType} cron trigger`,
          `${fileKey}.ts has no cron trigger for scheduled execution.`,
        ),
      );
    } else {
      checks.push(
        check('OK', `Local ${syncType} cron trigger`, `cron ${crons.join(', ')} is configured.`),
      );
    }
  }

  const guard = parseInngestFunctionFile(rootDir, FRESHNESS_GUARD_FILE);
  if (!registeredFiles.has(FRESHNESS_GUARD_FILE)) {
    checks.push(
      check(
        'BLOCKED',
        'Local freshness guard registration',
        `${FRESHNESS_GUARD_FILE}.ts is not registered in app/api/inngest/route.ts.`,
      ),
    );
  } else {
    checks.push(
      check(
        'OK',
        'Local freshness guard registration',
        `${FRESHNESS_GUARD_FILE}.ts is registered in app/api/inngest/route.ts.`,
      ),
    );
  }

  const guardCrons = guard.triggers.map((trigger) => trigger.cron).filter(Boolean);
  if (guardCrons.length === 0) {
    checks.push(
      check(
        'BLOCKED',
        'Local freshness guard cron trigger',
        `${FRESHNESS_GUARD_FILE}.ts has no cron trigger.`,
      ),
    );
  } else {
    checks.push(
      check(
        'OK',
        'Local freshness guard cron trigger',
        `cron ${guardCrons.join(', ')} is configured.`,
      ),
    );
  }

  return checks;
}

function validateLiveIntrospection(
  body: Record<string, unknown>,
  route: ParsedRouteRegistration,
  requireLiveFunctionCountMatch: boolean,
): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const liveFunctionCount = body.function_count;

  if (typeof liveFunctionCount === 'number') {
    const detail = `live=${liveFunctionCount}, localConfig=${route.configFunctionCount}, localRoute=${route.functionCount}`;
    if (liveFunctionCount === route.configFunctionCount) {
      checks.push(check('OK', 'Live Inngest served function count', detail));
    } else {
      checks.push(
        check(
          requireLiveFunctionCountMatch ? 'BLOCKED' : 'ADVISORY',
          'Live Inngest served function count',
          `${detail}. This can be expected before the current branch is deployed; use --require-live-match for post-deploy checks.`,
        ),
      );
    }
  } else {
    checks.push(
      check(
        'ADVISORY',
        'Live Inngest served function count',
        'GET /api/inngest did not expose function_count.',
      ),
    );
  }

  for (const key of ['has_event_key', 'has_signing_key'] as const) {
    if (body[key] === true) {
      checks.push(check('OK', `Live Inngest ${key}`, `${key}=true`));
    } else {
      checks.push(
        check('BLOCKED', `Live Inngest ${key}`, `${key} was not true in GET /api/inngest.`),
      );
    }
  }

  checks.push(
    check(
      'ADVISORY',
      'Inngest server registration freshness',
      'Read-only GET /api/inngest proves served endpoint shape, not whether the self-hosted Inngest server registration would return modified=false. Use npm run inngest:register only with explicit approval.',
    ),
  );

  return checks;
}

function validateSyncHealth(body: SyncHealthResponse): DoctorCheck[] {
  const checks: DoctorCheck[] = [];

  if (body.status === 'healthy') {
    checks.push(check('OK', 'Core sync health endpoint', 'status=healthy'));
  } else {
    checks.push(
      check('BLOCKED', 'Core sync health endpoint', `status=${body.status ?? 'missing'}`),
    );
  }

  if (!Array.isArray(body.core_syncs)) {
    checks.push(
      check(
        'BLOCKED',
        'Core sync health payload',
        'Missing core_syncs array from /api/health/sync.',
      ),
    );
    return checks;
  }

  for (const syncType of CORE_SYNC_TYPES) {
    const row = body.core_syncs.find((sync) => sync.type === syncType);
    const policy = getSyncPolicy(syncType);
    if (!row) {
      checks.push(check('BLOCKED', `Core sync ${syncType}`, 'Missing from /api/health/sync.'));
      continue;
    }

    const staleMins = typeof row.staleMins === 'number' ? row.staleMins : null;
    const expectedStatus =
      staleMins == null
        ? 'critical'
        : getExternalSyncHealthLevel(syncType, staleMins, row.lastSuccess);

    if (row.lastSuccess === false) {
      checks.push(check('BLOCKED', `Core sync ${syncType}`, 'lastSuccess=false'));
    } else if (row.stale === true || expectedStatus === 'critical') {
      checks.push(
        check(
          'BLOCKED',
          `Core sync ${syncType}`,
          `staleMins=${staleMins ?? 'missing'} exceeds external threshold ${policy.externalCriticalAfterMinutes} or endpoint marked stale.`,
        ),
      );
    } else {
      checks.push(
        check(
          'OK',
          `Core sync ${syncType}`,
          `staleMins=${staleMins ?? 'missing'}, external threshold=${policy.externalCriticalAfterMinutes}, lastSuccess=${row.lastSuccess}`,
        ),
      );
    }
  }

  return checks;
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
): Promise<{ body: Record<string, unknown>; status: number }> {
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': 'Governada-InngestDoctor/1.0' },
    method: 'GET',
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as Record<string, unknown>;
  return { body, status: response.status };
}

function summarizeStatus(checks: DoctorCheck[]): DoctorStatus {
  if (checks.some((entry) => entry.level === 'BLOCKED')) return 'BLOCKED';
  if (checks.some((entry) => entry.level === 'ADVISORY')) return 'PASS_WITH_ADVISORIES';
  return 'OK';
}

export async function runInngestDoctor({
  baseUrl,
  fetchImpl = fetch,
  requireLiveFunctionCountMatch = false,
  rootDir = process.cwd(),
}: InngestDoctorOptions = {}): Promise<InngestDoctorReport> {
  const normalizedBaseUrl = normalizeInngestDoctorBaseUrl(baseUrl);
  const route = parseInngestRouteRegistration(rootDir);
  const checks: DoctorCheck[] = [];

  checks.push(...validateLocalRegistration(rootDir, route));

  try {
    const { body, status } = await fetchJson(fetchImpl, `${normalizedBaseUrl}/api/inngest`);
    if (status === 200) {
      checks.push(check('OK', 'Live Inngest introspection GET', `${status} OK`));
      checks.push(...validateLiveIntrospection(body, route, requireLiveFunctionCountMatch));
    } else {
      checks.push(
        check('BLOCKED', 'Live Inngest introspection GET', `Expected 200, got ${status}.`),
      );
    }
  } catch (error) {
    checks.push(
      check(
        'BLOCKED',
        'Live Inngest introspection GET',
        `GET failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  try {
    const { body, status } = await fetchJson(fetchImpl, `${normalizedBaseUrl}/api/health/sync`);
    if (status === 200) {
      checks.push(check('OK', 'Core sync health GET', `${status} OK`));
    } else {
      checks.push(check('BLOCKED', 'Core sync health GET', `Expected 200, got ${status}.`));
    }
    checks.push(...validateSyncHealth(body as SyncHealthResponse));
  } catch (error) {
    checks.push(
      check(
        'BLOCKED',
        'Core sync health GET',
        `GET failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }

  const coreFunctionIds = CORE_SYNC_TYPES.flatMap((syncType) => {
    const fileKey = CORE_FUNCTION_FILES[syncType];
    return fileKey ? parseInngestFunctionFile(rootDir, fileKey).functionIds : [];
  });

  return {
    baseUrl: normalizedBaseUrl,
    checks,
    local: {
      configFunctionCount: route.configFunctionCount,
      coreFunctionIds,
      functionCount: route.functionCount,
      routePath: path.relative(rootDir, route.routePath),
    },
    status: summarizeStatus(checks),
  };
}

export function formatInngestDoctorReport(report: InngestDoctorReport): string {
  const lines = [
    'Inngest doctor: read-only registration, schedule, and freshness checks',
    `Base URL: ${report.baseUrl}`,
    `Local Inngest route: ${report.local.routePath}`,
    `Local registered function count: ${report.local.functionCount}`,
    `Local SDK config function count: ${report.local.configFunctionCount}`,
    `Core function IDs: ${report.local.coreFunctionIds.join(', ')}`,
    'Mutation policy: no PUT /api/inngest or sync trigger was attempted',
    '',
  ];

  for (const entry of report.checks) {
    lines.push(`${entry.level}: ${entry.label} - ${entry.detail}`);
  }

  lines.push('', `Inngest doctor result: ${report.status}`);
  return lines.join('\n');
}
