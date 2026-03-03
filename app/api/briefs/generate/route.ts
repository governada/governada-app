/**
 * POST /api/briefs/generate — Admin trigger for manual/test brief generation.
 */
import { NextRequest, NextResponse } from 'next/server';

import {
  assembleDRepBriefContext,
  assembleHolderBriefContext,
  generateDRepBrief,
  generateHolderBrief,
  storeBrief,
} from '@/lib/governanceBrief';
import { notifyUser } from '@/lib/notifications';
import { getSupabaseAdmin } from '@/lib/supabase';
import { validateSessionToken } from '@/lib/supabaseAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await validateSessionToken(authHeader.slice(7));
  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wallet = session.walletAddress;
  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('claimed_drep_id, delegation_history')
    .eq('wallet_address', wallet)
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const isDRep = !!user.claimed_drep_id;

  try {
    let brief;
    if (isDRep) {
      const ctx = await assembleDRepBriefContext(user.claimed_drep_id!, wallet);
      if (!ctx)
        return NextResponse.json({ error: 'Could not assemble DRep context' }, { status: 500 });
      brief = generateDRepBrief(ctx);
      await storeBrief(wallet, 'drep', brief, ctx.epoch);
    } else {
      const history = user.delegation_history as Array<{ drepId: string }> | null;
      const currentDrep = history?.length ? history[history.length - 1].drepId : null;
      const ctx = await assembleHolderBriefContext(wallet, currentDrep);
      brief = generateHolderBrief(ctx);
      await storeBrief(wallet, 'holder', brief, ctx.epoch);
    }

    await notifyUser(wallet, {
      eventType: 'governance-brief',
      fallback: {
        title: 'Your Weekly Governance Brief',
        body: brief.greeting,
        url: '/dashboard',
      },
      data: {
        briefType: isDRep ? 'drep' : 'holder',
        greeting: brief.greeting,
        sections: brief.sections,
        ctaText: brief.ctaText,
        ctaUrl: brief.ctaUrl,
      },
    });

    return NextResponse.json({ ok: true, brief });
  } catch (err) {
    console.error('[BriefGenerate] Error:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
