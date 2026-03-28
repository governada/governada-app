/**
 * Reconciliation Comparator Engine
 *
 * Compares Governada's Supabase data against Blockfrost cross-reference data.
 * Tolerance-based matching with configurable thresholds per metric.
 */

import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import * as blockfrost from './blockfrost';
import {
  type CheckResult,
  type CheckStatus,
  type ReconciliationReport,
  type ToleranceConfig,
  DEFAULT_TOLERANCES,
} from './types';

// ---------------------------------------------------------------------------
// Comparison helpers
// ---------------------------------------------------------------------------

function compareCount(
  metric: string,
  tier: 1 | 2,
  ours: number,
  theirs: number,
  tolerance: ToleranceConfig,
): CheckResult {
  const diff = Math.abs(ours - theirs);
  let status: CheckStatus = 'match';
  let detail: string | undefined;

  // Check absolute tolerance
  if (tolerance.countAbsolute !== undefined) {
    if (diff > tolerance.countAbsolute) {
      // Check if it's a drift (within 2x tolerance) or mismatch (beyond)
      status = diff > tolerance.countAbsolute * 3 ? 'mismatch' : 'drift';
      detail = `Ours: ${ours}, Theirs: ${theirs}, Diff: ${diff}`;
    }
  }

  // Check relative tolerance
  if (tolerance.percentRelative !== undefined && theirs > 0) {
    const pctDiff = diff / theirs;
    if (pctDiff > tolerance.percentRelative) {
      const newStatus: CheckStatus = pctDiff > tolerance.percentRelative * 3 ? 'mismatch' : 'drift';
      if (newStatus === 'mismatch' || (newStatus === 'drift' && status === 'match')) {
        status = newStatus;
        detail = `Ours: ${ours}, Theirs: ${theirs}, Diff: ${(pctDiff * 100).toFixed(2)}%`;
      }
    }
  }

  return {
    metric,
    tier,
    ours,
    theirs,
    status,
    detail,
    tolerance: JSON.stringify(tolerance),
  };
}

function compareSet(
  metric: string,
  tier: 1 | 2,
  ours: string[],
  theirs: string[],
  tolerance: ToleranceConfig,
): CheckResult {
  const oursSet = new Set(ours);
  const theirsSet = new Set(theirs);
  const missing = theirs.filter((id) => !oursSet.has(id));
  const extra = ours.filter((id) => !theirsSet.has(id));
  const diffCount = missing.length + extra.length;

  let status: CheckStatus = 'match';
  let detail: string | undefined;

  if (diffCount > (tolerance.setDiffMax ?? 0)) {
    status = diffCount > (tolerance.setDiffMax ?? 0) * 3 + 1 ? 'mismatch' : 'drift';
    const parts: string[] = [];
    if (missing.length > 0)
      parts.push(
        `Missing: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}`,
      );
    if (extra.length > 0)
      parts.push(
        `Extra: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? ` (+${extra.length - 5} more)` : ''}`,
      );
    detail = parts.join('; ');
  }

  return {
    metric,
    tier,
    ours: ours.slice(0, 10),
    theirs: theirs.slice(0, 10),
    status,
    detail,
    tolerance: JSON.stringify(tolerance),
  };
}

// ---------------------------------------------------------------------------
// Tier 1 checks: Critical
// ---------------------------------------------------------------------------

