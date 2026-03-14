import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { submitBriefFeedback } from '@/lib/proposalBrief';
import { captureServerEvent } from '@/lib/posthog-server';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (request, context) => {
    const body = await request.json();
    const { briefId, helpful } = body;

    if (!briefId || typeof helpful !== 'boolean') {
      return NextResponse.json({ error: 'Missing briefId or helpful' }, { status: 400 });
    }

    if (!context.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const success = await submitBriefFeedback(briefId, context.userId, helpful);

    if (!success) {
      return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
    }

    captureServerEvent(
      'proposal_brief_feedback_submitted',
      { brief_id: briefId, helpful },
      context.userId,
    );

    return NextResponse.json({ success: true });
  },
  {
    auth: 'required',
    rateLimit: { max: 20, window: 60 },
  },
);
