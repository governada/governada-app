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

function resolveIdentifier(
  body: z.infer<typeof AcknowledgmentRequestSchema>,
  context: RouteContext,
): string | null {
  return body.userIdOrStakeAddress ?? body.stakeAddress ?? context.userId ?? null;
}

export const POST = withRouteHandler(
  async (request: NextRequest, context: RouteContext) => {
    const body = AcknowledgmentRequestSchema.parse(await request.json());
    const userIdOrStakeAddress = resolveIdentifier(body, context);

    if (!userIdOrStakeAddress) {
      return NextResponse.json({ error: 'Missing user or stake address' }, { status: 400 });
    }

    const record =
      body.action === 'acknowledge'
        ? await acknowledgeItem({ userIdOrStakeAddress, itemId: body.itemId })
        : await dismissItem({ userIdOrStakeAddress, itemId: body.itemId });

    return NextResponse.json({ ok: true, item: record });
  },
  { auth: 'optional', rateLimit: { max: 60, window: 60 } },
);
