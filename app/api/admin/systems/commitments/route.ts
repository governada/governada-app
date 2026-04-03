import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { isAdminWallet } from '@/lib/adminAuth';
import { logAdminAction } from '@/lib/adminAudit';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { updateSystemsCommitmentSchema } from '@/lib/admin/systemsReview';

export const dynamic = 'force-dynamic';

export const PATCH = withRouteHandler(
  async (request: NextRequest, ctx: RouteContext) => {
    if (!isAdminWallet(ctx.wallet!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = updateSystemsCommitmentSchema.parse(await request.json());
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('systems_commitments')
      .update({
        status: body.status,
        completed_at: body.status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', body.id)
      .select('id, status')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to update systems commitment' }, { status: 500 });
    }

    await logAdminAction(ctx.wallet!, 'update_systems_commitment', body.id, {
      status: body.status,
    });

    return NextResponse.json(data);
  },
  { auth: 'required', rateLimit: { max: 30, window: 60 } },
);
