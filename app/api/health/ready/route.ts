import { NextResponse } from 'next/server';
import { getRuntimeRelease } from '@/lib/runtimeMetadata';

export const dynamic = 'force-dynamic';

/**
 * Lightweight readiness probe for Railway health checks.
 *
 * Only verifies the Next.js server can handle requests.
 * Does NOT call external services (Koios, Redis) — those are
 * checked by /api/health/deep for monitoring, not deploy gating.
 */
export function GET() {
  return NextResponse.json({ status: 'ok', release: getRuntimeRelease() }, { status: 200 });
}
