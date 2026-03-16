import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';
import { isAdminWallet } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// List all assemblies for admin review
export const GET = withRouteHandler(
  async (_request: NextRequest, { wallet }: RouteContext) => {
    const supabase = getSupabaseAdmin();

    // Verify admin via ADMIN_WALLETS env var
    if (!wallet || !isAdminWallet(wallet)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data: assemblies, error } = await supabase
      .from('citizen_assemblies')
      .select('*')
      .in('status', ['draft', 'active', 'closed', 'cancelled'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      logger.error('Admin assemblies fetch error', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    return NextResponse.json(assemblies || []);
  },
  { auth: 'required' },
);

// Update assembly status (activate / cancel)
export const PATCH = withRouteHandler(
  async (request: NextRequest, { wallet }: RouteContext) => {
    const supabase = getSupabaseAdmin();

    // Verify admin via ADMIN_WALLETS env var
    if (!wallet || !isAdminWallet(wallet)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, status } = await request.json();

    if (!id || !['active', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'id required, status must be active or cancelled' },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from('citizen_assemblies')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      logger.error('Admin assembly status update error', { error: error.message });
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  },
  { auth: 'required' },
);
