import { getEnrichedDReps } from '@/lib/koios';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchProposals, resolveADAHandles, resetKoiosMetrics, getKoiosMetrics } from '@/utils/koios';
import { classifyProposals, computeAllCategoryScores } from '@/lib/alignment';
import { SyncLogger, batchUpsert, errMsg, emitPostHog, triggerAnalyticsDeploy, alertDiscord } from '@/lib/sync-utils';
import { KoiosProposalSchema, validateArray } from '@/utils/koios-schemas';
import type { ClassifiedProposal, ProposalListResponse, DRepVote } from '@/types/koios';
import type { ProposalContext } from '@/utils/scoring';

interface SupabaseDRepRow {
  id: string;
  metadata: Record<string, unknown>;
  info: Record<string, unknown>;
  votes: unknown[];
  score: number;
  participation_rate: number;
  rationale_rate: number;
  reliability_score: number;
  reliability_streak: number;
  reliability_recency: number;
  reliability_longest_gap: number;
  reliability_tenure: number;
  deliberation_modifier: number;
  effective_participation: number;
  size_tier: string;
  profile_completeness: number;
  anchor_url: string | null;
  anchor_hash: string | null;
}

/**
 * Core DReps sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeDrepsSync(): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const logger = new SyncLogger(supabase, 'dreps');
  await logger.start();
  resetKoiosMetrics();

  const syncErrors: string[] = [];
  const phaseTiming: Record<string, number> = {};
  let drepResult = { success: 0, errors: 0 };
  let handlesResolved = 0;

  try {
    // Step 1: Fetch proposals for scoring context (non-fatal)
    const step1Start = Date.now();
    let classifiedProposalsList: ClassifiedProposal[] = [];
    const proposalContextMap = new Map<string, ProposalContext>();

    try {
      const raw = await fetchProposals();
      const { valid: validRaw, invalidCount } = validateArray(raw, KoiosProposalSchema, 'dreps-proposals');
      if (invalidCount > 0) {
        emitPostHog(true, 'dreps', 0, { event_override: 'sync_validation_error', record_type: 'proposal', invalid_count: invalidCount });
        alertDiscord('Validation Errors: dreps', `${invalidCount} proposal records failed Zod validation during DReps sync`);
      }
      if (validRaw.length > 0) {
        classifiedProposalsList = classifyProposals(validRaw as unknown as ProposalListResponse);
        for (const p of classifiedProposalsList) {
          proposalContextMap.set(`${p.txHash}-${p.index}`, {
            proposalType: p.type,
            treasuryTier: p.treasuryTier,
          });
        }
      }
      console.log(`[dreps] Proposals: ${raw.length} fetched, ${classifiedProposalsList.length} classified`);
    } catch (err) {
      syncErrors.push(`Proposals: ${errMsg(err)}`);
      console.warn('[dreps] Proposal fetch failed (non-fatal):', errMsg(err));
    }
    phaseTiming.step1_proposals_ms = Date.now() - step1Start;

    // Step 2: Fetch enriched DReps (fatal if no data)
    const step2Start = Date.now();
    const result = await getEnrichedDReps(false, {
      includeRawVotes: true,
      proposalContextMap: proposalContextMap.size > 0 ? proposalContextMap : undefined,
    });

    if (result.error || !result.allDReps?.length) {
      const msg = 'Koios DRep fetch returned no data';
      syncErrors.push(msg);
      await logger.finalize(false, syncErrors.join('; '), phaseTiming);
      throw new Error(msg);
    }

    const allDReps = result.allDReps;
    const rawVotesMap = result.rawVotesMap as Record<string, DRepVote[]> | undefined;
    console.log(`[dreps] Enriched ${allDReps.length} DReps`);
    phaseTiming.step2_enrich_ms = Date.now() - step2Start;

    // Step 3: ADA Handle resolution (non-fatal)
    const step3Start = Date.now();
    try {
      const handleMap = await resolveADAHandles(
        allDReps.map(d => ({ drepId: d.drepId, drepHash: d.drepHash }))
      );
      for (const drep of allDReps) {
        const handle = handleMap.get(drep.drepId);
        if (handle) (drep as unknown as Record<string, unknown>).handle = handle;
      }
      handlesResolved = handleMap.size;
      console.log(`[dreps] ADA Handles: ${handlesResolved} resolved out of ${allDReps.length}`);
    } catch (err) {
      syncErrors.push(`ADA Handles: ${errMsg(err)}`);
      console.warn('[dreps] ADA Handle resolution failed (non-fatal):', errMsg(err));
    }
    phaseTiming.step3_handles_ms = Date.now() - step3Start;

    // Step 3b: Read existing delegator counts from DB so DRep sync doesn't overwrite with 0
    const step3bStart = Date.now();
    const existingDelegatorCounts = new Map<string, number>();
    try {
      const { data: existing } = await supabase
        .from('dreps')
        .select('id, info');
      for (const row of existing || []) {
        const info = row.info as Record<string, unknown> | null;
        const count = (info?.delegatorCount as number) || 0;
        existingDelegatorCounts.set(row.id, count);
      }
      console.log(`[dreps] Preserved ${existingDelegatorCounts.size} existing delegator counts`);
    } catch (err) {
      console.warn('[dreps] Could not read existing delegator counts:', errMsg(err));
    }
    phaseTiming.step3b_delegators_ms = Date.now() - step3bStart;

    // Step 4: Upsert DReps
    const step4Start = Date.now();
    const drepRows: SupabaseDRepRow[] = allDReps.map((drep) => ({
      id: drep.drepId,
      metadata: (drep.metadata as Record<string, unknown>) || {},
      info: {
        drepHash: drep.drepHash, handle: drep.handle, name: drep.name,
        ticker: drep.ticker, description: drep.description,
        votingPower: drep.votingPower, votingPowerLovelace: drep.votingPowerLovelace,
        delegatorCount: existingDelegatorCounts.get(drep.drepId) ?? 0, totalVotes: drep.totalVotes,
        yesVotes: drep.yesVotes, noVotes: drep.noVotes, abstainVotes: drep.abstainVotes,
        isActive: drep.isActive, anchorUrl: drep.anchorUrl,
        epochVoteCounts: drep.epochVoteCounts,
      },
      votes: [],
      score: drep.drepScore, participation_rate: drep.participationRate,
      rationale_rate: drep.rationaleRate, reliability_score: drep.reliabilityScore,
      reliability_streak: drep.reliabilityStreak, reliability_recency: drep.reliabilityRecency,
      reliability_longest_gap: drep.reliabilityLongestGap, reliability_tenure: drep.reliabilityTenure,
      deliberation_modifier: drep.deliberationModifier,
      effective_participation: drep.effectiveParticipation,
      size_tier: drep.sizeTier, profile_completeness: drep.profileCompleteness,
      anchor_url: drep.anchorUrl || null,
      anchor_hash: drep.anchorHash || null,
    }));

    drepResult = await batchUpsert(supabase, 'dreps', drepRows as unknown as Record<string, unknown>[], 'id', 'DReps');
    console.log(`[dreps] Upserted ${drepResult.success} DReps (${drepResult.errors} errors)`);
    phaseTiming.step4_upsert_ms = Date.now() - step4Start;

    // Steps 5-6: Alignment scores + Score history (parallel)
    const step56Start = Date.now();
    const parallelResults = await Promise.allSettled([
      // Step 5: Alignment scores
      (async () => {
        if (!rawVotesMap || classifiedProposalsList.length === 0) return;
        const updates = allDReps.map(drep => {
          const votes = rawVotesMap![drep.drepId] || [];
          const scores = computeAllCategoryScores(drep, votes, classifiedProposalsList);
          return {
            id: drep.drepId,
            alignment_treasury_conservative: scores.alignmentTreasuryConservative,
            alignment_treasury_growth: scores.alignmentTreasuryGrowth,
            alignment_decentralization: scores.alignmentDecentralization,
            alignment_security: scores.alignmentSecurity,
            alignment_innovation: scores.alignmentInnovation,
            alignment_transparency: scores.alignmentTransparency,
            last_vote_time: scores.lastVoteTime,
          };
        });
        const r = await batchUpsert(supabase, 'dreps', updates as unknown as Record<string, unknown>[], 'id', 'Alignment');
        console.log(`[dreps] Alignment scores: ${r.success} computed`);
      })(),

      // Step 6: Score history snapshot
      (async () => {
        const today = new Date().toISOString().split('T')[0];
        const historyRows = allDReps.map(drep => ({
          drep_id: drep.drepId, score: drep.drepScore,
          effective_participation: drep.effectiveParticipation,
          rationale_rate: drep.rationaleRate,
          reliability_score: drep.reliabilityScore,
          profile_completeness: drep.profileCompleteness,
          snapshot_date: today,
        }));
        const r = await batchUpsert(supabase, 'drep_score_history', historyRows as unknown as Record<string, unknown>[], 'drep_id,snapshot_date', 'Score history');
        if (r.success > 0) console.log(`[dreps] Score history: ${r.success} snapshots for ${today}`);
      })(),
    ]);

    for (const r of parallelResults) {
      if (r.status === 'rejected') {
        const msg = errMsg(r.reason);
        syncErrors.push(`Parallel: ${msg}`);
        console.error('[dreps] Parallel step error:', msg);
      }
    }
    phaseTiming.step56_parallel_ms = Date.now() - step56Start;

    // Finalize
    const totalErrors = drepResult.errors;
    const totalRows = drepResult.success + totalErrors;
    const errorRate = totalRows > 0 ? totalErrors / totalRows : 0;
    const success = errorRate < 0.05 && syncErrors.length === 0;

    if (totalErrors > 0) {
      syncErrors.push(`Upsert errors: ${totalErrors} dreps (${(errorRate * 100).toFixed(1)}% rate)`);
    }

    const duration = ((logger.elapsed) / 1000).toFixed(1);
    console.log(`[dreps] Complete in ${duration}s — ${drepResult.success} DReps synced${syncErrors.length > 0 ? ` (${syncErrors.length} issues)` : ''}`);

    const metrics = {
      dreps_synced: drepResult.success,
      drep_errors: drepResult.errors,
      handles_resolved: handlesResolved,
      ...phaseTiming,
      ...getKoiosMetrics(),
    };

    await logger.finalize(success, syncErrors.length > 0 ? syncErrors.join('; ') : null, metrics);
    await emitPostHog(success, 'dreps', logger.elapsed, metrics);
    triggerAnalyticsDeploy('dreps');

    return {
      success,
      dreps: { synced: drepResult.success, errors: drepResult.errors },
      handlesResolved,
      durationSeconds: duration,
      timestamp: new Date().toISOString(),
    };

  } catch (outerErr) {
    const msg = errMsg(outerErr);
    syncErrors.push(`Fatal: ${msg}`);
    console.error('[dreps] Fatal error:', msg);
    await logger.finalize(false, syncErrors.join('; '), phaseTiming);
    throw outerErr;
  }
}
