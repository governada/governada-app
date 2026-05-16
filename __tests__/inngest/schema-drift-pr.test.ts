import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hashSchemaDrift,
  hashShape,
  inferKoiosShape,
  type SchemaDriftEventData,
} from '@/lib/koios/schemaObserver';

const createFunctionMock = vi.hoisted(() => vi.fn());
const openSchemaDriftPullRequestMock = vi.hoisted(() => vi.fn());
const alertCriticalMock = vi.hoisted(() => vi.fn());
const alertDiscordMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/inngest', () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

vi.mock('@/lib/koios/schemaDriftPr', () => ({
  openSchemaDriftPullRequest: openSchemaDriftPullRequestMock,
}));

vi.mock('@/lib/sync-utils', () => ({
  alertCritical: alertCriticalMock,
  alertDiscord: alertDiscordMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function makeEventData(): SchemaDriftEventData {
  const observedShape = inferKoiosShape([{ new_koios_field: 'surprise' }]).shape;
  const changes: SchemaDriftEventData['changes'] = [
    {
      kind: 'novel_field',
      path: '[].new_koios_field',
      knownTypes: [],
      observedTypes: ['string'],
      observedSample: 'surprise',
      suggestedZod: 'z.string().optional()',
    },
  ];
  return {
    endpoint: 'drep_info',
    rawEndpoint: '/drep_info',
    observedAt: '2026-05-16T04:05:00.000Z',
    knownShapeHash: 'known-shape-hash',
    observedShapeHash: hashShape(observedShape),
    driftFingerprint: hashSchemaDrift('drep_info', changes),
    observedShape,
    targetFile: 'utils/koios-schemas.ts',
    precedentPr: 'https://github.com/governada/app/pull/664',
    changes,
  };
}

describe('schemaDriftPr Inngest function', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    createFunctionMock.mockImplementation((config, handler) => ({ config, handler }));
    openSchemaDriftPullRequestMock.mockResolvedValue({
      status: 'opened',
      branch: 'feat/schema-drift-drep-info-test',
      url: 'https://github.com/governada/app/pull/6641',
      body: 'body',
    });
  });

  it('registers the schema drift event trigger with debounce and concurrency controls', async () => {
    const { schemaDriftPr } = await import('@/inngest/functions/schema-drift-pr');
    const fn = schemaDriftPr as unknown as { config: Record<string, unknown> };

    expect(fn.config).toEqual(
      expect.objectContaining({
        id: 'schema-drift-pr',
        triggers: { event: 'drepscore/schema-drift.detected' },
        concurrency: { limit: 1, scope: 'env', key: '"schema-drift-pr"' },
        debounce: {
          key: 'event.data.driftFingerprint',
          period: '5m',
        },
      }),
    );
  });

  it('is imported and registered in the Inngest route', () => {
    const route = readFileSync(join(process.cwd(), 'app/api/inngest/route.ts'), 'utf8');

    expect(route).toContain("import { schemaDriftPr } from '@/inngest/functions/schema-drift-pr'");
    expect(route).toContain('schemaDriftPr,');
  });

  it('opens a schema drift PR from a manual event trigger', async () => {
    const { schemaDriftPr } = await import('@/inngest/functions/schema-drift-pr');
    const fn = schemaDriftPr as unknown as {
      handler: (input: {
        event: { data: SchemaDriftEventData };
        step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
      }) => Promise<unknown>;
    };
    const step = {
      run: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
    };
    const data = makeEventData();

    const result = await fn.handler({ event: { data }, step });

    expect(openSchemaDriftPullRequestMock).toHaveBeenCalledWith(data);
    expect(step.run).toHaveBeenCalledWith('open-schema-drift-pr', expect.any(Function));
    expect(result).toEqual(
      expect.objectContaining({
        endpoint: 'drep_info',
        status: 'opened',
        branch: 'feat/schema-drift-drep-info-test',
        observedShapeHash: data.observedShapeHash,
        changes: 1,
      }),
    );
    expect(alertDiscordMock).toHaveBeenCalledWith(
      'Koios schema drift detected: drep_info',
      expect.stringContaining('Draft PR: https://github.com/governada/app/pull/6641'),
    );
  });
});
