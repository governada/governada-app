import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, errMsg } from '@/lib/sync-utils';
import { executeDrepsSync } from '@/lib/sync/dreps';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request);
  if (authError) return authError;

  try {
    const result = await executeDrepsSync();
    return NextResponse.json(result, { status: (result.success as boolean) ? 200 : 207 });
  } catch (err) {
    return NextResponse.json({ success: false, error: errMsg(err) }, { status: 500 });
  }
}
