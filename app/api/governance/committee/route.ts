import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';
import { getCCHealthSummary, getCCMemberVerdicts } from '@/lib/data';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async () => {
  const supabase = createClient();

  // Parallel fetches: active members, votes, rationale names, health, verdicts,
  // plus new Constitutional Intelligence data
  const [
    { data: activeMembers, error: membersError },
    { data: votes, error: _votesError },
    { data: rationaleNames },
    health,
    verdicts,
    { data: matrixRows },
    { data: blocRows },
    { data: archetypeRows },
    { data: briefingRow },
  ] = await Promise.all([
    supabase
      .from('cc_members')
      .select(
        'cc_hot_id, author_name, fidelity_grade, fidelity_score, status, rationale_provision_rate',
      )
      .eq('status', 'authorized'),
    supabase.from('cc_votes').select('cc_hot_id, vote, proposal_tx_hash, proposal_index'),
    supabase.from('cc_rationales').select('cc_hot_id, author_name').not('author_name', 'is', null),
    getCCHealthSummary(),
    getCCMemberVerdicts(),
    supabase.from('cc_agreement_matrix').select('*'),
    supabase.from('cc_bloc_assignments').select('*').order('computed_at', { ascending: false }),
    supabase.from('cc_member_archetypes').select('*'),
    supabase
      .from('cc_intelligence_briefs')
      .select('*')
      .eq('brief_type', 'committee_epoch')
      .eq('persona_variant', 'default')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  // Compute aggregate stats
  const proposalSet = new Set<string>();
  for (const v of votes ?? []) {
    proposalSet.add(`${v.proposal_tx_hash}:${v.proposal_index}`);
  }
  const totalProposalsReviewed = proposalSet.size;
  const totalCCVotes = (votes ?? []).length;

  const ratesWithValues = (activeMembers ?? [])
    .map((m) => m.rationale_provision_rate)
    .filter((r): r is number => r != null);
  const avgRationaleRate =
    ratesWithValues.length > 0
      ? Math.round(ratesWithValues.reduce((a, b) => a + b, 0) / ratesWithValues.length)
      : null;

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
        fidelityGrade: m.fidelity_grade ?? null,
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

  const stats = { totalProposalsReviewed, avgRationaleRate, totalCCVotes };

  // Build member name lookup for bloc resolution
  const memberNameMap = new Map<string, string | null>();
  for (const m of members) {
    memberNameMap.set(m.ccHotId, m.name);
  }

  // Agreement matrix (camelCase)
  const agreementMatrix = (matrixRows ?? []).map((row) => ({
    memberA: row.member_a as string,
    memberB: row.member_b as string,
    voteAgreementPct: Number(row.agreement_pct),
    reasoningSimilarityPct: Number(row.reasoning_similarity_pct),
    totalSharedProposals: row.total_shared_proposals as number,
  }));

  // Blocs: deduplicate to latest computed_at per member, then group by label
  const seenBlocMembers = new Set<string>();
  const latestBlocRows: Array<{ cc_hot_id: string; bloc_label: string; computed_at: string }> = [];
  for (const row of blocRows ?? []) {
    const id = row.cc_hot_id as string;
    if (!seenBlocMembers.has(id)) {
      seenBlocMembers.add(id);
      latestBlocRows.push(row as { cc_hot_id: string; bloc_label: string; computed_at: string });
    }
  }

  const blocMap = new Map<string, { members: { ccHotId: string; name: string | null }[] }>();
  for (const row of latestBlocRows) {
    const label = row.bloc_label;
    const entry = blocMap.get(label) ?? { members: [] };
    entry.members.push({
      ccHotId: row.cc_hot_id,
      name: memberNameMap.get(row.cc_hot_id) ?? null,
    });
    blocMap.set(label, entry);
  }

  // Calculate internal agreement for each bloc from the matrix
  const blocs = Array.from(blocMap.entries()).map(([label, { members: blocMembers }]) => {
    const memberIds = new Set(blocMembers.map((m) => m.ccHotId));
    const internalPairs = (matrixRows ?? []).filter(
      (row) => memberIds.has(row.member_a as string) && memberIds.has(row.member_b as string),
    );
    const avgAgreement =
      internalPairs.length > 0
        ? Math.round(
            internalPairs.reduce((sum, r) => sum + Number(r.agreement_pct), 0) /
              internalPairs.length,
          )
        : 0;
    return {
      label,
      members: blocMembers,
      internalAgreementPct: avgAgreement,
    };
  });

  // Archetypes
  const archetypes = (archetypeRows ?? []).map((row) => ({
    ccHotId: row.cc_hot_id as string,
    label: row.archetype_label as string,
    description: (row.archetype_description as string) ?? null,
    mostAlignedMember: (row.most_aligned_member as string) ?? null,
    mostAlignedPct: row.most_aligned_pct != null ? Number(row.most_aligned_pct) : null,
    mostDivergentMember: (row.most_divergent_member as string) ?? null,
    mostDivergentPct: row.most_divergent_pct != null ? Number(row.most_divergent_pct) : null,
  }));

  // Briefing (graceful null if none exists)
  const briefing = briefingRow
    ? {
        headline: briefingRow.headline as string,
        executiveSummary: briefingRow.executive_summary as string,
        keyFindings: briefingRow.key_findings as { finding: string; severity: string }[],
        whatChanged: (briefingRow.what_changed as string) ?? null,
      }
    : null;

  return NextResponse.json(
    { members, health, stats, agreementMatrix, blocs, archetypes, briefing },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    },
  );
});
