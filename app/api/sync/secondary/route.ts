import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, errMsg } from '@/lib/sync-utils';
import { executeSecondarySync } from '@/lib/sync/secondary';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request);
  if (authError) return authError;

  try {
    const result = await executeSecondarySync();
    return NextResponse.json(result);
  } catch (err) {
    const errorMsg = errMsg(err);
    return NextResponse.json({
      success: false,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    }, { status: 207 });
  }
}
