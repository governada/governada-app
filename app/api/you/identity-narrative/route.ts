import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { generateText } from '@/lib/ai';
import { cached } from '@/lib/redis';
import { buildNarrativePrompt } from '@/lib/identity/narrativePrompt';

export const dynamic = 'force-dynamic';

interface NarrativeRequestBody {
  archetype: string | null;
  drepName: string | null;
  delegationAgeDays: number | null;
  participationTier: string;
  pulse: number;
  pulseLabel: string;
  delegationRing: number;
  coverageRing: number;
  engagementRing: number;
  milestonesEarned: number;
  proposalsInfluenced: number;
}

export const POST = withRouteHandler(
  async (request: NextRequest, { userId }: RouteContext) => {
    const body = (await request.json()) as NarrativeRequestBody;

    // Cache key includes userId + pulse (changes when governance state changes meaningfully)
    const cacheKey = `identity-narrative:${userId}:${body.pulse}`;
    const EPOCH_TTL = 5 * 24 * 60 * 60; // 5 days (1 Cardano epoch)

    const narrative = await cached(cacheKey, EPOCH_TTL, async () => {
      const prompt = buildNarrativePrompt(body);
      const result = await generateText(prompt, {
        model: 'FAST',
        maxTokens: 256,
        temperature: 0.7,
      });
      return result;
    });

    if (!narrative) {
      return NextResponse.json({ narrative: null }, { status: 200 });
    }

    return NextResponse.json({ narrative });
  },
  { auth: 'required' },
);
