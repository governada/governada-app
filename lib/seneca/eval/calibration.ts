import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { JudgeResult, SenecaIntent } from '@/lib/seneca/eval/judge';
import { judgeOutput } from '@/lib/seneca/eval/judge';

export interface CalibrationExample {
  title: string;
  output: string;
  intent: Exclude<SenecaIntent, 'mechanical'>;
  source: 'calibrationSet.observational.md' | 'calibrationSet.interrogative.md';
}

export interface CalibrationJudgeResult extends CalibrationExample {
  result: JudgeResult;
}

const OBSERVATIONAL_PATH = join(
  process.cwd(),
  'lib/seneca/prompts/calibrationSet.observational.md',
);
const INTERROGATIVE_PATH = join(
  process.cwd(),
  'lib/seneca/prompts/calibrationSet.interrogative.md',
);

export async function loadCalibrationExamples(): Promise<CalibrationExample[]> {
  const [observational, interrogative] = await Promise.all([
    readFile(OBSERVATIONAL_PATH, 'utf8'),
    readFile(INTERROGATIVE_PATH, 'utf8'),
  ]);

  return [
    ...parseCalibrationExamples(observational, 'observational', 'calibrationSet.observational.md'),
    ...parseCalibrationExamples(interrogative, 'interrogative', 'calibrationSet.interrogative.md'),
  ];
}

export function parseCalibrationExamples(
  markdown: string,
  intent: CalibrationExample['intent'],
  source: CalibrationExample['source'],
): CalibrationExample[] {
  const examples: CalibrationExample[] = [];
  let title: string | null = null;
  let quoteLines: string[] = [];

  function flush() {
    if (title && quoteLines.length > 0) {
      examples.push({
        title,
        output: quoteLines.join(' ').replace(/\s+/gu, ' ').trim(),
        intent,
        source,
      });
    }
    quoteLines = [];
  }

  for (const line of markdown.split(/\r?\n/u)) {
    if (line.startsWith('## ')) {
      flush();
      title = line.replace(/^##\s+/u, '').trim();
      continue;
    }

    if (line.startsWith('> ')) {
      quoteLines.push(line.replace(/^>\s?/u, '').trim());
    }
  }

  flush();
  return examples;
}

export async function runCalibrationSelfTest(
  judge: (output: string, intent: SenecaIntent) => Promise<JudgeResult> = judgeOutput,
): Promise<CalibrationJudgeResult[]> {
  const examples = await loadCalibrationExamples();
  const results: CalibrationJudgeResult[] = [];

  for (const example of examples) {
    results.push({
      ...example,
      result: await judge(example.output, example.intent),
    });
  }

  return results;
}
