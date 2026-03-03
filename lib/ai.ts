/**
 * Shared AI utility — centralizes Anthropic client instantiation,
 * model selection, and graceful error handling.
 *
 * Every AI feature in the app should use this module instead of
 * importing @anthropic-ai/sdk directly.
 */

export const MODELS = {
  /** Fast model for summaries, narratives, and explainers */
  FAST: 'claude-sonnet-4-5' as const,
  /** Draft model for longer-form generation (rationale drafts, briefs) */
  DRAFT: 'claude-sonnet-4-20250514' as const,
};

type ModelKey = keyof typeof MODELS;

interface GenerateOptions {
  model?: ModelKey;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

let _client: any = null;

async function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Generate text from a prompt. Returns null if AI is unavailable or fails,
 * so callers can fall back to template-based output.
 */
export async function generateText(
  prompt: string,
  options: GenerateOptions = {},
): Promise<string | null> {
  const client = await getClient();
  if (!client) return null;

  const model = MODELS[options.model ?? 'FAST'];
  try {
    const message = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      ...(options.temperature != null ? { temperature: options.temperature } : {}),
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content[0];
    if (block?.type === 'text') {
      return block.text;
    }
    return null;
  } catch (err) {
    console.error('[AI] generateText error:', err);
    return null;
  }
}

/**
 * Generate structured JSON from a prompt. Parses the response and returns
 * null if AI is unavailable, fails, or returns unparseable output.
 */
export async function generateJSON<T = unknown>(
  prompt: string,
  options: GenerateOptions = {},
): Promise<T | null> {
  const text = await generateText(prompt, options);
  if (!text) return null;

  try {
    const cleaned = text
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned) as T;
  } catch {
    console.error('[AI] Failed to parse JSON response');
    return null;
  }
}
