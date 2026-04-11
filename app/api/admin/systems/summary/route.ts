export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAdminWallet } from '@/lib/adminAuth';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { buildSystemsWorkspaceSummaryData } from '@/lib/admin/systemsDashboard';

export const GET = withRouteHandler(
  async (_request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(await buildSystemsWorkspaceSummaryData('launch'));
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
