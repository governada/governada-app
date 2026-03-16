/**
 * AI provider with BYOK support and provenance logging.
 *
 * Extends lib/ai.ts (which handles Anthropic client + model selection)
 * to support:
 * - BYOK: user-provided API keys from encrypted_api_keys table
 * - Provenance: every AI call logged to ai_activity_log
 * - Personal context: user's governance philosophy injected into prompts
 *
 * Usage:
 *   const ai = await createAIProvider({ userId: 'xxx' });
 *   const result = await ai.generateText('prompt', { system: '...' });
 *   // result includes provenance metadata
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { decryptApiKey } from '@/lib/ai/encryption';
import { logger } from '@/lib/logger';
import { MODELS } from '@/lib/ai';

type ModelKey = keyof typeof MODELS;

interface ProviderOptions {
  /** User ID for BYOK key lookup. If omitted, uses platform key. */
  userId?: string;
  /** Stake address for provenance logging */
  stakeAddress?: string;
}

interface GenerateOptions {
  model?: ModelKey;
  maxTokens?: number;
  temperature?: number;
  system?: string;
}

interface AIResult<T> {
  data: T | null;
  provenance: {
    model: string;
    keySource: 'platform' | 'byok';
    tokensUsed?: number;
  };
}

interface AIProvider {
  generateText: (prompt: string, options?: GenerateOptions) => Promise<AIResult<string>>;
  generateJSON: <T = unknown>(prompt: string, options?: GenerateOptions) => Promise<AIResult<T>>;
  keySource: 'platform' | 'byok';
  /** Log a skill invocation to provenance */
  logActivity: (params: {
    skillName: string;
    proposalTxHash?: string;
    proposalIndex?: number;
    draftId?: string;
    inputSummary?: string;
  }) => Promise<void>;
}

/**
 * Create an AI provider with optional BYOK support.
 */
export async function createAIProvider(options: ProviderOptions = {}): Promise<AIProvider> {
  let apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  let keySource: 'platform' | 'byok' = 'platform';

  // Check for BYOK key
  if (options.userId) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: keyRow } = await supabase
        .from('encrypted_api_keys')
        .select('encrypted_key')
        .eq('user_id', options.userId)
        .eq('provider', 'anthropic')
        .maybeSingle();

      if (keyRow?.encrypted_key) {
        apiKey = decryptApiKey(keyRow.encrypted_key);
        keySource = 'byok';
      }
    } catch (err) {
      logger.error('[AI Provider] Failed to fetch BYOK key, falling back to platform', {
        error: err,
      });
    }
  }

  // Create Anthropic client with the resolved key
  let client: {
    messages: {
      create: (params: {
        model: string;
        max_tokens: number;
        temperature?: number;
        system?: string;
        messages: Array<{ role: string; content: string }>;
      }) => Promise<{
        content: Array<{ type: string; text?: string }>;
        usage?: { output_tokens?: number };
      }>;
    };
  } | null = null;

  if (apiKey) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey }) as unknown as typeof client;
  }

  async function callAI(
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<{ text: string | null; tokensUsed?: number }> {
    if (!client) return { text: null };

    const model = MODELS[opts.model ?? 'FAST'];
    try {
      const message = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      });

      const block = message.content[0];
      const text = block?.type === 'text' ? (block.text ?? null) : null;
      return { text, tokensUsed: message.usage?.output_tokens };
    } catch (err) {
      logger.error('[AI Provider] Generation error', { error: err, keySource });
      return { text: null };
    }
  }

  const generateText = async (
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<AIResult<string>> => {
    const { text, tokensUsed } = await callAI(prompt, opts);
    return {
      data: text,
      provenance: { model: MODELS[opts.model ?? 'FAST'], keySource, tokensUsed },
    };
  };

  const generateJSON = async <T = unknown>(
    prompt: string,
    opts: GenerateOptions = {},
  ): Promise<AIResult<T>> => {
    const { text, tokensUsed } = await callAI(prompt, opts);
    if (!text)
      return {
        data: null,
        provenance: { model: MODELS[opts.model ?? 'FAST'], keySource, tokensUsed },
      };

    try {
      const cleaned = text
        .replace(/^```json\s*/, '')
        .replace(/\s*```$/, '')
        .trim();
      return {
        data: JSON.parse(cleaned) as T,
        provenance: { model: MODELS[opts.model ?? 'FAST'], keySource, tokensUsed },
      };
    } catch {
      logger.error('[AI Provider] Failed to parse JSON response');
      return {
        data: null,
        provenance: { model: MODELS[opts.model ?? 'FAST'], keySource, tokensUsed },
      };
    }
  };

  const logActivity = async (params: {
    skillName: string;
    proposalTxHash?: string;
    proposalIndex?: number;
    draftId?: string;
    inputSummary?: string;
  }) => {
    try {
      const supabase = getSupabaseAdmin();
      await supabase.from('ai_activity_log').insert({
        user_id: options.userId ?? null,
        stake_address: options.stakeAddress ?? null,
        skill_name: params.skillName,
        proposal_tx_hash: params.proposalTxHash ?? null,
        proposal_index: params.proposalIndex ?? null,
        draft_id: params.draftId ?? null,
        model_used: MODELS.FAST,
        key_source: keySource,
        input_summary: params.inputSummary?.slice(0, 200) ?? null,
      });
    } catch (err) {
      logger.error('[AI Provider] Failed to log activity', { error: err });
    }
  };

  return { generateText, generateJSON, keySource, logActivity };
}
