import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { withRouteHandler, type RouteContext } from '@/lib/api/withRouteHandler';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(
  async (_request: NextRequest, { userId }: RouteContext) => {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: assembly, error } = await supabase
      .from('citizen_assemblies')
      .select('*')
      .eq('status', 'active')
      .lte('opens_at', now)
      .gte('closes_at', now)
      .order('opens_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !assembly) {
      return NextResponse.json(null);
    }

    // Check if user has voted
    let userVote: string | null = null;
    if (userId) {
      const { data: response } = await supabase
        .from('citizen_assembly_responses')
        .select('selected_option')
        .eq('assembly_id', assembly.id)
        .eq('user_id', userId)
        .single();

      if (response) userVote = response.selected_option;
    }

    // Get current vote counts
    const { data: responses } = await supabase
      .from('citizen_assembly_responses')
      .select('selected_option')
      .eq('assembly_id', assembly.id);

    const voteCounts: Record<string, number> = {};
    for (const r of responses || []) {
      voteCounts[r.selected_option] = (voteCounts[r.selected_option] || 0) + 1;
    }

    const totalVotes = (responses || []).length;
    const options =
      (assembly.options as { key: string; label: string; description?: string }[]) || [];
    const results = options.map((opt) => ({
      key: opt.key,
      label: opt.label,
      count: voteCounts[opt.key] || 0,
      percentage: totalVotes > 0 ? Math.round(((voteCounts[opt.key] || 0) / totalVotes) * 100) : 0,
    }));

    const quorumThreshold = (assembly as { quorum_threshold?: number }).quorum_threshold ?? 0;

    return NextResponse.json({
      id: assembly.id,
      title: assembly.title,
      description: assembly.description,
      question: assembly.question,
      options,
      status: assembly.status,
      epoch: assembly.epoch,
      opensAt: assembly.opens_at,
      closesAt: assembly.closes_at,
      results,
      totalVotes,
      userVote,
      quorumThreshold,
    });
  },
  { auth: 'optional' },
);
