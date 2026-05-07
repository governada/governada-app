import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getAnthropicClient, MODELS } from '@/lib/ai';
import { cached } from '@/lib/redis';
import { getValidatedSessionFromCookies } from '@/lib/navigation/session';
import {
  derivePersonaFromSession,
  type ResolvedSessionPersona,
} from '@/lib/governance/derivePersonaFromSession';
import {
  buildRegionSuggestionContext,
  type RegionSuggestionContext,
} from '@/lib/seneca/regionSuggestion';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SECONDS = 60;
const PROMPT_PATH = join(process.cwd(), 'lib/seneca/prompts/regionSuggestion.md');

const bodySchema = z.object({
  clusterId: z.string().min(1),
  userContextRef: z.string().min(1).optional().nullable(),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = bodySchema.parse(await request.json());
    const session = await getValidatedSessionFromCookies();
    const persona = await derivePersonaSafe(session);
    const userId = session?.userId ?? null;
    const cacheUserKey = userId ?? 'anonymous';
    const cacheKey = `seneca:region-suggestion:${body.clusterId}:${cacheUserKey}`;

    const payload = await cached(cacheKey, CACHE_TTL_SECONDS, async () => {
      const context = await buildRegionSuggestionContext({
        clusterId: body.clusterId,
        persona,
        userId,
      });
      const suggestion = await generateRegionSuggestion(context);

      return {
        suggestion,
        windowDays: context.cluster.treasuryBehavior?.windowDays ?? null,
      };
    });

    return NextResponse.json(payload);
  },
  {
    auth: 'optional',
    rateLimit: {
      max: 10,
      window: 60,
    },
  },
);

async function derivePersonaSafe(
  session: Awaited<ReturnType<typeof getValidatedSessionFromCookies>>,
): Promise<ResolvedSessionPersona> {
  if (!session) return { persona: 'anonymous' };

  try {
    return await derivePersonaFromSession(session);
  } catch {
    return session.walletAddress ? { persona: 'citizen' } : { persona: 'anonymous' };
  }
}

async function generateRegionSuggestion(context: RegionSuggestionContext): Promise<string> {
  const prompt = await readFile(PROMPT_PATH, 'utf8');
  const client = await getAnthropicClient();
  if (!client) return fallbackRegionSuggestion(context);

  try {
    const message = await client.messages.create({
      model: MODELS.HAIKU,
      max_tokens: 90,
      temperature: 0.2,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: JSON.stringify(context),
        },
      ],
    });

    const text = extractTextBlock(message);
    return normalizeSuggestion(text) ?? fallbackRegionSuggestion(context);
  } catch {
    return fallbackRegionSuggestion(context);
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

function normalizeSuggestion(text: string | null): string | null {
  if (!text) return null;
  const normalized = text
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length > 0 ? normalized : null;
}

function fallbackRegionSuggestion(context: RegionSuggestionContext): string {
  const treasury = context.cluster.treasuryBehavior;
  if (treasury) {
    const ada = formatAda(treasury.cumulativeApprovedAda);
    const windowLabel = formatTreasuryWindowLabel(treasury.windowDays);
    return `${context.cluster.nodeCount} DReps here approved ${ada} ADA in treasury withdrawals ${windowLabel}.`;
  }

  return `${context.cluster.nodeCount} DReps here share ${formatDimensionLabel(context.cluster.dominantAlignmentDimension)} as their strongest signal.`;
}

function formatTreasuryWindowLabel(
  windowDays: NonNullable<RegionSuggestionContext['cluster']['treasuryBehavior']>['windowDays'],
) {
  switch (windowDays) {
    case 30:
      return 'over the last epoch';
    case 90:
      return 'over the past quarter';
    case 180:
      return 'over the past six months';
    case 'all_time':
      return 'across their full record';
  }
}

function formatDimensionLabel(
  dimension: RegionSuggestionContext['cluster']['dominantAlignmentDimension'],
) {
  switch (dimension) {
    case 'treasury_conservative':
      return 'treasury conservatism';
    case 'treasury_growth':
      return 'treasury growth';
    case 'decentralization':
      return 'decentralization';
    case 'security':
      return 'security';
    case 'innovation':
      return 'innovation';
    case 'transparency':
      return 'transparency';
  }
}

function formatAda(amount: number): string {
  if (amount >= 1_000_000) return `${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return String(Math.round(amount));
}
