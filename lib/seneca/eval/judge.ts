import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getAnthropicClient, MODELS } from '@/lib/ai';

export type SenecaIntent = 'observational' | 'interrogative' | 'mechanical';

export interface JudgeResult {
  referencesData: boolean;
  literaryWordEarnsKeep: boolean;
  couldColumnistWrite: boolean;
  score: 0 | 1 | 2 | 3;
  reasoning: string;
}

interface RawJudgeResponse {
  referencesData?: unknown;
  literaryWordEarnsKeep?: unknown;
  couldColumnistWrite?: unknown;
  reasoning?: unknown;
}

const OBSERVATIONAL_PROMPT_PATH = join(
  process.cwd(),
  'lib/seneca/prompts/evalJudge.observational.md',
);
const MECHANICAL_PROMPT_PATH = join(process.cwd(), 'lib/seneca/prompts/evalJudge.mechanical.md');

const JUDGE_FAILURE: JudgeResult = {
  referencesData: false,
  literaryWordEarnsKeep: false,
  couldColumnistWrite: false,
  score: 0,
  reasoning: 'judge failure',
};

export async function judgeOutput(output: string, intent: SenecaIntent): Promise<JudgeResult> {
  const client = await getAnthropicClient();
  if (!client) return JUDGE_FAILURE;

  try {
    const system = await loadJudgePrompt(intent);
    const message: unknown = await client.messages.create({
      model: MODELS.FAST,
      max_tokens: 220,
      temperature: 0,
      system,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            intent,
            output,
          }),
        },
      ],
    });

    return parseJudgeResult(extractTextBlock(message));
  } catch {
    return JUDGE_FAILURE;
  }
}

export async function loadJudgePrompt(intent: SenecaIntent): Promise<string> {
  const path = intent === 'mechanical' ? MECHANICAL_PROMPT_PATH : OBSERVATIONAL_PROMPT_PATH;
  return readFile(path, 'utf8');
}

export function parseJudgeResult(text: string | null): JudgeResult {
  if (!text) return JUDGE_FAILURE;

  try {
    const parsed = JSON.parse(stripJsonFence(text)) as RawJudgeResponse;
    const referencesData = parsed.referencesData === true;
    const literaryWordEarnsKeep = parsed.literaryWordEarnsKeep === true;
    const couldColumnistWrite = parsed.couldColumnistWrite === true;
    const score = toScore(
      Number(referencesData) + Number(literaryWordEarnsKeep) + Number(couldColumnistWrite),
    );
    const reasoning =
      typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
        ? parsed.reasoning.trim()
        : 'No reasoning returned.';

    return {
      referencesData,
      literaryWordEarnsKeep,
      couldColumnistWrite,
      score,
      reasoning,
    };
  } catch {
    return JUDGE_FAILURE;
  }
}

function extractTextBlock(message: unknown): string | null {
  if (!message || typeof message !== 'object' || !('content' in message)) return null;
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return null;

  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type === 'text' && typeof candidate.text === 'string') return candidate.text;
  }
  return null;
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/iu, '')
    .replace(/^```\s*/u, '')
    .replace(/\s*```$/u, '')
    .trim();
}

function toScore(value: number): 0 | 1 | 2 | 3 {
  if (value <= 0) return 0;
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 3;
}
