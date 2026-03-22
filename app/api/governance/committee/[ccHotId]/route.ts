import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { createClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request: Request) => {
  // Extract ccHotId from the URL path
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  // URL: /api/governance/committee/{ccHotId}
  const rawId = segments[segments.length - 1];
  const decodedId = decodeURIComponent(rawId ?? '');

  if (!decodedId) {
    return NextResponse.json({ error: 'Missing ccHotId parameter' }, { status: 400 });
  }

  const supabase = createClient();

  // Resolve cold ID for intelligence table lookups (which now key by cold ID)
  const { data: memberLookup } = await supabase
    .from('cc_members')
    .select('cc_cold_id')
    .eq('cc_hot_id', decodedId)
    .maybeSingle();
  const intelligenceId = memberLookup?.cc_cold_id ?? decodedId;

  // Parallel queries for member intelligence
  const [
    archetypeResult,
    agreementResult,
    blocResult,
    dossierResult,
    interpretationResult,
    analysisResult,
    allMembersResult,
  ] = await Promise.all([
    supabase.from('cc_member_archetypes').select('*').eq('cc_hot_id', intelligenceId).maybeSingle(),
    supabase
      .from('cc_agreement_matrix')
      .select('*')
      .or(`member_a.eq.${intelligenceId},member_b.eq.${intelligenceId}`),
    supabase
      .from('cc_bloc_assignments')
      .select('*')
      .eq('cc_hot_id', intelligenceId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cc_intelligence_briefs')
      .select('*')
      .eq('brief_type', 'member_dossier')
      .eq('reference_id', decodedId)
      .eq('persona_variant', 'default')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('cc_interpretation_history')
      .select('*')
      .eq('cc_hot_id', decodedId)
      .order('epoch', { ascending: true }),
    supabase.from('cc_rationale_analysis').select('*').eq('cc_hot_id', decodedId),
    supabase.from('cc_members').select('cc_hot_id, author_name').eq('status', 'authorized'),
  ]);

  // Build member name lookup
  const memberNameMap = new Map<string, string>();
  for (const m of allMembersResult.data ?? []) {
    if (m.author_name) memberNameMap.set(m.cc_hot_id as string, m.author_name as string);
  }

  // Build pairwise alignment from agreement matrix (keyed by cold/canonical ID)
  const pairwise = (agreementResult.data ?? []).map((row) => {
    const isA = row.member_a === intelligenceId;
    const peerId = (isA ? row.member_b : row.member_a) as string;
    return {
      memberId: peerId,
      memberName: memberNameMap.get(peerId) ?? null,
      voteAgreementPct: Number(row.agreement_pct),
      reasoningSimilarityPct: Number(row.reasoning_similarity_pct),
      sharedProposals: row.total_shared_proposals as number,
    };
  });

  // Group interpretation history by article
  const interpretationsByArticle = new Map<
    string,
    {
      proposalTxHash: string;
      proposalIndex: number;
      epoch: number;
      stance: string;
      summary: string;
      consistentWithPrior: boolean;
      driftNote: string | null;
    }[]
  >();
  for (const row of interpretationResult.data ?? []) {
    const article = row.article as string;
    const entries = interpretationsByArticle.get(article) ?? [];
    entries.push({
      proposalTxHash: row.proposal_tx_hash as string,
      proposalIndex: row.proposal_index as number,
      epoch: row.epoch as number,
      stance: row.interpretation_stance as string,
      summary: row.interpretation_summary as string,
      consistentWithPrior: row.consistent_with_prior as boolean,
      driftNote: (row.drift_note as string) ?? null,
    });
    interpretationsByArticle.set(article, entries);
  }

  // Build dossier from brief
  const dossierData = dossierResult.data;
  const keyFindingsArr = dossierData?.key_findings as
    | { finding: string; severity: string }[]
    | null
    | undefined;
  const dossier = dossierData
    ? {
        executiveSummary: dossierData.executive_summary as string,
        behavioralPatterns: (dossierData.what_changed as string) ?? null,
        constitutionalProfile: (dossierData.full_narrative as string) ?? null,
      }
    : null;

  const dossierKeyFinding = keyFindingsArr?.[0]?.finding ?? null;
  const dossierKeySeverity = keyFindingsArr?.[0]?.severity ?? null;

  // Build chamber position from archetype
  const archetype = archetypeResult.data;
  const chamberPosition = archetype
    ? {
        archetypeLabel: archetype.archetype_label as string,
        archetypeDescription: (archetype.archetype_description as string) ?? null,
        mostAligned: archetype.most_aligned_member
          ? {
              memberId: archetype.most_aligned_member as string,
              pct: Number(archetype.most_aligned_pct),
            }
          : null,
        mostDivergent: archetype.most_divergent_member
          ? {
              memberId: archetype.most_divergent_member as string,
              pct: Number(archetype.most_divergent_pct),
            }
          : null,
        blocLabel: (blocResult.data?.bloc_label as string) ?? 'Unknown',
        soleDissenterCount: (archetype.sole_dissenter_count as number) ?? 0,
        soleDissenterProposals: (archetype.sole_dissenter_proposals as string[]) ?? [],
        strictnessScore: Number(archetype.strictness_score),
        independenceProfile: archetype.independence_profile as string,
      }
    : null;

  // Key finding from rationale analyses (highest severity)
  const severityOrder: Record<string, number> = {
    critical: 4,
    concern: 3,
    noteworthy: 2,
    info: 1,
  };
  const sortedFindings = (analysisResult.data ?? [])
    .filter((a) => a.notable_finding)
    .sort(
      (a, b) =>
        (severityOrder[b.finding_severity as string] ?? 0) -
        (severityOrder[a.finding_severity as string] ?? 0),
    );

  const keyFinding =
    dossierKeyFinding ?? (sortedFindings[0]?.notable_finding as string | null) ?? null;
  const keyFindingSeverity =
    dossierKeySeverity ?? (sortedFindings[0]?.finding_severity as string | null) ?? null;

  return NextResponse.json({
    chamberPosition,
    dossier,
    keyFinding: keyFinding ? { finding: keyFinding, severity: keyFindingSeverity } : null,
    pairwiseAlignment: pairwise,
    interpretationHistory: Array.from(interpretationsByArticle.entries()).map(
      ([article, entries]) => ({
        article,
        entries,
      }),
    ),
    rationaleAnalyses: (analysisResult.data ?? []).map((a) => ({
      proposalTxHash: a.proposal_tx_hash as string,
      proposalIndex: a.proposal_index as number,
      deliberationQuality: a.deliberation_quality as number,
      rationalityScore: a.rationality_score as number,
      reciprocityScore: a.reciprocity_score as number,
      clarityScore: a.clarity_score as number,
      boilerplateScore: a.boilerplate_score as number | null,
      confidence: a.confidence as number | null,
      notableFinding: (a.notable_finding as string) ?? null,
      findingSeverity: (a.finding_severity as string) ?? null,
      novelInterpretation: a.novel_interpretation as boolean,
      contradictsOwnPrecedent: a.contradicts_own_precedent as boolean,
    })),
  });
});
