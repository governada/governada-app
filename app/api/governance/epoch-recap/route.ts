import { NextRequest, NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request, { requestId }) => {
    const epochParam = request.nextUrl.searchParams.get('epoch');
    const supabase = createClient();

    if (epochParam) {
      const epoch = parseInt(epochParam);
      if (isNaN(epoch)) {
        return NextResponse.json({ error: 'Invalid epoch parameter' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('epoch_recaps')
        .select('*')
        .eq('epoch', epoch)
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Epoch recap not found' }, { status: 404 });
      }

      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
      });
    }

    // Listing mode: ?before=N&limit=M returns multiple recaps for pagination
    const beforeParam = request.nextUrl.searchParams.get('before');
    const limitParam = request.nextUrl.searchParams.get('limit');

    if (beforeParam) {
      const before = parseInt(beforeParam);
      const limit = Math.min(parseInt(limitParam || '20'), 50);
      if (isNaN(before)) {
        return NextResponse.json({ error: 'Invalid before parameter' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('epoch_recaps')
        .select('*')
        .lt('epoch', before)
        .order('epoch', { ascending: false })
        .limit(limit);

      return NextResponse.json(data ?? [], {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
      });
    }

    // Return latest epoch recap
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
    const { data, error } = await supabase
      .from('epoch_recaps')
      .select('*')
      .lte('epoch', currentEpoch)
      .order('epoch', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'No epoch recaps available' }, { status: 404 });
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' },
    });
});
