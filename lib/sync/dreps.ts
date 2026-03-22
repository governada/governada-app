import { getEnrichedDReps, type EnrichedDRep } from '@/lib/koios';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger as log } from '@/lib/logger';
import {
  fetchProposals,
  resolveADAHandles,
  resetKoiosMetrics,
  getKoiosMetrics,
} from '@/utils/koios';
import { classifyProposals, computeAllCategoryScores } from '@/lib/alignment';
import {
  SyncLogger,
  batchUpsert,
  errMsg,
  capMsg,
  emitPostHog,
  triggerAnalyticsDeploy,
  alertDiscord,
} from '@/lib/sync-utils';
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
  profile_metadata_hash: string | null;
}

/* ─── Serializable types for Inngest step data passing ─── */

/** Serialized proposal context entry (Map can't be serialized between steps) */
export interface SerializedProposalContext {
  key: string; // `${txHash}-${index}`
  proposalType: string;
  treasuryTier: string | null;
}

/** Result of phase 1: fetch + classify proposals */
export interface FetchProposalsResult {
  classifiedProposals: ClassifiedProposal[];
  proposalContextEntries: SerializedProposalContext[];
  errors: string[];
  durationMs: number;
}

/** Serialized DRep data for passing between steps */
export interface SerializedDRep {
  drepId: string;
  drepHash: string;
  handle: string | null;
  name: string | null;
  ticker: string | null;
  description: string | null;
  votingPower: number;
  votingPowerLovelace: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  abstainVotes: number;
  isActive: boolean;
  anchorUrl: string | null;
  anchorHash: string | null;
  epochVoteCounts: number[] | null;
  metadata: Record<string, unknown>;
  drepScore: number;
  participationRate: number;
  rationaleRate: number;
  reliabilityScore: number;
  reliabilityStreak: number;
  reliabilityRecency: number;
  reliabilityLongestGap: number;
  reliabilityTenure: number;
  deliberationModifier: number;
  effectiveParticipation: number;
  sizeTier: string;
  profileCompleteness: number;
}

/** Result of phase 2: fetch + enrich DReps */
export interface FetchDRepsResult {
  dreps: SerializedDRep[];
  rawVotesMap: Record<string, DRepVote[]> | null;
  handlesResolved: number;
  delegatorCounts: Record<string, number>;
  errors: string[];
  durationMs: number;
}

/** Result of phase 3: upsert DReps to DB */
export interface UpsertDRepsResult {
  success: number;
  errors: number;
  durationMs: number;
}

/** Result of phase 4: alignment + snapshots + score history */
export interface PostSyncResult {
  alignmentComputed: boolean;
  delegationSnapshotsInserted: number;
  scoreHistoryInserted: number;
  errors: string[];
  durationMs: number;
}

/* ─── Phase functions (each designed to run in < 60s) ─── */

/**
 * Phase 1: Fetch proposals from Koios and classify them for scoring context.
 * Non-fatal — returns empty results on failure.
 */
