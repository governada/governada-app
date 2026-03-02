import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, errMsg } from '@/lib/sync-utils';
import { executeSlowSync } from '@/lib/sync/slow';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authErr = authorizeCron(request);
  if (authErr) return authErr;

  try {
    const result = await executeSlowSync();
    return NextResponse.json(result, { status: (result.success as boolean) ? 200 : 207 });
  } catch (err) {
    return NextResponse.json({ success: false, error: errMsg(err) }, { status: 500 });
  }
}
