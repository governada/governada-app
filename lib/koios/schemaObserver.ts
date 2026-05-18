import { createHash } from 'node:crypto';
import { inngest } from '@/lib/inngest';
import { logger } from '@/lib/logger';
import knownShapesJson from './knownShapes.json';

export const KOIOS_SCHEMA_DRIFT_EVENT = 'drepscore/schema-drift.detected';
export const KOIOS_SCHEMA_TARGET_FILE = 'utils/koios-schemas.ts';
export const KOIOS_SCHEMA_PRECEDENT_PR = 'https://github.com/governada/app/pull/664';

export const INSTRUMENTED_KOIOS_ENDPOINT_KEYS = [
  'account_assets',
  'account_info',
  'committee_info',
  'drep_delegators',
  'drep_epoch_summary',
  'drep_info',
  'drep_list',
  'drep_metadata',
  'drep_updates',
  'drep_votes',
  'drep_voting_power_history',
  'epoch_info',
  'epoch_params',
  'proposal_list',
  'proposal_voting_summary',
  'tip',
  'totals',
  'vote_list_cc',
  'vote_list_drep',
  'vote_list_spo',
] as const;

export type InstrumentedKoiosEndpointKey = (typeof INSTRUMENTED_KOIOS_ENDPOINT_KEYS)[number];

export type ShapeValueType =
  | 'array'
  | 'boolean'
  | 'null'
  | 'number'
  | 'object'
  | 'string'
  | 'unknown';

export type SchemaShape = {
  types: ShapeValueType[];
  fields?: Record<string, SchemaShape>;
  items?: SchemaShape;
};

export type KnownKoiosShape = {
  endpoint: string;
  observedAt: string;
  shapeHash: string;
  shape: SchemaShape;
};

export type KnownKoiosShapesFile = {
  version: number;
  generatedAt: string;
  source: string;
  endpoints: Partial<Record<InstrumentedKoiosEndpointKey, KnownKoiosShape>>;
};

export type SchemaDriftChange = {
  kind: 'missing_known_shape' | 'novel_field' | 'type_change';
  path: string;
  knownTypes: ShapeValueType[];
  observedTypes: ShapeValueType[];
  observedSample: unknown;
  suggestedZod: string;
};

export type SchemaDriftEventData = {
  endpoint: InstrumentedKoiosEndpointKey;
  rawEndpoint: string;
  observedAt: string;
  knownShapeHash: string | null;
  observedShapeHash: string;
  driftFingerprint: string;
  changes: SchemaDriftChange[];
  observedShape: SchemaShape;
  targetFile: typeof KOIOS_SCHEMA_TARGET_FILE;
  precedentPr: string;
};

type RecordOptions = {
  knownShapes?: KnownKoiosShapesFile;
  now?: () => Date;
  sendEvent?: (data: SchemaDriftEventData) => Promise<unknown>;
};

type ShapeAccumulator = {
  shape: SchemaShape;
  samples: Map<string, unknown>;
};

const KNOWN_SHAPES = knownShapesJson as KnownKoiosShapesFile;

function sortTypes(types: Iterable<ShapeValueType>): ShapeValueType[] {
  return [...new Set(types)].sort();
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, child) => {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return Object.fromEntries(
        Object.entries(child as Record<string, unknown>).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    }
    return child;
  });
}

export function hashShape(shape: SchemaShape): string {
  return createHash('sha256').update(stableStringify(shape)).digest('hex');
}

export function hashSchemaDrift(
  endpoint: InstrumentedKoiosEndpointKey,
  changes: SchemaDriftChange[],
): string {
  return createHash('sha256')
    .update(
      stableStringify({
        endpoint,
        changes: changes.map((change) => ({
          kind: change.kind,
          path: change.path,
          knownTypes: change.knownTypes,
          observedTypes: change.observedTypes,
          suggestedZod: change.suggestedZod,
        })),
      }),
    )
    .digest('hex');
}

function valueType(value: unknown): ShapeValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'object':
      return 'object';
    case 'string':
      return 'string';
    default:
      return 'unknown';
  }
}