export async function phaseFetchProposals(): Promise<FetchProposalsResult> {
  const start = Date.now();
  const errors: string[] = [];
  let classifiedProposals: ClassifiedProposal[] = [];
  const proposalContextEntries: SerializedProposalContext[] = [];

  try {
    const raw = await fetchProposals();
    const { valid: validRaw, invalidCount } = validateArray(
      raw,
      KoiosProposalSchema,
      'dreps-proposals',
    );
    if (invalidCount > 0) {
      emitPostHog(true, 'dreps', 0, {
        event_override: 'sync_validation_error',
        record_type: 'proposal',
        invalid_count: invalidCount,
      });
      alertDiscord(
        'Validation Errors: dreps',
        `${invalidCount} proposal records failed Zod validation during DReps sync`,
      );
    }
    if (validRaw.length > 0) {
      classifiedProposals = classifyProposals(validRaw as unknown as ProposalListResponse);
      for (const p of classifiedProposals) {
        proposalContextEntries.push({
          key: `${p.txHash}-${p.index}`,
          proposalType: p.type,
          treasuryTier: p.treasuryTier,
        });
      }
    }
    log.info('[dreps] Proposals fetched and classified', {
      fetched: raw.length,
      classified: classifiedProposals.length,
    });
  } catch (err) {
    errors.push(`Proposals: ${errMsg(err)}`);
    log.warn('[dreps] Proposal fetch failed (non-fatal)', { error: errMsg(err) });
  }

  return {
    classifiedProposals,
    proposalContextEntries,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Phase 2: Fetch enriched DReps from Koios, resolve ADA handles, read existing delegator counts.
 * Fatal if no DRep data is returned.
 */
export async function phaseFetchDReps(
  proposalContextEntries: SerializedProposalContext[],
): Promise<FetchDRepsResult> {
  const start = Date.now();
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  // Rebuild proposalContextMap from serialized entries
  const proposalContextMap = new Map<string, ProposalContext>();
  for (const entry of proposalContextEntries) {
    proposalContextMap.set(entry.key, {
      proposalType: entry.proposalType,
      treasuryTier: entry.treasuryTier,
    });
  }

  // Fetch enriched DReps (fatal if no data)
  const result = await getEnrichedDReps(false, {
    includeRawVotes: true,
    proposalContextMap: proposalContextMap.size > 0 ? proposalContextMap : undefined,
  });

  if (result.error || !result.allDReps?.length) {
    throw new Error('Koios DRep fetch returned no data');
  }

  const allDReps = result.allDReps;
  const rawVotesMap = (result.rawVotesMap as Record<string, DRepVote[]>) || null;
  log.info('[dreps] Enriched DReps', { count: allDReps.length });

  // ADA Handle resolution (non-fatal)
  let handlesResolved = 0;
  try {
    const handleMap = await resolveADAHandles(
      allDReps.map((d) => ({ drepId: d.drepId, drepHash: d.drepHash })),
    );
    for (const drep of allDReps) {
      const handle = handleMap.get(drep.drepId);
      if (handle) (drep as unknown as Record<string, unknown>).handle = handle;
    }
    handlesResolved = handleMap.size;
    log.info('[dreps] ADA Handles resolved', {
      resolved: handlesResolved,
      total: allDReps.length,
    });
  } catch (err) {
    errors.push(`ADA Handles: ${errMsg(err)}`);
    log.warn('[dreps] ADA Handle resolution failed (non-fatal)', { error: errMsg(err) });
  }

  // Read existing delegator counts from DB
  const delegatorCounts: Record<string, number> = {};
  try {
    const { data: existing } = await supabase.from('dreps').select('id, info');
    for (const row of existing || []) {
      const info = row.info as Record<string, unknown> | null;
      const count = (info?.delegatorCount as number) || 0;
      delegatorCounts[row.id] = count;
    }
    log.info('[dreps] Preserved existing delegator counts', {
      count: Object.keys(delegatorCounts).length,
    });
  } catch (err) {
    log.warn('[dreps] Could not read existing delegator counts', { error: errMsg(err) });
  }

  // Serialize DReps for step transfer
  const serializedDreps: SerializedDRep[] = allDReps.map((drep) => ({
    drepId: drep.drepId,
    drepHash: drep.drepHash,
    handle: ((drep as unknown as Record<string, unknown>).handle as string | null) ?? null,
    name: drep.name,
    ticker: drep.ticker,
    description: drep.description,
    votingPower: drep.votingPower,
    votingPowerLovelace: drep.votingPowerLovelace,
    totalVotes: drep.totalVotes,
    yesVotes: drep.yesVotes,
    noVotes: drep.noVotes,
    abstainVotes: drep.abstainVotes,
    isActive: drep.isActive,
    anchorUrl: drep.anchorUrl || null,
    anchorHash: drep.anchorHash || null,
    epochVoteCounts: drep.epochVoteCounts || null,
    metadata: (drep.metadata as Record<string, unknown>) || {},
    drepScore: drep.drepScore,
    participationRate: drep.participationRate,
    rationaleRate: drep.rationaleRate,
    reliabilityScore: drep.reliabilityScore,
    reliabilityStreak: drep.reliabilityStreak,
    reliabilityRecency: drep.reliabilityRecency,
    reliabilityLongestGap: drep.reliabilityLongestGap,
    reliabilityTenure: drep.reliabilityTenure,
    deliberationModifier: drep.deliberationModifier,
    effectiveParticipation: drep.effectiveParticipation,
    sizeTier: drep.sizeTier,
    profileCompleteness: drep.profileCompleteness,
  }));

  return {
    dreps: serializedDreps,
    rawVotesMap,
    handlesResolved,
    delegatorCounts,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Phase 3: Upsert DRep rows to Supabase.
 */
export async function phaseUpsertDReps(
  dreps: SerializedDRep[],
  delegatorCounts: Record<string, number>,
): Promise<UpsertDRepsResult> {
  const start = Date.now();
  const supabase = getSupabaseAdmin();

  // Load existing profile_metadata_hash values to detect changes
  const existingHashes = new Map<string, string | null>();
  try {
    const { data: hashRows } = await supabase
      .from('dreps')
      .select('id, profile_metadata_hash')
      .range(0, 99999);
    for (const row of hashRows || []) {
      existingHashes.set(row.id, row.profile_metadata_hash);
    }
  } catch (err) {
    log.warn('[dreps] Could not read existing profile_metadata_hash values', {
      error: errMsg(err),
    });
  }

  const now = new Date().toISOString();

  // Track which DReps had their metadata hash change
  const hashChangedIds: string[] = [];

  const drepRows: SupabaseDRepRow[] = dreps.map((drep) => {
    const currentHash = drep.anchorHash || null;
    const storedHash = existingHashes.get(drep.drepId) ?? null;

    // Detect metadata hash change (case-insensitive comparison)
    const hashChanged =
      currentHash != null &&
      (storedHash == null || currentHash.toLowerCase() !== storedHash.toLowerCase());

    if (hashChanged) hashChangedIds.push(drep.drepId);

    return {
      id: drep.drepId,
      metadata: drep.metadata || {},
      info: {
        drepHash: drep.drepHash,
        handle: drep.handle,
        name: drep.name,
        ticker: drep.ticker,
        description: drep.description,
        votingPower: drep.votingPower,
        votingPowerLovelace: drep.votingPowerLovelace,
        delegatorCount: delegatorCounts[drep.drepId] ?? 0,
        totalVotes: drep.totalVotes,
        yesVotes: drep.yesVotes,
        noVotes: drep.noVotes,
        abstainVotes: drep.abstainVotes,
        isActive: drep.isActive,
        anchorUrl: drep.anchorUrl,
        epochVoteCounts: drep.epochVoteCounts,
      },
      votes: [],
      score: drep.drepScore,
      participation_rate: drep.participationRate,
      rationale_rate: drep.rationaleRate,
      reliability_score: drep.reliabilityScore,
      reliability_streak: drep.reliabilityStreak,
      reliability_recency: drep.reliabilityRecency,
      reliability_longest_gap: drep.reliabilityLongestGap,
      reliability_tenure: drep.reliabilityTenure,
      deliberation_modifier: drep.deliberationModifier,
      effective_participation: drep.effectiveParticipation,
      size_tier: drep.sizeTier,
      profile_completeness: drep.profileCompleteness,
      anchor_url: drep.anchorUrl || null,
      anchor_hash: drep.anchorHash || null,
      profile_metadata_hash: currentHash,
    };
  });

  const drepResult = await batchUpsert(
    supabase,
    'dreps',
    drepRows as unknown as Record<string, unknown>[],
    'id',
    'DReps',
  );
  log.info('[dreps] Upserted DReps', { success: drepResult.success, errors: drepResult.errors });

  // Update profile_last_changed_at only for DReps whose metadata hash changed
  if (hashChangedIds.length > 0) {
    try {
      // Batch update in groups of 100
      for (let i = 0; i < hashChangedIds.length; i += 100) {
        const batch = hashChangedIds.slice(i, i + 100);
        await supabase.from('dreps').update({ profile_last_changed_at: now }).in('id', batch);
      }
      log.info('[dreps] Updated profile_last_changed_at for hash changes', {
        count: hashChangedIds.length,
      });
    } catch (err) {
      log.warn('[dreps] Failed to update profile_last_changed_at', { error: errMsg(err) });
    }
  }

  return {
    success: drepResult.success,
    errors: drepResult.errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Phase 4: Alignment scores, delegation snapshots, and score history.
 * All three run in parallel within this phase. Each sub-task is non-fatal.
 */
export async function phasePostSync(
  dreps: SerializedDRep[],
  rawVotesMap: Record<string, DRepVote[]> | null,
  classifiedProposals: ClassifiedProposal[],
  delegatorCounts: Record<string, number>,
): Promise<PostSyncResult> {
  const start = Date.now();
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  let alignmentComputed = false;
  let delegationSnapshotsInserted = 0;
  let scoreHistoryInserted = 0;

  const parallelResults = await Promise.allSettled([
    // Alignment scores
    (async () => {
      if (!rawVotesMap || classifiedProposals.length === 0) return;
      const updates = dreps.map((drep) => {
        const votes = rawVotesMap[drep.drepId] || [];
        // computeAllCategoryScores expects the enriched DRep format
        const drepObj = {
          drepId: drep.drepId,
          drepHash: drep.drepHash,
          handle: drep.handle,
          name: drep.name,
          ticker: drep.ticker,
          description: drep.description,
          votingPower: drep.votingPower,
          votingPowerLovelace: drep.votingPowerLovelace,
          totalVotes: drep.totalVotes,
          yesVotes: drep.yesVotes,
          noVotes: drep.noVotes,
          abstainVotes: drep.abstainVotes,
          isActive: drep.isActive,
          anchorUrl: drep.anchorUrl,
          anchorHash: drep.anchorHash,
          epochVoteCounts: drep.epochVoteCounts,
          metadata: drep.metadata,
          drepScore: drep.drepScore,
          participationRate: drep.participationRate,
          rationaleRate: drep.rationaleRate,
          reliabilityScore: drep.reliabilityScore,
          reliabilityStreak: drep.reliabilityStreak,
          reliabilityRecency: drep.reliabilityRecency,
          reliabilityLongestGap: drep.reliabilityLongestGap,
          reliabilityTenure: drep.reliabilityTenure,
          deliberationModifier: drep.deliberationModifier,
          effectiveParticipation: drep.effectiveParticipation,
          sizeTier: drep.sizeTier,
          profileCompleteness: drep.profileCompleteness,
        };
        const scores = computeAllCategoryScores(
          drepObj as unknown as EnrichedDRep,
          votes,
          classifiedProposals,
        );
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
      const r = await batchUpsert(
        supabase,
        'dreps',
        updates as unknown as Record<string, unknown>[],
        'id',
        'Alignment',
      );
      alignmentComputed = true;
      log.info('[dreps] Alignment scores computed', { count: r.success });
    })(),

    // Delegation snapshots
    (async () => {
      try {
        const { data: statsRow } = await supabase
          .from('governance_stats')
          .select('current_epoch')
          .eq('id', 1)
          .single();
        const epoch = statsRow?.current_epoch ?? 0;
        if (epoch === 0) return;

        const snapshots = dreps.map((drep) => ({
          epoch,
          drep_id: drep.drepId,
          delegator_count: delegatorCounts[drep.drepId] ?? 0,
          total_power_lovelace: BigInt(drep.votingPowerLovelace || '0').toString(),
          snapshot_at: new Date().toISOString(),
        }));

        let inserted = 0;
        for (let i = 0; i < snapshots.length; i += 100) {
          const batch = snapshots.slice(i, i + 100);
          const { error } = await supabase
            .from('delegation_snapshots')
            .upsert(batch as unknown as Record<string, unknown>[], {
              onConflict: 'epoch,drep_id',
            });
          if (!error) inserted += batch.length;
        }
        delegationSnapshotsInserted = inserted;
        if (inserted > 0) {
          log.info('[dreps] Delegation snapshots', { inserted, epoch });
        }
      } catch (err) {
        log.warn('[dreps] Delegation snapshot failed (non-fatal)', { error: errMsg(err) });
      }
    })(),

    // Score history snapshot
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const historyRows = dreps.map((drep) => ({
        drep_id: drep.drepId,
        score: drep.drepScore,
        effective_participation: drep.effectiveParticipation,
        rationale_rate: drep.rationaleRate,
        reliability_score: drep.reliabilityScore,
        profile_completeness: drep.profileCompleteness,
        snapshot_date: today,
      }));
      const r = await batchUpsert(
        supabase,
        'drep_score_history',
        historyRows as unknown as Record<string, unknown>[],
        'drep_id,snapshot_date',
        'Score history',
      );
      scoreHistoryInserted = r.success;
      if (r.success > 0)
        log.info('[dreps] Score history snapshots', { count: r.success, date: today });
    })(),
  ]);

  for (const r of parallelResults) {
    if (r.status === 'rejected') {
      const msg = errMsg(r.reason);
      errors.push(`Parallel: ${msg}`);
      log.error('[dreps] Parallel step error', { error: msg });
    }
  }

  return {
    alignmentComputed,
    delegationSnapshotsInserted,
    scoreHistoryInserted,
    errors,
    durationMs: Date.now() - start,
  };
}

/**
 * Phase 5: Finalize sync — write sync_log, emit analytics, trigger deploy.
 */
export async function phaseFinalize(
  syncLogId: number | null,
  startTime: number,
  upsertResult: UpsertDRepsResult,
  handlesResolved: number,
  allErrors: string[],
  phaseTiming: Record<string, number>,
): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();

  const totalErrors = upsertResult.errors;
  const totalRows = upsertResult.success + totalErrors;
  const errorRate = totalRows > 0 ? totalErrors / totalRows : 0;
  const finalErrors = [...allErrors];

  if (totalErrors > 0) {
    finalErrors.push(`Upsert errors: ${totalErrors} dreps (${(errorRate * 100).toFixed(1)}% rate)`);
  }

  const success = errorRate < 0.05 && finalErrors.length === 0;
  const elapsed = Date.now() - startTime;
  const duration = (elapsed / 1000).toFixed(1);

  log.info('[dreps] Sync complete', {
    durationSeconds: duration,
    synced: upsertResult.success,
    issues: finalErrors.length,
  });

  const metrics = {
    dreps_synced: upsertResult.success,
    drep_errors: upsertResult.errors,
    handles_resolved: handlesResolved,
    ...phaseTiming,
    ...getKoiosMetrics(),
  };

  // Finalize sync_log (write directly to avoid SyncLogger startTime mismatch)
  if (syncLogId) {
    try {
      await supabase
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: elapsed,
          success,
          error_message: finalErrors.length > 0 ? capMsg(finalErrors.join('; ')) : null,
          metrics,
        })
        .eq('id', syncLogId);
    } catch (_e) {
      log.warn('[dreps] sync_log finalize failed', { error: errMsg(_e) });
    }
  }

  await emitPostHog(success, 'dreps', elapsed, metrics);
  triggerAnalyticsDeploy('dreps');

  return {
    success,
    dreps: { synced: upsertResult.success, errors: upsertResult.errors },
    handlesResolved,
    durationSeconds: duration,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Core DReps sync logic — callable from both Inngest and the HTTP route.
 * Throws on fatal errors (Inngest retries); returns result on success/degraded.
 */
export async function executeDrepsSync(): Promise<Record<string, unknown>> {
  const supabase = getSupabaseAdmin();
  const syncLog = new SyncLogger(supabase, 'dreps');
  await syncLog.start();
  resetKoiosMetrics();

  const startTime = Date.now();
  const allErrors: string[] = [];
  const phaseTiming: Record<string, number> = {};

  try {
    // Phase 1: Fetch proposals
    const proposalResult = await phaseFetchProposals();
    allErrors.push(...proposalResult.errors);
    phaseTiming.step1_proposals_ms = proposalResult.durationMs;

    // Phase 2: Fetch + enrich DReps
    const drepData = await phaseFetchDReps(proposalResult.proposalContextEntries);
    allErrors.push(...drepData.errors);
    phaseTiming.step2_enrich_ms = drepData.durationMs;

    // Phase 3: Upsert DReps
    const upsertResult = await phaseUpsertDReps(drepData.dreps, drepData.delegatorCounts);
    phaseTiming.step4_upsert_ms = upsertResult.durationMs;

    // Phase 4: Post-sync (alignment, snapshots, score history)
    const postSyncResult = await phasePostSync(
      drepData.dreps,
      drepData.rawVotesMap,
      proposalResult.classifiedProposals,
      drepData.delegatorCounts,
    );
    allErrors.push(...postSyncResult.errors);
    phaseTiming.step56_parallel_ms = postSyncResult.durationMs;

    // Phase 5: Finalize
    return await phaseFinalize(
      syncLog.id,
      startTime,
      upsertResult,
      drepData.handlesResolved,
      allErrors,
      phaseTiming,
    );
  } catch (outerErr) {
    const msg = errMsg(outerErr);
    allErrors.push(`Fatal: ${msg}`);
    log.error('[dreps] Fatal error', { error: msg });
    await syncLog.finalize(false, allErrors.join('; '), phaseTiming);
    throw outerErr;
  }
}
