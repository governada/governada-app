import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron, errMsg } from '@/lib/sync-utils';
import { inngest } from '@/lib/inngest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authError = authorizeCron(request);
  if (authError) return authError;

  try {
    await inngest.send({ name: 'drepscore/sync.treasury' });
    return NextResponse.json({ success: true, message: 'Treasury sync triggered via Inngest event' });
  } catch (err) {
    return NextResponse.json({ success: false, error: errMsg(err) }, { status: 500 });
  }
}
