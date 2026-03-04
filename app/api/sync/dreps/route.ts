import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/sync-utils';
import { executeDrepsSync } from '@/lib/sync/dreps';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withRouteHandler(async (request) => {
  const authError = authorizeCron(request);
  if (authError) return authError;

  const result = await executeDrepsSync();
  return NextResponse.json(result, { status: (result.success as boolean) ? 200 : 207 });
});