async function checkTier1(): Promise<CheckResult[]> {
  const supabase = createClient();
  const results: CheckResult[] = [];

  // Run Blockfrost fetches in parallel
  const [bfDReps, bfProposals, bfEpoch, bfNetwork, bfCommittee] = await Promise.all([
    blockfrost.fetchDReps().catch((e) => {
      logger.error(`[Reconcile] Blockfrost DReps fetch failed: ${e.message}`);
      return null;
    }),
    blockfrost.fetchProposals().catch((e) => {
      logger.error(`[Reconcile] Blockfrost proposals fetch failed: ${e.message}`);
      return null;
    }),
    blockfrost.fetchLatestEpoch().catch((e) => {
      logger.error(`[Reconcile] Blockfrost epoch fetch failed: ${e.message}`);
      return null;
    }),
    blockfrost.fetchNetwork().catch((e) => {
      logger.error(`[Reconcile] Blockfrost network fetch failed: ${e.message}`);
      return null;
    }),
    blockfrost.fetchCommittee().catch((e) => {
      logger.error(`[Reconcile] Blockfrost committee fetch failed: ${e.message}`);
      return null;
    }),
  ]);

  // Read our Supabase data in parallel
  const [drepCount, proposalCount, epochData, treasuryData, ccData] = await Promise.all([
    supabase.from('dreps').select('id', { count: 'exact', head: true }),
    supabase.from('proposals').select('tx_hash', { count: 'exact', head: true }),
    supabase.from('governance_stats').select('current_epoch').eq('id', 1).single(),
    supabase
      .from('treasury_snapshots')
      .select('balance_lovelace')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('committee_info')
      .select('hot_address, cold_address, status')
      .eq('status', 'active'),
  ]);

  // --- Total DReps ---
  if (bfDReps) {
    const ourCount = drepCount.count ?? 0;
    const theirCount = bfDReps.length;
    results.push(
      compareCount('Total registered DReps', 1, ourCount, theirCount, DEFAULT_TOLERANCES.drepCount),
    );

    // Active DReps (not retired, not expired)
    const theirActive = bfDReps.filter((d) => d.active && !d.retired && !d.expired).length;
    const { count: ourActive } = await supabase
      .from('dreps')
      .select('id', { count: 'exact', head: true })
      .not('info->isActive', 'eq', false);
    results.push(
      compareCount(
        'Total active DReps',
        1,
        ourActive ?? 0,
        theirActive,
        DEFAULT_TOLERANCES.drepCount,
      ),
    );
  }

  // --- Total proposals ---
  if (bfProposals) {
    const ourCount = proposalCount.count ?? 0;
    const theirCount = bfProposals.length;
    results.push(
      compareCount('Total proposals', 1, ourCount, theirCount, DEFAULT_TOLERANCES.proposalCount),
    );

    // Active proposals (not expired/ratified/enacted/dropped)
    const theirActive = bfProposals.filter(
      (p) => !p.ratified_epoch && !p.enacted_epoch && !p.dropped_epoch && !p.expired_epoch,
    ).length;
    const { count: ourActiveProposals } = await supabase
      .from('proposals')
      .select('tx_hash', { count: 'exact', head: true })
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null);
    results.push(
      compareCount(
        'Active proposals',
        1,
        ourActiveProposals ?? 0,
        theirActive,
        DEFAULT_TOLERANCES.proposalCount,
      ),
    );
  }

  // --- Current epoch ---
  if (bfEpoch) {
    const ourEpoch = epochData.data?.current_epoch ?? 0;
    results.push(
      compareCount('Current epoch', 1, ourEpoch, bfEpoch.epoch, DEFAULT_TOLERANCES.epoch),
    );
  }

  // --- Treasury balance ---
  if (bfNetwork) {
    const ourTreasury = Number(treasuryData.data?.balance_lovelace ?? 0);
    const theirTreasury = Number(bfNetwork.supply.treasury);
    results.push(
      compareCount(
        'Treasury balance (lovelace)',
        1,
        ourTreasury,
        theirTreasury,
        DEFAULT_TOLERANCES.treasuryBalance,
      ),
    );
  }

  // --- CC members ---
  if (bfCommittee) {
    const theirMembers = bfCommittee.members
      .filter((m) => m.status === 'active')
      .map((m) => m.cold_key)
      .sort();
    const ourMembers = (ccData.data ?? [])
      .map((m: { cold_address: string }) => m.cold_address)
      .sort();
    results.push(
      compareSet('CC members (active)', 1, ourMembers, theirMembers, DEFAULT_TOLERANCES.ccMembers),
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// Tier 2 checks: High Priority
// ---------------------------------------------------------------------------

async function checkTier2(): Promise<CheckResult[]> {
  const supabase = createClient();
  const results: CheckResult[] = [];

  // --- Per-proposal vote counts (sample active proposals) ---
  const { data: activeProposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index')
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .order('block_time', { ascending: false })
    .limit(10);

  if (activeProposals && activeProposals.length > 0) {
    // Check vote counts for up to 5 proposals
    const sampled = activeProposals.slice(0, 5);
    for (const proposal of sampled) {
      try {
        const bfVotes = await blockfrost.fetchProposalVotes(
          proposal.tx_hash,
          proposal.proposal_index,
        );
        const { count: ourVoteCount } = await supabase
          .from('drep_votes')
          .select('vote_tx_hash', { count: 'exact', head: true })
          .eq('proposal_tx_hash', proposal.tx_hash)
          .eq('proposal_index', proposal.proposal_index);

        // Blockfrost returns all voter types; filter to DReps only for fair comparison
        const bfDrepVotes = bfVotes.filter((v) => v.voter_role === 'drep');
        results.push(
          compareCount(
            `Vote count: ${proposal.tx_hash.slice(0, 8)}...#${proposal.proposal_index}`,
            2,
            ourVoteCount ?? 0,
            bfDrepVotes.length,
            DEFAULT_TOLERANCES.voteCounts,
          ),
        );
      } catch (e) {
        logger.warn(
          `[Reconcile] Failed to check votes for ${proposal.tx_hash}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  // --- Top DRep voting power spot-check ---
  const { data: topDReps } = await supabase
    .from('dreps')
    .select('id, info')
    .not('info->votingPower', 'is', null)
    .order('score', { ascending: false })
    .limit(20);

  if (topDReps) {
    // Sample 10 of the top 20 DReps
    const sampled = topDReps.slice(0, 10);
    for (const drep of sampled) {
      try {
        const bfDrep = await blockfrost.fetchDRepDetail(drep.id);
        const ourPower = Number((drep.info as Record<string, unknown>)?.votingPower ?? 0);
        const theirPower = Number(bfDrep.amount ?? 0);

        results.push(
          compareCount(
            `DRep power: ${drep.id.slice(0, 12)}...`,
            2,
            ourPower,
            theirPower,
            DEFAULT_TOLERANCES.votingPower,
          ),
        );

        // Also check registration status
        const ourActive = (drep.info as Record<string, unknown>)?.isActive !== false;
        const theirActive = bfDrep.active && !bfDrep.retired && !bfDrep.expired;
        if (ourActive !== theirActive) {
          results.push({
            metric: `DRep status: ${drep.id.slice(0, 12)}...`,
            tier: 2,
            ours: ourActive ? 'active' : 'inactive',
            theirs: theirActive ? 'active' : 'inactive',
            status: 'mismatch',
            detail: `Our: ${ourActive ? 'active' : 'inactive'}, Theirs: ${theirActive ? 'active' : 'inactive'}`,
          });
        }
      } catch (e) {
        logger.warn(
          `[Reconcile] Failed to check DRep ${drep.id}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runReconciliation(
  options: {
    tier1?: boolean;
    tier2?: boolean;
  } = {},
): Promise<ReconciliationReport> {
  const { tier1 = true, tier2 = true } = options;
  const startTime = Date.now();

  blockfrost.resetBlockfrostMetrics();

  const results: CheckResult[] = [];

  if (tier1) {
    const t1 = await checkTier1();
    results.push(...t1);
  }

  if (tier2) {
    const t2 = await checkTier2();
    results.push(...t2);
  }

  const mismatches = results.filter((r) => r.status !== 'match');
  const hasMismatch = mismatches.some((r) => r.status === 'mismatch');
  const hasDrift = mismatches.some((r) => r.status === 'drift');

  const overallStatus: CheckStatus = hasMismatch ? 'mismatch' : hasDrift ? 'drift' : 'match';

  const report: ReconciliationReport = {
    checkedAt: new Date().toISOString(),
    source: 'blockfrost',
    overallStatus,
    results,
    mismatches,
    durationMs: Date.now() - startTime,
  };

  logger.info(
    `[Reconcile] Completed: ${overallStatus} (${results.length} checks, ${mismatches.length} issues, ${report.durationMs}ms)`,
    blockfrost.getBlockfrostMetrics(),
  );

  return report;
}
