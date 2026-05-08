import { describe, expect, it } from 'vitest';
import {
  allocateStratifiedSampleSize,
  sampleStratifiedOutputs,
  type SenecaOutputRecord,
} from '@/lib/seneca/eval/sampling';
import type { SenecaIntent } from '@/lib/seneca/eval/judge';

describe('Seneca eval sampling', () => {
  it('allocates a 50-output sample by observed intent ratio', () => {
    expect(
      allocateStratifiedSampleSize({ observational: 700, interrogative: 200, mechanical: 100 }, 50),
    ).toEqual({ observational: 35, interrogative: 10, mechanical: 5 });
  });

  it('samples approximately 35/10/5 from a 700/200/100 fixture', () => {
    const outputs = [
      ...makeOutputs('observational', 700),
      ...makeOutputs('interrogative', 200),
      ...makeOutputs('mechanical', 100),
    ];

    const sampled = sampleStratifiedOutputs(outputs, 50, () => 0.42);
    const counts = sampled.reduce(
      (acc, output) => {
        acc[output.intent] += 1;
        return acc;
      },
      { observational: 0, interrogative: 0, mechanical: 0 },
    );

    expect(counts.observational).toBeGreaterThanOrEqual(33);
    expect(counts.observational).toBeLessThanOrEqual(37);
    expect(counts.interrogative).toBeGreaterThanOrEqual(8);
    expect(counts.interrogative).toBeLessThanOrEqual(12);
    expect(counts.mechanical).toBeGreaterThanOrEqual(3);
    expect(counts.mechanical).toBeLessThanOrEqual(7);
  });
});

function makeOutputs(intent: SenecaIntent, count: number): SenecaOutputRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${intent}-${index}`,
    createdAt: '2026-05-07T00:00:00.000Z',
    intent,
    outputText: `${intent} output ${index}`,
    source: 'test',
    cinematicState: null,
  }));
}
