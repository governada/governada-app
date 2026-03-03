import { NextRequest, NextResponse } from 'next/server';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { getSupabaseAdmin } from '@/lib/supabase';
import { SupabaseUser, SupabaseUserUpdate } from '@/types/supabase';

async function authenticateRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const session = await validateSessionToken(token);
  return session?.walletAddress ?? null;
}

export async function GET(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const previousVisitAt = data.last_visit_at || null;

  await supabase
    .from('users')
    .update({ last_visit_at: new Date().toISOString() })
    .eq('wallet_address', walletAddress);

  return NextResponse.json({
    ...data,
    previousVisitAt,
  } as SupabaseUser & { previousVisitAt: string | null });
}

export async function PATCH(request: NextRequest) {
  const walletAddress = await authenticateRequest(request);
  if (!walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updates: SupabaseUserUpdate = await request.json();

  const allowedFields: (keyof SupabaseUserUpdate)[] = [
    'prefs',
    'watchlist',
    'connected_wallets',
    'push_subscriptions',
    'display_name',
    'digest_frequency',
  ];

  const sanitizedUpdates: Record<string, unknown> = { last_active: new Date().toISOString() };
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      sanitizedUpdates[field] = updates[field];
    }
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .update(sanitizedUpdates)
    .eq('wallet_address', walletAddress)
    .select()
    .single();

  if (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }

  return NextResponse.json(data as SupabaseUser);
}
