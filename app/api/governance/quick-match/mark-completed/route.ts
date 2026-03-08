/**
 * Marks the current user's profile as having completed the Quick Match quiz.
 * Called by the client after a successful quick match to enable
 * progressive confidence scoring.
 */

import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { markQuickMatchCompleted } from '@/lib/matching/userProfile';

export const dynamic = 'force-dynamic';

export const POST = withRouteHandler(
  async (_request, { userId }) => {
    await markQuickMatchCompleted(userId!);
    return NextResponse.json({ ok: true });
  },
  { auth: 'required' },
);