function mergeShape(left: SchemaShape | null, right: SchemaShape): SchemaShape {
  if (!left) return right;

  const merged: SchemaShape = {
    types: sortTypes([...left.types, ...right.types]),
  };

  const fieldKeys = new Set([
    ...Object.keys(left.fields ?? {}),
    ...Object.keys(right.fields ?? {}),
  ]);
  if (fieldKeys.size > 0) {
    merged.fields = {};
    for (const key of [...fieldKeys].sort()) {
      const leftField = left.fields?.[key] ?? null;
      const rightField = right.fields?.[key] ?? null;
      if (leftField && rightField) {
        merged.fields[key] = mergeShape(leftField, rightField);
      } else {
        merged.fields[key] = leftField ?? rightField!;
      }
    }
  }

  if (left.items || right.items) {
    merged.items = mergeShape(left.items ?? null, right.items ?? { types: ['unknown'] });
  }

  return merged;
}

function sampleValue(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value === 'object') return '[object]';
  if (typeof value === 'string') return value.length > 160 ? `${value.slice(0, 157)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function inferShapeForValue(
  value: unknown,
  path: string,
  samples: Map<string, unknown>,
): SchemaShape {
  const type = valueType(value);
  if (path && !samples.has(path) && type !== 'unknown') {
    samples.set(path, sampleValue(value));
  }

  if (Array.isArray(value)) {
    // Sampling 25 items keeps observation cheap on paginated Koios responses while merging mixed row shapes.
    const items = value
      .slice(0, 25)
      .reduce<SchemaShape | null>(
        (shape, item) => mergeShape(shape, inferShapeForValue(item, `${path}[]`, samples)),
        null,
      );
    return { types: ['array'], items: items ?? { types: ['unknown'] } };
  }

  if (value && typeof value === 'object') {
    const fields: Record<string, SchemaShape> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const childPath = path ? `${path}.${key}` : key;
      fields[key] = inferShapeForValue(child, childPath, samples);
    }
    return { types: ['object'], fields };
  }

  return { types: [type] };
}

export function inferKoiosShape(value: unknown): ShapeAccumulator {
  const samples = new Map<string, unknown>();
  return {
    shape: inferShapeForValue(value, '', samples),
    samples,
  };
}

function parseEndpoint(endpoint: string): { pathname: string; search: URLSearchParams } {
  const parsed = new URL(endpoint, 'https://api.koios.rest');
  return {
    pathname: parsed.pathname.replace(/^\/+/u, ''),
    search: parsed.searchParams,
  };
}

export function getKoiosSchemaEndpointKey(endpoint: string): InstrumentedKoiosEndpointKey | null {
  const parsed = parseEndpoint(endpoint);
  if (parsed.pathname === 'vote_list') {
    const role = parsed.search.get('voter_role') ?? '';
    if (role.includes('ConstitutionalCommittee')) return 'vote_list_cc';
    if (role.includes('SPO')) return 'vote_list_spo';
    return 'vote_list_drep';
  }

  if ((INSTRUMENTED_KOIOS_ENDPOINT_KEYS as readonly string[]).includes(parsed.pathname)) {
    return parsed.pathname as InstrumentedKoiosEndpointKey;
  }

  return null;
}

function findShapeAtPath(shape: SchemaShape | null, path: string): SchemaShape | null {
  if (!shape) return null;
  if (!path) return shape;

  const [head, ...rest] = path.split('.');
  if (head === '[]') {
    return findShapeAtPath(shape.items ?? null, rest.join('.'));
  }
  return findShapeAtPath(shape.fields?.[head] ?? null, rest.join('.'));
}

function flattenFields(
  shape: SchemaShape,
  prefix = '',
  output: Array<{ path: string; shape: SchemaShape }> = [],
): Array<{ path: string; shape: SchemaShape }> {
  if (shape.items) {
    flattenFields(shape.items, prefix ? `${prefix}.[]` : '[]', output);
  }

  for (const [key, fieldShape] of Object.entries(shape.fields ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    output.push({ path, shape: fieldShape });
    flattenFields(fieldShape, path, output);
  }

  return output;
}

function isTypeSubset(observed: ShapeValueType[], known: ShapeValueType[]): boolean {
  const knownSet = new Set(known);
  return observed.every((type) => knownSet.has(type));
}

function getSample(samples: Map<string, unknown>, path: string): unknown {
  return samples.get(path) ?? null;
}

export function buildZodSuggestion(shape: SchemaShape): string {
  const nonNullTypes = shape.types.filter((type) => type !== 'null');
  const nullable = shape.types.includes('null');
  let base: string;

  if (nonNullTypes.includes('array')) {
    base = `z.array(${shape.items ? buildZodSuggestion(shape.items).replace(/\.optional\(\)$/u, '') : 'z.unknown()'})`;
  } else if (nonNullTypes.includes('object')) {
    const fields = Object.entries(shape.fields ?? {})
      .slice(0, 12)
      .map(([key, child]) => `${JSON.stringify(key)}: ${buildZodSuggestion(child)}`)
      .join(', ');
    base = `z.object({ ${fields} }).passthrough()`;
  } else if (nonNullTypes.length > 1) {
    base = `z.union([${nonNullTypes.map((type) => primitiveZod(type)).join(', ')}])`;
  } else {
    base = primitiveZod(nonNullTypes[0] ?? 'unknown');
  }

  return `${base}${nullable ? '.nullable()' : ''}.optional()`;
}

function primitiveZod(type: ShapeValueType): string {
  switch (type) {
    case 'boolean':
      return 'z.boolean()';
    case 'number':
      return 'z.number()';
    case 'string':
      return 'z.string()';
    case 'null':
      return 'z.null()';
    default:
      return 'z.unknown()';
  }
}

export function findSchemaDrift(
  knownShape: SchemaShape | null,
  observedShape: SchemaShape,
  samples: Map<string, unknown>,
): SchemaDriftChange[] {
  if (!knownShape) {
    return [
      {
        kind: 'missing_known_shape',
        path: '$',
        knownTypes: [],
        observedTypes: observedShape.types,
        observedSample: null,
        suggestedZod: buildZodSuggestion(observedShape),
      },
    ];
  }

  const changes: SchemaDriftChange[] = [];
  for (const observed of flattenFields(observedShape)) {
    const known = findShapeAtPath(knownShape, observed.path);
    if (!known) {
      changes.push({
        kind: 'novel_field',
        path: observed.path,
        knownTypes: [],
        observedTypes: observed.shape.types,
        observedSample: getSample(samples, observed.path),
        suggestedZod: buildZodSuggestion(observed.shape),
      });
      continue;
    }

    if (!isTypeSubset(observed.shape.types, known.types)) {
      changes.push({
        kind: 'type_change',
        path: observed.path,
        knownTypes: known.types,
        observedTypes: observed.shape.types,
        observedSample: getSample(samples, observed.path),
        suggestedZod: buildZodSuggestion(observed.shape),
      });
    }
  }

  return changes;
}

async function sendSchemaDriftEvent(data: SchemaDriftEventData): Promise<unknown> {
  return inngest.send({ name: KOIOS_SCHEMA_DRIFT_EVENT, data });
}

export async function recordKoiosSchema(
  response: unknown,
  endpoint: string,
  options: RecordOptions = {},
): Promise<{ emitted: boolean; endpoint: InstrumentedKoiosEndpointKey | null; changes: number }> {
  if (process.env.KOIOS_SCHEMA_OBSERVER_DISABLED === '1') {
    return { emitted: false, endpoint: null, changes: 0 };
  }

  const endpointKey = getKoiosSchemaEndpointKey(endpoint);
  if (!endpointKey) {
    return { emitted: false, endpoint: null, changes: 0 };
  }

  try {
    const knownShapes = options.knownShapes ?? KNOWN_SHAPES;
    const observed = inferKoiosShape(response);
    const observedShapeHash = hashShape(observed.shape);
    const known = knownShapes.endpoints[endpointKey] ?? null;

    if (known?.shapeHash === observedShapeHash) {
      return { emitted: false, endpoint: endpointKey, changes: 0 };
    }

    const changes = findSchemaDrift(known?.shape ?? null, observed.shape, observed.samples);
    if (changes.length === 0) {
      return { emitted: false, endpoint: endpointKey, changes: 0 };
    }

    const eventData: SchemaDriftEventData = {
      endpoint: endpointKey,
      rawEndpoint: endpoint,
      observedAt: (options.now ?? (() => new Date()))().toISOString(),
      knownShapeHash: known?.shapeHash ?? null,
      observedShapeHash,
      driftFingerprint: hashSchemaDrift(endpointKey, changes),
      changes,
      observedShape: observed.shape,
      targetFile: KOIOS_SCHEMA_TARGET_FILE,
      precedentPr: KOIOS_SCHEMA_PRECEDENT_PR,
    };

    await (options.sendEvent ?? sendSchemaDriftEvent)(eventData);
    return { emitted: true, endpoint: endpointKey, changes: changes.length };
  } catch (error) {
    logger.warn('[KoiosSchemaObserver] Failed to observe Koios response shape', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return { emitted: false, endpoint: endpointKey, changes: 0 };
  }
}
