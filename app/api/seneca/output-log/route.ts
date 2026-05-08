import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { insertSenecaOutput } from '@/lib/seneca/outputLog';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  intent: z.enum(['observational', 'interrogative', 'mechanical']),
  outputText: z.string().min(1).max(4000),
  source: z.enum([
    'idle_briefing',
    'region_suggestion',
    'mechanical_answer',
    'observation_emitted',
    'evergreen_fallback',
  ]),
  userContextHash: z
    .string()
    .regex(/^[a-f0-9]{16}$/u)
    .nullable()
    .optional(),
  cinematicState: z.string().min(1).max(80).nullable().optional(),
});

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = bodySchema.parse(await request.json());
    const result = await insertSenecaOutput({
      intent: body.intent,
      outputText: body.outputText,
      source: body.source,
      userContextHash: body.userContextHash ?? null,
      cinematicState: body.cinematicState ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: 'output logging failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  },
  {
    auth: 'optional',
    rateLimit: {
      max: 60,
      window: 60,
    },
  },
);
