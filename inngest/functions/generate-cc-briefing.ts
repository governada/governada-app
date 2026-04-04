/**
 * Generate CC Briefing — Constitutional Intelligence Pipeline (Chunk 7)
 *
 * 4-step Inngest function that generates:
 * 1. Committee epoch briefing (AI-powered summary of CC state)
 * 2. Member dossiers (AI-powered profiles of each CC member)
 * 3. Predictive signals (vote predictions for pending proposals)
 * 4. Prediction accuracy backfill (comparing past predictions to actual outcomes)
 *
 * Triggered by: cc/analysis.completed, cc/relations.computed, or every 2 days.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { MODELS } from '@/lib/ai';
import { generateCommitteeBriefing, generateMemberDossier } from '@/lib/cc/briefingGenerator';
import { generatePrediction } from '@/lib/cc/predictiveSignals';
import { canBodyVote } from '@/lib/governance/votingBodies';
import { logger } from '@/lib/logger';
import type { CommitteeBriefingInput } from '@/lib/cc/briefingGenerator';
import type { MemberDossierInput } from '@/lib/cc/briefingGenerator';
import type { PredictionInput } from '@/lib/cc/predictiveSignals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple hash of a string for deduplication. */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return `h${Math.abs(hash).toString(36)}_${input.length}`;
}

/** Format array items as readable bullet list. */
function toBullets(items: string[]): string {
  if (items.length === 0) return 'None';
  return items.map((item) => `- ${item}`).join('\n');
}

// ---------------------------------------------------------------------------
// Inngest Function
// ---------------------------------------------------------------------------

