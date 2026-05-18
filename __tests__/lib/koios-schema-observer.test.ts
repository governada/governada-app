import { describe, expect, it, vi } from 'vitest';
import {
  findSchemaDrift,
  getKoiosSchemaEndpointKey,
  hashShape,
  inferKoiosShape,
  INSTRUMENTED_KOIOS_ENDPOINT_KEYS,
  recordKoiosSchema,
  type KnownKoiosShapesFile,
  type SchemaDriftEventData,
} from '@/lib/koios/schemaObserver';
import knownShapesJson from '@/lib/koios/knownShapes.json';

vi.mock('@/lib/inngest', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

function knownShapesFor(endpoint: 'drep_info', response: unknown): KnownKoiosShapesFile {
  const { shape } = inferKoiosShape(response);
  return {
    version: 1,
    generatedAt: '2026-05-16T04:00:00.000Z',
    source: 'test',
    endpoints: {
      [endpoint]: {
        endpoint,
        observedAt: '2026-05-16T04:00:00.000Z',
        shapeHash: hashShape(shape),
        shape,
      },
    },
  };
}

describe('Koios schema observer', () => {
  it('hashes nested arrays, nullables, and object keys deterministically', () => {
    const left = inferKoiosShape([
      {
        b: null,
        a: {
          nested: [1, null],
        },
      },
    ]).shape;
    const right = inferKoiosShape([
      {
        a: {
          nested: [null, 1],
        },
        b: null,
      },
    ]).shape;

    expect(hashShape(left)).toBe(hashShape(right));
  });

  it('does not emit for a known shape', async () => {
    const response = [{ drep_id: 'drep1', amount: '10', meta_json: null }];
    const sendEvent = vi.fn(async (_data: SchemaDriftEventData) => null);

    const result = await recordKoiosSchema(response, '/drep_info', {
      knownShapes: knownShapesFor('drep_info', response),
      sendEvent,
    });

    expect(result).toEqual({ emitted: false, endpoint: 'drep_info', changes: 0 });
    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('emits a schema drift event with sample value and suggested Zod for a novel field', async () => {
    const knownResponse = [{ drep_id: 'drep1', amount: '10', meta_json: null }];
    const observedResponse = [
      { drep_id: 'drep1', amount: '10', meta_json: null, new_koios_field: 'surprise' },
    ];
    const sendEvent = vi.fn(async (_data: SchemaDriftEventData) => null);

    const result = await recordKoiosSchema(observedResponse, '/drep_info', {
      knownShapes: knownShapesFor('drep_info', knownResponse),
      now: () => new Date('2026-05-16T04:05:00.000Z'),
      sendEvent,
    });

    expect(result).toEqual({ emitted: true, endpoint: 'drep_info', changes: 1 });
    expect(sendEvent).toHaveBeenCalledTimes(1);
    expect(sendEvent.mock.calls[0][0]).toMatchObject({
      endpoint: 'drep_info',
      rawEndpoint: '/drep_info',
      observedAt: '2026-05-16T04:05:00.000Z',
      targetFile: 'utils/koios-schemas.ts',
      driftFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
      changes: [
        expect.objectContaining({
          kind: 'novel_field',
          path: '[].new_koios_field',
          observedTypes: ['string'],
          observedSample: 'surprise',
          suggestedZod: 'z.string().optional()',
        }),
      ],
    });
  });

  it('keeps the same drift fingerprint when only surrounding response shape changes', async () => {
    const knownResponse = [{ drep_id: 'drep1', amount: '10', meta_json: { nested: true } }];
    const sendEvent = vi.fn(async (_data: SchemaDriftEventData) => null);
    const knownShapes = knownShapesFor('drep_info', knownResponse);

    await recordKoiosSchema(
      [{ drep_id: 'drep1', amount: '10', new_koios_field: 'surprise' }],
      '/drep_info',
      { knownShapes, sendEvent },
    );
    await recordKoiosSchema(
      [{ drep_id: 'drep1', amount: '10', meta_json: { nested: true }, new_koios_field: 'later' }],
      '/drep_info',
      { knownShapes, sendEvent },
    );

    expect(sendEvent.mock.calls[0][0].observedShapeHash).not.toBe(
      sendEvent.mock.calls[1][0].observedShapeHash,
    );
    expect(sendEvent.mock.calls[0][0].driftFingerprint).toBe(
      sendEvent.mock.calls[1][0].driftFingerprint,
    );
  });

  it('flags type drift without treating missing fields in partial Koios selects as drift', () => {
    const known = inferKoiosShape([{ stake_address: 'stake1...', amount: '10' }]);
    const observed = inferKoiosShape([{ stake_address: 'stake1...', amount: 10 }]);

    expect(findSchemaDrift(known.shape, observed.shape, observed.samples)).toEqual([
      expect.objectContaining({
        kind: 'type_change',
        path: '[].amount',
        knownTypes: ['string'],
        observedTypes: ['number'],
        suggestedZod: 'z.number().optional()',
      }),
    ]);
  });

  it('normalizes vote_list variants into separately tracked endpoint keys', () => {
    expect(getKoiosSchemaEndpointKey('/vote_list?voter_role=eq.DRep&limit=1')).toBe(
      'vote_list_drep',
    );
    expect(getKoiosSchemaEndpointKey('/vote_list?voter_role=eq.SPO&limit=1')).toBe('vote_list_spo');
    expect(
      getKoiosSchemaEndpointKey('/vote_list?voter_role=eq.ConstitutionalCommittee&limit=1'),
    ).toBe('vote_list_cc');
  });

  it('treats committed known shapes as non-drift baselines for the local soak substitute', () => {
    const knownShapes = knownShapesJson as KnownKoiosShapesFile;

    for (const endpoint of INSTRUMENTED_KOIOS_ENDPOINT_KEYS) {
      const known = knownShapes.endpoints[endpoint];

      expect(known, `${endpoint} should have a committed known shape`).toBeDefined();
      expect(findSchemaDrift(known!.shape, known!.shape, new Map())).toEqual([]);
    }
  });
});
