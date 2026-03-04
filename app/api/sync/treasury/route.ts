import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/sync-utils';
import { inngest } from '@/lib/inngest';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withRouteHandler(async (request) => {
  const authError = authorizeCron(request);
  if (authError) return authError;

  await inngest.send({ name: 'drepscore/sync.treasury' });
  return NextResponse.json({
    success: true,
    message: 'Treasury sync triggered via Inngest event',
  });
});
