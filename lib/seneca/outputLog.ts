import type { CinematicState } from '@/types/cinematic';

export type SenecaOutputIntent = 'observational' | 'interrogative' | 'mechanical';

export type SenecaOutputSource =
  | 'idle_briefing'
  | 'region_suggestion'
  | 'mechanical_answer'
  | 'observation_emitted'
  | 'evergreen_fallback';

export interface SenecaOutputLogInput {
  intent: SenecaOutputIntent;
  outputText: string;
  source: SenecaOutputSource;
  userContextIdentifier?: string | null;
  userContextHash?: string | null;
  cinematicState?: CinematicState | string | null;
}

export interface NormalizedSenecaOutputLog {
  intent: SenecaOutputIntent;
  outputText: string;
  source: SenecaOutputSource;
  userContextHash: string | null;
  cinematicState: string | null;
}

export interface SenecaOutputLogResult {
  ok: boolean;
  id?: string;
  skipped?: boolean;
  error?: string;
}

export type SenecaOutputLogger = (input: SenecaOutputLogInput) => Promise<SenecaOutputLogResult>;

export async function hashUserContextIdentifier(
  identifier: string | null | undefined,
): Promise<string | null> {
  const normalized = identifier?.trim();
  if (!normalized) return null;

  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

export async function normalizeSenecaOutputLog(
  input: SenecaOutputLogInput,
): Promise<NormalizedSenecaOutputLog | null> {
  const outputText = input.outputText.trim();
  if (!outputText) return null;
  const providedHash = input.userContextHash?.trim();

  return {
    intent: input.intent,
    outputText,
    source: input.source,
    userContextHash: providedHash || (await hashUserContextIdentifier(input.userContextIdentifier)),
    cinematicState: input.cinematicState?.trim() ?? null,
  };
}

export async function logSenecaOutput(input: SenecaOutputLogInput): Promise<SenecaOutputLogResult> {
  const normalized = await normalizeSenecaOutputLog(input);
  if (!normalized) return { ok: true, skipped: true };

  if (typeof window !== 'undefined') {
    return postSenecaOutputLog(normalized);
  }

  return insertSenecaOutput(normalized);
}

export async function insertSenecaOutput(
  input: NormalizedSenecaOutputLog,
): Promise<SenecaOutputLogResult> {
  try {
    const { getSupabaseAdmin } = await import('@/lib/supabase');
    const { data, error } = await getSupabaseAdmin()
      .from('seneca_outputs')
      .insert({
        intent: input.intent,
        output_text: input.outputText,
        user_context_hash: input.userContextHash,
        source: input.source,
        cinematic_state: input.cinematicState,
      })
      .select('id')
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, id: typeof data?.id === 'string' ? data.id : undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

async function postSenecaOutputLog(
  input: NormalizedSenecaOutputLog,
): Promise<SenecaOutputLogResult> {
  try {
    const response = await fetch('/api/seneca/output-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
      keepalive: true,
    });

    if (!response.ok) return { ok: false, error: `output log returned ${response.status}` };
    const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
    return { ok: true, id: typeof body?.id === 'string' ? body.id : undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown Seneca output logging error';
}
