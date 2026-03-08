import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';
import { captureServerEvent } from '@/lib/posthog-server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { OnboardingSchema } from '@/lib/api/schemas/user';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  if (!wallet) return NextResponse.json({ error: 'Missing wallet' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('users')
    .select('onboarding_checklist')
    .eq('wallet_address', wallet)
    .single();

  return NextResponse.json({ checklist: data?.onboarding_checklist || {} });
}

export const POST = withRouteHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const { sessionToken, item, completed } = OnboardingSchema.parse(body);

    const parsed = await validateSessionToken(sessionToken);
    if (!parsed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = parsed;
    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase
      .from('users')
      .select('onboarding_checklist')
      .eq('id', userId)
      .single();

    const checklist = user?.onboarding_checklist || {};
    checklist[item] = completed !== false;

    await supabase.from('users').update({ onboarding_checklist: checklist }).eq('id', userId);

    captureServerEvent(
      'onboarding_step_completed',
      { item, completed: checklist[item], user_id: userId },
      userId,
    );

    return NextResponse.json({ checklist });
  },
  { auth: 'none', rateLimit: { max: 20, window: 60 } },
);