export const generateCcBriefing = inngest.createFunction(
  {
    id: 'generate-cc-briefing',
    concurrency: [{ scope: 'env', key: 'cc-briefing', limit: 1 }],
    retries: 1,
    triggers: [
      { event: 'cc/analysis.completed' },
      { event: 'cc/relations.computed' },
      { cron: '0 0 */2 * *' },
    ],
  },
  async ({ step }) => {
    // -----------------------------------------------------------------------
    // Step 1: Generate committee briefing
    // -----------------------------------------------------------------------
    const briefingResult = await step.run('generate-committee-briefing', async () => {
      const supabase = getSupabaseAdmin();

      // Gather data from multiple sources
      const [
        { data: stats },
        { data: members },
        { data: blocAssignments },
        { data: ratAnalyses },
        { data: interpHistory },
        { data: alignmentRows },
        { data: ccVotes },
      ] = await Promise.all([
        supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
        supabase
          .from('cc_members')
          .select('cc_hot_id, author_name, status, fidelity_score, fidelity_grade'),
        supabase
          .from('cc_bloc_assignments')
          .select('cc_hot_id, bloc_label, internal_agreement_pct, member_count'),
        supabase
          .from('cc_rationale_analysis')
          .select(
            'cc_hot_id, proposal_tx_hash, proposal_index, novel_interpretation, contradicts_own_precedent, notable_finding, finding_severity',
          )
          .order('analyzed_at', { ascending: false })
          .limit(50),
        supabase
          .from('cc_interpretation_history')
          .select('cc_hot_id, article, interpretation_stance, drift_note, consistent_with_prior')
          .eq('consistent_with_prior', false)
          .limit(30),
        supabase
          .from('inter_body_alignment')
          .select(
            'proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct, cc_yes_pct, cc_no_pct',
          ),
        supabase.from('cc_votes').select('cc_hot_id, proposal_tx_hash, proposal_index, vote'),
      ]);

      const currentEpoch = stats?.current_epoch ?? 0;
      const activeMembers = (members ?? []).filter((m) => m.status === 'authorized');
      const scoredMembers = activeMembers.filter((m) => m.fidelity_score != null);
      const avgFidelity =
        scoredMembers.length > 0
          ? Math.round(
              scoredMembers.reduce((sum, m) => sum + (m.fidelity_score ?? 0), 0) /
                scoredMembers.length,
            )
          : 0;

      // Health status
      let healthStatus: string;
      if (avgFidelity >= 70) healthStatus = 'healthy';
      else if (avgFidelity >= 50) healthStatus = 'attention';
      else healthStatus = 'critical';

      // Trend (simple heuristic — declining if low, improving if high)
      const trend = avgFidelity >= 70 ? 'stable' : avgFidelity >= 50 ? 'stable' : 'declining';

      // Bloc summary
      const blocGroups = new Map<string, string[]>();
      for (const b of blocAssignments ?? []) {
        const list = blocGroups.get(b.bloc_label) ?? [];
        const member = activeMembers.find((m) => m.cc_hot_id === b.cc_hot_id);
        list.push(member?.author_name ?? b.cc_hot_id.slice(0, 12));
        blocGroups.set(b.bloc_label, list);
      }
      const blocSummaryLines: string[] = [];
      for (const [label, memberNames] of blocGroups) {
        const assignment = (blocAssignments ?? []).find((b) => b.bloc_label === label);
        blocSummaryLines.push(
          `${label} (${memberNames.length} members, ${assignment?.internal_agreement_pct ?? 'N/A'}% internal agreement): ${memberNames.join(', ')}`,
        );
      }

      // Recent decisions
      const proposalVoteMap = new Map<string, { yes: number; no: number; abstain: number }>();
      for (const v of ccVotes ?? []) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const counts = proposalVoteMap.get(key) ?? {
          yes: 0,
          no: 0,
          abstain: 0,
        };
        if (v.vote === 'Yes') counts.yes++;
        else if (v.vote === 'No') counts.no++;
        else counts.abstain++;
        proposalVoteMap.set(key, counts);
      }
      const recentDecisionLines: string[] = [];
      for (const [key, counts] of proposalVoteMap) {
        recentDecisionLines.push(
          `Proposal ${key}: Yes ${counts.yes}, No ${counts.no}, Abstain ${counts.abstain}`,
        );
      }

      // Novel interpretations
      const novelFindings = (ratAnalyses ?? []).filter((r) => r.novel_interpretation === true);
      const novelLines = novelFindings
        .slice(0, 5)
        .map(
          (r) =>
            `Member ${r.cc_hot_id.slice(0, 12)} on proposal ${r.proposal_tx_hash.slice(0, 12)}...`,
        );

      // Contradictions
      const contradictions = (ratAnalyses ?? []).filter(
        (r) => r.contradicts_own_precedent === true,
      );
      const contradictionLines = contradictions
        .slice(0, 5)
        .map(
          (r) =>
            `Member ${r.cc_hot_id.slice(0, 12)} contradicted own precedent on ${r.proposal_tx_hash.slice(0, 12)}... (${r.finding_severity ?? 'noteworthy'})`,
        );

      // Drift events
      const driftEvents = (interpHistory ?? []).filter((h) => h.drift_note != null);
      const driftLines = driftEvents
        .slice(0, 5)
        .map((h) => `Member ${h.cc_hot_id.slice(0, 12)} on ${h.article}: ${h.drift_note}`);

      // Tensions (CC vs DRep divergences)
      const tensionLines: string[] = [];
      for (const row of alignmentRows ?? []) {
        const ccMajority = (row.cc_yes_pct ?? 0) > (row.cc_no_pct ?? 0) ? 'Yes' : 'No';
        const drepMajority = (row.drep_yes_pct ?? 0) > (row.drep_no_pct ?? 0) ? 'Yes' : 'No';
        if (ccMajority !== drepMajority) {
          tensionLines.push(
            `Proposal ${row.proposal_tx_hash.slice(0, 12)}...: CC majority ${ccMajority} vs DRep majority ${drepMajority}`,
          );
        }
      }

      // Compute input hash
      const inputData = JSON.stringify({
        memberCount: activeMembers.length,
        avgFidelity,
        healthStatus,
        blocCount: blocGroups.size,
        novelCount: novelFindings.length,
        contradictionCount: contradictions.length,
        driftCount: driftEvents.length,
        tensionCount: tensionLines.length,
        decisionCount: proposalVoteMap.size,
      });
      const inputHash = simpleHash(inputData);

      // Check if briefing with same hash exists
      const { data: existing } = await supabase
        .from('cc_intelligence_briefs')
        .select('id')
        .eq('brief_type', 'committee_epoch')
        .eq('input_hash', inputHash)
        .limit(1)
        .maybeSingle();

      if (existing) {
        logger.info('[cc-briefing] Committee briefing unchanged, skipping regeneration', {
          inputHash,
        });
        return { status: 'skipped', reason: 'unchanged' };
      }

      const briefingInput: CommitteeBriefingInput = {
        memberCount: activeMembers.length,
        avgFidelity,
        healthStatus,
        trend,
        blocSummary: toBullets(blocSummaryLines),
        recentDecisions: toBullets(recentDecisionLines.slice(0, 10)),
        novelInterpretations: toBullets(novelLines),
        contradictions: toBullets(contradictionLines),
        driftEvents: toBullets(driftLines),
        tensions: toBullets(tensionLines.slice(0, 5)),
        persona: 'default',
      };

      const result = await generateCommitteeBriefing(briefingInput);

      if (!result) {
        logger.warn('[cc-briefing] Committee briefing generation returned null');
        return { status: 'failed', reason: 'ai_returned_null' };
      }

      // Upsert into cc_intelligence_briefs
      const { error } = await supabase.from('cc_intelligence_briefs').upsert(
        {
          brief_type: 'committee_epoch',
          reference_id: String(currentEpoch),
          persona_variant: 'default',
          headline: result.headline,
          executive_summary: result.executive_summary,
          key_findings: result.key_findings as unknown as Record<string, unknown>,
          what_changed: result.what_changed,
          input_hash: inputHash,
          model_version: MODELS.DRAFT,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'brief_type,reference_id,persona_variant' },
      );

      if (error) {
        logger.error('[cc-briefing] Failed to upsert committee briefing', {
          error: error.message,
        });
        return { status: 'error', reason: error.message };
      }

      logger.info('[cc-briefing] Committee briefing generated', {
        epoch: currentEpoch,
        headline: result.headline,
      });

      return { status: 'generated', headline: result.headline };
    });

    // -----------------------------------------------------------------------
    // Step 2: Generate member dossiers
    // -----------------------------------------------------------------------
    const dossierResult = await step.run('generate-member-dossiers', async () => {
      const supabase = getSupabaseAdmin();

      // Get active CC members
      const { data: members } = await supabase
        .from('cc_members')
        .select(
          'cc_hot_id, author_name, status, fidelity_score, fidelity_grade, participation_score, rationale_quality_score, constitutional_grounding_score, authorization_epoch, expiration_epoch',
        )
        .eq('status', 'authorized');

      if (!members?.length) {
        return { generated: 0, skipped: 0, failed: 0 };
      }

      const totalMembers = members.length;

      // Get archetypes for all members
      const { data: archetypes } = await supabase
        .from('cc_member_archetypes')
        .select(
          'cc_hot_id, archetype_label, archetype_description, most_aligned_member, most_aligned_pct, most_divergent_member, most_divergent_pct, sole_dissenter_count',
        );

      const archetypeMap = new Map((archetypes ?? []).map((a) => [a.cc_hot_id, a]));

      // Get bloc assignments
      const { data: blocAssignments } = await supabase
        .from('cc_bloc_assignments')
        .select('cc_hot_id, bloc_label, internal_agreement_pct');

      const blocMap = new Map((blocAssignments ?? []).map((b) => [b.cc_hot_id, b]));

      // Get recent rationale analyses with notable findings
      const { data: recentAnalyses } = await supabase
        .from('cc_rationale_analysis')
        .select(
          'cc_hot_id, proposal_tx_hash, notable_finding, finding_severity, contradicts_own_precedent, novel_interpretation',
        )
        .not('notable_finding', 'is', null)
        .order('analyzed_at', { ascending: false })
        .limit(100);

      const analysisByMember = new Map<
        string,
        Array<{
          notable_finding: string | null;
          finding_severity: string | null;
          contradicts_own_precedent: boolean | null;
          novel_interpretation: boolean | null;
        }>
      >();
      for (const a of recentAnalyses ?? []) {
        const list = analysisByMember.get(a.cc_hot_id) ?? [];
        list.push(a);
        analysisByMember.set(a.cc_hot_id, list);
      }

      // Get interpretation history
      const { data: interpHistory } = await supabase
        .from('cc_interpretation_history')
        .select(
          'cc_hot_id, article, interpretation_stance, interpretation_summary, drift_note, consistent_with_prior',
        )
        .order('created_at', { ascending: false })
        .limit(200);

      const interpByMember = new Map<
        string,
        Array<{
          article: string;
          interpretation_stance: string | null;
          interpretation_summary: string | null;
          drift_note: string | null;
          consistent_with_prior: boolean | null;
        }>
      >();
      for (const h of interpHistory ?? []) {
        const list = interpByMember.get(h.cc_hot_id) ?? [];
        list.push(h);
        interpByMember.set(h.cc_hot_id, list);
      }

      let generated = 0;
      let skipped = 0;
      let failed = 0;

      // Sort by fidelity_score descending for deterministic ranking
      const sortedMembers = [...members].sort(
        (a, b) => (b.fidelity_score ?? 0) - (a.fidelity_score ?? 0),
      );

      for (let rank = 0; rank < sortedMembers.length; rank++) {
        const member = sortedMembers[rank];

        try {
          const archetype = archetypeMap.get(member.cc_hot_id);
          const bloc = blocMap.get(member.cc_hot_id);
          const analyses = analysisByMember.get(member.cc_hot_id) ?? [];
          const interps = interpByMember.get(member.cc_hot_id) ?? [];

          // Build input hash
          const dossierData = JSON.stringify({
            ccHotId: member.cc_hot_id,
            fidelityScore: member.fidelity_score,
            archetype: archetype?.archetype_label,
            blocLabel: bloc?.bloc_label,
            analysesCount: analyses.length,
            interpsCount: interps.length,
          });
          const inputHash = simpleHash(dossierData);

          // Check if dossier with same hash exists
          const { data: existing } = await supabase
            .from('cc_intelligence_briefs')
            .select('id')
            .eq('brief_type', 'member_dossier')
            .eq('reference_id', member.cc_hot_id)
            .eq('input_hash', inputHash)
            .limit(1)
            .maybeSingle();

          if (existing) {
            skipped++;
            continue;
          }

          // Build rationale findings text
          const rationaleFindings =
            analyses.length > 0
              ? toBullets(
                  analyses.slice(0, 5).map((a) => {
                    const parts: string[] = [];
                    if (a.notable_finding) parts.push(a.notable_finding);
                    if (a.contradicts_own_precedent) parts.push('[Contradicts own precedent]');
                    if (a.novel_interpretation) parts.push('[Novel interpretation]');
                    if (a.finding_severity) parts.push(`(${a.finding_severity})`);
                    return parts.join(' ');
                  }),
                )
              : 'No notable findings recorded.';

          // Build interpretation history text
          const interpretationHistory =
            interps.length > 0
              ? toBullets(
                  interps.slice(0, 8).map((h) => {
                    const drift = h.drift_note ? ` [DRIFT: ${h.drift_note}]` : '';
                    return `${h.article}: ${h.interpretation_stance ?? 'unknown'} stance — ${h.interpretation_summary ?? 'No summary'}${drift}`;
                  }),
                )
              : 'No interpretation history recorded.';

          // Build contradictions text
          const contradictionItems = interps.filter((h) => h.consistent_with_prior === false);
          const contradictions =
            contradictionItems.length > 0
              ? toBullets(
                  contradictionItems.slice(0, 5).map((h) => {
                    return `${h.article}: ${h.drift_note ?? 'Changed stance'}`;
                  }),
                )
              : 'No contradictions detected.';

          const dossierInput: MemberDossierInput = {
            authorName: member.author_name,
            ccHotId: member.cc_hot_id,
            fidelityScore: member.fidelity_score,
            fidelityGrade: member.fidelity_grade,
            rank: rank + 1,
            totalMembers,
            authorizationEpoch: member.authorization_epoch,
            expirationEpoch: member.expiration_epoch,
            archetypeLabel: archetype?.archetype_label ?? 'Active Member',
            archetypeDescription: archetype?.archetype_description ?? null,
            mostAlignedMember: archetype?.most_aligned_member ?? null,
            mostAlignedPct: archetype?.most_aligned_pct ?? null,
            mostDivergentMember: archetype?.most_divergent_member ?? null,
            mostDivergentPct: archetype?.most_divergent_pct ?? null,
            blocLabel: bloc?.bloc_label ?? 'Independent',
            blocInternalAgreement: bloc?.internal_agreement_pct ?? null,
            soleDissenterCount: archetype?.sole_dissenter_count ?? 0,
            participationScore: member.participation_score,
            groundingScore: member.constitutional_grounding_score,
            reasoningScore: member.rationale_quality_score,
            rationaleFindings,
            interpretationHistory,
            contradictions,
          };

          const result = await generateMemberDossier(dossierInput);

          if (!result) {
            failed++;
            continue;
          }

          // Upsert into cc_intelligence_briefs
          const { error } = await supabase.from('cc_intelligence_briefs').upsert(
            {
              brief_type: 'member_dossier',
              reference_id: member.cc_hot_id,
              persona_variant: 'default',
              headline: null,
              executive_summary: result.executive_summary,
              key_findings: [
                {
                  finding: result.key_finding,
                  severity: 'noteworthy',
                },
              ] as unknown as Record<string, unknown>,
              full_narrative: JSON.stringify({
                behavioral_patterns: result.behavioral_patterns,
                constitutional_profile: result.constitutional_profile,
              }),
              input_hash: inputHash,
              model_version: MODELS.DRAFT,
              generated_at: new Date().toISOString(),
            },
            {
              onConflict: 'brief_type,reference_id,persona_variant',
            },
          );

          if (error) {
            logger.error('[cc-briefing] Failed to upsert member dossier', {
              error: error.message,
              ccHotId: member.cc_hot_id,
            });
            failed++;
          } else {
            generated++;
          }
        } catch (err) {
          logger.error('[cc-briefing] Error generating member dossier', {
            error: err instanceof Error ? err.message : String(err),
            ccHotId: member.cc_hot_id,
          });
          failed++;
        }
      }

      logger.info('[cc-briefing] Member dossiers complete', {
        generated,
        skipped,
        failed,
      });

      return { generated, skipped, failed };
    });

    // -----------------------------------------------------------------------
    // Step 3: Generate predictions for pending CC-votable proposals
    // -----------------------------------------------------------------------
    const predictionResult = await step.run('generate-predictions', async () => {
      const supabase = getSupabaseAdmin();

      // Get pending CC-votable proposals (not ratified, enacted, expired, or dropped)
      const { data: proposalRows } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, proposal_type, proposed_epoch, param_changes')
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('expired_epoch', null)
        .is('dropped_epoch', null);

      const proposals =
        proposalRows?.filter((proposal) =>
          canBodyVote(
            'cc',
            proposal.proposal_type,
            (proposal.param_changes as Record<string, unknown> | null) ?? null,
          ),
        ) ?? [];

      if (!proposals?.length) {
        return { generated: 0, skipped: 0, failed: 0 };
      }

      // Filter out proposals that already have CC votes (fully voted)
      const { data: existingCcVotes } = await supabase
        .from('cc_votes')
        .select('proposal_tx_hash, proposal_index');

      // Count votes per proposal
      const voteCountByProposal = new Map<string, number>();
      for (const v of existingCcVotes ?? []) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        voteCountByProposal.set(key, (voteCountByProposal.get(key) ?? 0) + 1);
      }

      // Get active member count for threshold
      const { data: activeMembers } = await supabase
        .from('cc_members')
        .select('cc_hot_id')
        .eq('status', 'authorized');

      const activeMemberCount = activeMembers?.length ?? 0;

      // Filter to proposals where CC hasn't fully voted yet
      const pendingProposals = proposals.filter((p) => {
        const key = `${p.tx_hash}:${p.proposal_index}`;
        const voteCount = voteCountByProposal.get(key) ?? 0;
        // Consider "not fully voted" if less than half of members have voted
        return voteCount < Math.ceil(activeMemberCount / 2);
      });

      if (pendingProposals.length === 0) {
        return { generated: 0, skipped: 0, failed: 0 };
      }

      // Get bloc summary
      const { data: blocs } = await supabase
        .from('cc_bloc_assignments')
        .select('cc_hot_id, bloc_label, internal_agreement_pct');

      const blocGroups = new Map<string, string[]>();
      for (const b of blocs ?? []) {
        const list = blocGroups.get(b.bloc_label) ?? [];
        list.push(b.cc_hot_id.slice(0, 12));
        blocGroups.set(b.bloc_label, list);
      }
      const blocSummary = Array.from(blocGroups)
        .map(
          ([label, memberIds]) =>
            `- ${label}: ${memberIds.length} members (${memberIds.join(', ')})`,
        )
        .join('\n');

      // Get member names
      const { data: memberNames } = await supabase
        .from('cc_members')
        .select('cc_hot_id, author_name')
        .eq('status', 'authorized');

      const nameMap = new Map(
        (memberNames ?? []).map((m) => [m.cc_hot_id, m.author_name ?? m.cc_hot_id.slice(0, 12)]),
      );

      // Get all CC votes for building member histories
      const { data: allCcVotes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote');

      // Get proposal details for voted proposals
      const votedProposalKeys = new Set(
        (allCcVotes ?? []).map((v) => `${v.proposal_tx_hash}:${v.proposal_index}`),
      );
      const votedTxHashes = [...new Set((allCcVotes ?? []).map((v) => v.proposal_tx_hash))];

      let allProposalDetails: Array<{
        tx_hash: string;
        proposal_index: number;
        title: string | null;
        proposal_type: string;
      }> = [];

      if (votedTxHashes.length > 0) {
        const { data: proposalDetails } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index, title, proposal_type')
          .in('tx_hash', votedTxHashes.slice(0, 100));

        allProposalDetails = (proposalDetails ?? []).filter((p) =>
          votedProposalKeys.has(`${p.tx_hash}:${p.proposal_index}`),
        );
      }

      const proposalDetailMap = new Map(
        allProposalDetails.map((p) => [`${p.tx_hash}:${p.proposal_index}`, p]),
      );

      // Get interpretation stances
      const { data: interpretations } = await supabase
        .from('cc_interpretation_history')
        .select('cc_hot_id, article, interpretation_stance');

      const interpByMember = new Map<string, Array<{ article: string; stance: string | null }>>();
      for (const i of interpretations ?? []) {
        const list = interpByMember.get(i.cc_hot_id) ?? [];
        list.push({
          article: i.article,
          stance: i.interpretation_stance,
        });
        interpByMember.set(i.cc_hot_id, list);
      }

      let generated = 0;
      let skipped = 0;
      let failed = 0;

      for (const proposal of pendingProposals.slice(0, 10)) {
        try {
          // Check if prediction already exists for this proposal
          const predictionKey = `${proposal.tx_hash}:${proposal.proposal_index}`;
          const inputData = JSON.stringify({
            txHash: proposal.tx_hash,
            proposalIndex: proposal.proposal_index,
            proposalType: proposal.proposal_type,
            voteCount: voteCountByProposal.get(predictionKey) ?? 0,
          });
          const _inputHash = simpleHash(inputData);

          const { data: existingPrediction } = await supabase
            .from('cc_predictive_signals')
            .select('id')
            .eq('proposal_tx_hash', proposal.tx_hash)
            .eq('proposal_index', proposal.proposal_index)
            .limit(1)
            .maybeSingle();

          if (existingPrediction) {
            skipped++;
            continue;
          }

          // Build member histories text for this proposal type
          const memberHistoryLines: string[] = [];
          const memberIds = [...nameMap.keys()];

          for (const ccHotId of memberIds) {
            const name = nameMap.get(ccHotId) ?? ccHotId.slice(0, 12);
            const memberVotes = (allCcVotes ?? []).filter((v) => v.cc_hot_id === ccHotId);

            // Filter to same proposal type
            const relevantVotes = memberVotes.filter((v) => {
              const detail = proposalDetailMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
              return detail?.proposal_type === proposal.proposal_type;
            });

            const interps = interpByMember.get(ccHotId) ?? [];

            memberHistoryLines.push(`### ${name}`);

            if (relevantVotes.length > 0) {
              for (const v of relevantVotes.slice(0, 5)) {
                const detail = proposalDetailMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
                memberHistoryLines.push(`- Voted ${v.vote} on "${detail?.title ?? 'Unknown'}"`);
              }
            } else {
              memberHistoryLines.push(`- No prior votes on ${proposal.proposal_type} proposals`);
            }

            if (interps.length > 0) {
              const stancesList = interps
                .slice(0, 3)
                .map((i) => `${i.article}: ${i.stance ?? 'unknown'}`)
                .join('; ');
              memberHistoryLines.push(`- Interpretation stances: ${stancesList}`);
            }

            memberHistoryLines.push('');
          }

          // Determine relevant articles from proposal type
          // Use articles from previous analyses of same type
          const relevantArticles = new Set<string>();
          for (const v of allCcVotes ?? []) {
            const detail = proposalDetailMap.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
            if (detail?.proposal_type !== proposal.proposal_type) continue;
            const interps = interpByMember.get(v.cc_hot_id) ?? [];
            for (const i of interps) {
              relevantArticles.add(i.article);
            }
          }

          const predictionInput: PredictionInput = {
            proposalTitle: proposal.title ?? 'Untitled Proposal',
            proposalType: proposal.proposal_type,
            relevantArticles: [...relevantArticles].slice(0, 10),
            memberHistories: memberHistoryLines.join('\n'),
            blocSummary: blocSummary || 'No bloc data available.',
          };

          const result = await generatePrediction(predictionInput);

          if (!result) {
            failed++;
            continue;
          }

          const { error } = await supabase.from('cc_predictive_signals').upsert(
            {
              proposal_tx_hash: proposal.tx_hash,
              proposal_index: proposal.proposal_index,
              predicted_outcome: result.predicted_outcome,
              predicted_split: result.predicted_split as unknown as Record<string, unknown>,
              confidence: result.confidence,
              reasoning: result.reasoning,
              key_article: result.key_article,
              tension_flag: result.tension_flag,
              model_version: MODELS.FAST,
              predicted_at: new Date().toISOString(),
            },
            {
              onConflict: 'proposal_tx_hash,proposal_index',
            },
          );

          if (error) {
            logger.error('[cc-briefing] Failed to upsert prediction', {
              error: error.message,
              proposal: proposal.tx_hash,
            });
            failed++;
          } else {
            generated++;
          }
        } catch (err) {
          logger.error('[cc-briefing] Error generating prediction', {
            error: err instanceof Error ? err.message : String(err),
            proposal: proposal.tx_hash,
          });
          failed++;
        }
      }

      logger.info('[cc-briefing] Predictions complete', {
        generated,
        skipped,
        failed,
      });

      return { generated, skipped, failed };
    });

    // -----------------------------------------------------------------------
    // Step 4: Backfill prediction accuracy
    // -----------------------------------------------------------------------
    const accuracyResult = await step.run('backfill-prediction-accuracy', async () => {
      const supabase = getSupabaseAdmin();

      // Find predictions where actual_outcome is null
      const { data: unresolvedPredictions } = await supabase
        .from('cc_predictive_signals')
        .select('id, proposal_tx_hash, proposal_index, predicted_outcome')
        .is('actual_outcome', null);

      if (!unresolvedPredictions?.length) {
        return { resolved: 0 };
      }

      // Get CC votes for these proposals
      let resolved = 0;

      for (const prediction of unresolvedPredictions) {
        try {
          // Check if the proposal has been resolved (ratified/enacted/expired/dropped)
          const { data: proposal } = await supabase
            .from('proposals')
            .select('ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch')
            .eq('tx_hash', prediction.proposal_tx_hash)
            .eq('proposal_index', prediction.proposal_index)
            .single();

          if (!proposal) continue;

          // Proposal still pending
          const isResolved =
            proposal.ratified_epoch != null ||
            proposal.enacted_epoch != null ||
            proposal.expired_epoch != null ||
            proposal.dropped_epoch != null;

          if (!isResolved) continue;

          // Get CC votes for this proposal
          const { data: votes } = await supabase
            .from('cc_votes')
            .select('vote')
            .eq('proposal_tx_hash', prediction.proposal_tx_hash)
            .eq('proposal_index', prediction.proposal_index);

          if (!votes?.length) continue;

          // Determine actual outcome
          const yesCount = votes.filter((v) => v.vote === 'Yes').length;
          const noCount = votes.filter((v) => v.vote === 'No').length;

          let actualOutcome: string;
          if (yesCount > 0 && noCount > 0) {
            actualOutcome = 'split';
          } else if (yesCount > noCount) {
            actualOutcome = 'approve';
          } else {
            actualOutcome = 'reject';
          }

          // Compare prediction to actual
          const predictionAccurate = prediction.predicted_outcome === actualOutcome;

          const { error } = await supabase
            .from('cc_predictive_signals')
            .update({
              actual_outcome: actualOutcome,
              prediction_accurate: predictionAccurate,
            })
            .eq('id', prediction.id);

          if (error) {
            logger.error('[cc-briefing] Failed to update prediction accuracy', {
              error: error.message,
              id: prediction.id,
            });
          } else {
            resolved++;
          }
        } catch (err) {
          logger.error('[cc-briefing] Error resolving prediction accuracy', {
            error: err instanceof Error ? err.message : String(err),
            id: prediction.id,
          });
        }
      }

      logger.info('[cc-briefing] Prediction accuracy backfill complete', {
        total: unresolvedPredictions.length,
        resolved,
      });

      return { resolved };
    });

    return {
      briefing: briefingResult,
      dossiers: dossierResult,
      predictions: predictionResult,
      accuracy: accuracyResult,
    };
  },
);
