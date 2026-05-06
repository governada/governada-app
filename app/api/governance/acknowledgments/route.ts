import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { acknowledgeItem, dismissItem } from '@/lib/governance/acknowledgments';

export const dynamic = 'force-dynamic';

const AcknowledgmentRequestSchema = z.object({
  action: z.enum(['acknowledge', 'dismiss']),
  itemId: z.string().min(1),
  userIdOrStakeAddress: z.string().min(1).optional(),
  stakeAddress: z.string().min(1).optional(),
});

interface IdentifierResolution {
  identifier?: string;
  error?: NextResponse;
}

function resolveIdentifier(
  body: z.infer<typeof AcknowledgmentRequestSchema>,
  context: RouteContext,
): IdentifierResolution {
  const verifiedIdentifiers = new Set([context.userId, context.wallet].filter(Boolean));

  if (body.stakeAddress && body.stakeAddress !== context.wallet) {
    return {
      error: NextResponse.json(
        { error: 'Stake address does not match authenticated wallet' },
        { status: 403 },
      ),
    };
  }

  if (body.userIdOrStakeAddress && !verifiedIdentifiers.has(body.userIdOrStakeAddress)) {
    return {
      error: NextResponse.json(
        { error: 'Identifier does not match authenticated user' },
        { status: 403 },
      ),
    };
  }

  return {
    identifier: body.stakeAddress ?? body.userIdOrStakeAddress ?? context.wallet ?? context.userId,
  };
}

export const POST = withRouteHandler(
  async (request: NextRequest, context: RouteContext) => {
    const body = AcknowledgmentRequestSchema.parse(await request.json());
    const { identifier: userIdOrStakeAddress, error } = resolveIdentifier(body, context);

    if (error) return error;

    if (!userIdOrStakeAddress) {
      return NextResponse.json({ error: 'Missing authenticated user' }, { status: 400 });
    }

    const record =
      body.action === 'acknowledge'
        ? await acknowledgeItem({ userIdOrStakeAddress, itemId: body.itemId })
        : await dismissItem({ userIdOrStakeAddress, itemId: body.itemId });

    return NextResponse.json({ ok: true, item: record });
  },
  { auth: 'required', rateLimit: { max: 60, window: 60 } },
);
