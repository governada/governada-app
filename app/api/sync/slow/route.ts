import { NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/sync-utils';
import { executeSlowSync } from '@/lib/sync/slow';
import { withRouteHandler } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export const GET = withRouteHandler(async (request) => {
  const authErr = authorizeCron(request);
  if (authErr) return authErr;

  const result = await executeSlowSync();
  return NextResponse.json(result, { status: (result.success as boolean) ? 200 : 207 });
});
