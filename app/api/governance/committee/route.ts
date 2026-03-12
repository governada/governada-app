import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { getCCHealthSummary, getCCMemberVerdicts } from '@/lib/data';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  // Parallel fetches: active members, votes, rationale names, health, verdicts
  const [
    { data: activeMembers, error: membersError },
    { data: votes, error: votesError },
    { data: rationaleNames },
    health,
    verdicts,
  ] = await Promise.all([
    supabase
      .from('cc_members')
      .select('cc_hot_id, author_name, transparency_grade, fidelity_score, status')
      .eq('status', 'authorized'),
    supabase.from('cc_votes').select('cc_hot_id, vote'),
    supabase.from('cc_rationales').select('cc_hot_id, author_name').not('author_name', 'is', null),
    getCCHealthSummary(),
    getCCMemberVerdicts(),
  ]);

  if (membersError) {
    logger.error('Supabase error', {
      context: 'governance/committee',
      error: membersError?.message,
    });
    return NextResponse.json({ members: [], health });
  }

  // Build rationale name fallback map (first name found per cc_hot_id)
  const rationaleNameMap = new Map<string, string>();
  for (const r of rationaleNames ?? []) {
    if (r.author_name && !rationaleNameMap.has(r.cc_hot_id)) {
      rationaleNameMap.set(r.cc_hot_id, r.author_name);
    }
  }

  // Build vote counts per member
  const voteMap = new Map<string, { yes: number; no: number; abstain: number }>();
  for (const v of votes ?? []) {
    const existing = voteMap.get(v.cc_hot_id) || { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') existing.yes++;
    else if (v.vote === 'No') existing.no++;
    else existing.abstain++;
    voteMap.set(v.cc_hot_id, existing);
  }

  // Build verdict lookup
  const verdictMap = new Map(verdicts.map((v) => [v.ccHotId, v]));

  // Start from active members (not from votes) — ensures all 7 active CC members appear
  const members = (activeMembers ?? [])
    .map((m) => {
      const counts = voteMap.get(m.cc_hot_id) || { yes: 0, no: 0, abstain: 0 };
      const total = counts.yes + counts.no + counts.abstain;
      const verdict = verdictMap.get(m.cc_hot_id);
      return {
        ccHotId: m.cc_hot_id,
        name: m.author_name ?? rationaleNameMap.get(m.cc_hot_id) ?? null,
        fidelityGrade: m.transparency_grade ?? null, // column rename pending migration
        fidelityScore: m.fidelity_score ?? null,
        voteCount: total,
        yesCount: counts.yes,
        noCount: counts.no,
        abstainCount: counts.abstain,
        approvalRate: total > 0 ? Math.round((counts.yes / total) * 100) : 0,
        rank: verdict?.rank ?? null,
        narrativeVerdict: verdict?.narrative ?? null,
      };
    })
    .sort((a, b) => {
      // Sort by fidelity score (descending) if available, then by vote count
      if (a.fidelityScore != null && b.fidelityScore != null) {
        return b.fidelityScore - a.fidelityScore;
      }
      return b.voteCount - a.voteCount;
    });

  return NextResponse.json(
    { members, health },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
});
