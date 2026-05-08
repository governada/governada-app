import type { SenecaIntent } from '@/lib/seneca/eval/judge';

export interface SenecaOutputRecord {
  id: string;
  createdAt: string;
  intent: SenecaIntent;
  outputText: string;
  source: string;
  cinematicState: string | null;
}

export type IntentCounts = Record<SenecaIntent, number>;

const INTENTS: readonly SenecaIntent[] = ['observational', 'interrogative', 'mechanical'];

export function getEmptyIntentCounts(): IntentCounts {
  return { observational: 0, interrogative: 0, mechanical: 0 };
}

export function countOutputsByIntent(outputs: readonly Pick<SenecaOutputRecord, 'intent'>[]) {
  const counts = getEmptyIntentCounts();
  for (const output of outputs) {
    counts[output.intent] += 1;
  }
  return counts;
}

export function allocateStratifiedSampleSize(
  counts: IntentCounts,
  sampleSize: number,
): IntentCounts {
  const total = INTENTS.reduce((sum, intent) => sum + counts[intent], 0);
  const allocation = getEmptyIntentCounts();
  if (total === 0 || sampleSize <= 0) return allocation;

  const cappedSampleSize = Math.min(sampleSize, total);
  const remainders = INTENTS.map((intent) => {
    const raw = (counts[intent] / total) * cappedSampleSize;
    const floor = Math.min(Math.floor(raw), counts[intent]);
    allocation[intent] = floor;
    return { intent, remainder: raw - floor };
  }).sort((a, b) => b.remainder - a.remainder);

  let remaining = cappedSampleSize - INTENTS.reduce((sum, intent) => sum + allocation[intent], 0);
  while (remaining > 0) {
    const target = remainders.find(({ intent }) => allocation[intent] < counts[intent]);
    if (!target) break;
    allocation[target.intent] += 1;
    remaining -= 1;
  }

  return allocation;
}

export function sampleStratifiedOutputs(
  outputs: readonly SenecaOutputRecord[],
  sampleSize: number,
  rng: () => number = Math.random,
): SenecaOutputRecord[] {
  const counts = countOutputsByIntent(outputs);
  const allocation = allocateStratifiedSampleSize(counts, sampleSize);
  const sampled: SenecaOutputRecord[] = [];

  for (const intent of INTENTS) {
    const bucket = outputs.filter((output) => output.intent === intent);
    sampled.push(...shuffle(bucket, rng).slice(0, allocation[intent]));
  }

  return sampled;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
