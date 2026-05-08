import { logSenecaOutput, type SenecaOutputLogger } from '@/lib/seneca/outputLog';

export type SenecaIntent = 'observational' | 'interrogative' | 'mechanical';

export interface MechanicalAnswer {
  question: string;
  answer: string;
}

export const MECHANICAL_ANSWERS = [
  {
    question: 'How do I zoom?',
    answer:
      'Scroll or pinch to move closer to the constellation. Use the reset control when you want the whole field back.',
  },
  {
    question: 'What do the colors mean?',
    answer:
      'Colors group representatives and governance objects by identity, emphasis, or the active view. Treat color as context, not a score.',
  },
  {
    question: "What's a DRep?",
    answer:
      'A DRep is a delegated representative in Cardano governance. ADA holders can delegate voting power to one, and that representative votes on proposals on their behalf.',
  },
  {
    question: 'What is delegation?',
    answer:
      'Delegation lets your stake carry governance weight without moving your ADA. You choose a representative; they vote with the voting power you delegate.',
  },
  {
    question: 'Why is this DRep dimmed?',
    answer:
      'Dimmed representatives have less current relevance to the view you are in: lower activity, weaker match, or outside the selected topic. The record is still there; the scene is lowering its emphasis.',
  },
  {
    question: 'What is a Tier 0 event?',
    answer:
      'A Tier 0 event is a governance change important enough to take over the homepage briefing, such as a ratified constitution change, hard fork, no-confidence result, or major treasury withdrawal.',
  },
  {
    question: 'How does Seneca decide what to show me?',
    answer:
      'Seneca follows the homepage prioritization engine: Tier 0 civic events first, then direct actions and meaningful personal changes, then quieter return states. The panel shows the highest-priority state and keeps lower-priority items available.',
  },
  {
    question: "What does the constellation's shape mean?",
    answer:
      'Position reflects governance behavior: what representatives prioritize, where they align, and how proposals or votes relate. Nearby does not mean identical; it means the record has something in common.',
  },
  {
    question: 'How do I see only DReps near me?',
    answer:
      'Use the representative filter, then choose "Find someone who fits my views" when you want Seneca to narrow the field around your values.',
  },
  {
    question: 'What is sentiment voting?',
    answer:
      'Sentiment voting lets citizens signal where they stand before representatives cast formal votes. It does not move ADA or submit an on-chain vote; it gives DReps a readable mandate.',
  },
] as const satisfies readonly MechanicalAnswer[];

const NORMALIZED_ANSWERS = new Map(
  MECHANICAL_ANSWERS.map((entry) => [normalizeQuestion(entry.question), entry.answer]),
);

const MECHANICAL_PATTERNS = [
  /^\s*how\s+do\s+i\b/i,
  /^\s*how\s+can\s+i\b/i,
  /^\s*how\s+does\s+seneca\s+decide\b/i,
  /^\s*what\s+(?:does|do)\s+.+\s+mean\??\s*$/i,
  /^\s*what(?:'s|\s+is)\s+(?:a\s+|an\s+|the\s+)?(?:drep|delegation|tier\s*0\s+event|sentiment\s+voting)\??\s*$/i,
  /^\s*why\s+is\s+this\s+drep\s+dimmed\??\s*$/i,
];

const INTERROGATIVE_PATTERNS = [
  /^\s*show\s+me\b/i,
  /^\s*find\s+(?:me\s+)?(?:someone|a\s+drep|a\s+representative|who)\b/i,
  /^\s*who\s+(?:should|fits|aligns|is|are)\b/i,
  /\bfind\s+someone\s+who\s+fits\b/i,
  /\bmost\s+active\b/i,
];

export function classifyIntent(userInput: string): SenecaIntent {
  const input = userInput.trim();
  if (!input) return 'observational';

  if (MECHANICAL_PATTERNS.some((pattern) => pattern.test(input))) {
    return 'mechanical';
  }

  if (INTERROGATIVE_PATTERNS.some((pattern) => pattern.test(input))) {
    return 'interrogative';
  }

  return 'observational';
}

export function getMechanicalAnswer(userInput: string): string | null {
  const normalized = normalizeQuestion(userInput);
  const exact = NORMALIZED_ANSWERS.get(normalized);
  if (exact) return exact;

  if (/^\s*what(?:'s|\s+is)\s+a?\s*drep\b/i.test(userInput)) {
    return NORMALIZED_ANSWERS.get(normalizeQuestion("What's a DRep?")) ?? null;
  }

  if (/^\s*what(?:'s|\s+is)\s+(?:a\s+)?tier\s*0\b/i.test(userInput)) {
    return NORMALIZED_ANSWERS.get(normalizeQuestion('What is a Tier 0 event?')) ?? null;
  }

  return null;
}

export async function logMechanicalAnswerOutput(
  userInput: string,
  answer: string,
  {
    userContextIdentifier,
    logger = logSenecaOutput,
  }: {
    userContextIdentifier?: string | null;
    logger?: SenecaOutputLogger;
  } = {},
): Promise<void> {
  await logger({
    intent: 'mechanical',
    outputText: answer,
    source: 'mechanical_answer',
    userContextIdentifier,
  });
}

export async function logSenecaIntentOutput({
  intent,
  outputText,
  userContextIdentifier,
  logger = logSenecaOutput,
}: {
  intent: Exclude<SenecaIntent, 'mechanical'>;
  outputText: string;
  userContextIdentifier?: string | null;
  logger?: SenecaOutputLogger;
}): Promise<void> {
  await logger({
    intent,
    outputText,
    source: 'observation_emitted',
    userContextIdentifier,
  });
}

function normalizeQuestion(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’]/gu, "'")
    .replace(/[?.!]+$/u, '')
    .replace(/\s+/gu, ' ');
}
