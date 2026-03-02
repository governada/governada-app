import { NextRequest, NextResponse } from 'next/server';
import { getAllFlags, setFeatureFlag, invalidateFlagCache } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allFlags = await getAllFlags();
    const flags: Record<string, boolean> = {};
    for (const f of allFlags) {
      flags[f.key] = f.enabled;
    }
    return NextResponse.json({ flags, details: allFlags }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load flags' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, enabled } = body;

    if (typeof key !== 'string' || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid body: { key: string, enabled: boolean }' }, { status: 400 });
    }

    const success = await setFeatureFlag(key, enabled);
    if (!success) {
      return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
    }

    invalidateFlagCache();

    return NextResponse.json({ key, enabled });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
