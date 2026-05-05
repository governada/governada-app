export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getDelegationMode } from '@/lib/delegation/mode';

export function GET() {
  const mode = getDelegationMode();
  return NextResponse.json({ mode, sandbox: mode === 'sandbox' });
}
