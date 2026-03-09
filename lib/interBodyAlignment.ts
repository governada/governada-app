/**
 * Inter-Body Alignment — analyzes voting alignment across DReps, SPOs, and CC members.
 * Computes per-proposal tri-body breakdown and system-wide alignment metrics.
 */

import { getSupabaseAdmin, createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface ProposalAlignment {
  proposalTxHash: string;
  proposalIndex: number;
  drep: { yes: number; no: number; abstain: number; total: number; yesPct: number; noPct: number };
  spo: { yes: number; no: number; abstain: number; total: number; yesPct: number; noPct: number };
  cc: { yes: number; no: number; abstain: number; total: number; yesPct: number; noPct: number };
  bodiesVoting: number;
  alignmentScore: number;
}

export interface SystemAlignment {
  proposalCount: number;
  avgAlignmentScore: number;
  drepSpoAgreement: number;
  drepCcAgreement: number;
  spoCcAgreement: number;
  byProposalType: Record<string, { count: number; avgAlignment: number }>;
}

function votePcts(votes: Array<{ vote: string }>): {
  yes: number;
  no: number;
  abstain: number;
  total: number;
  yesPct: number;
  noPct: number;
} {
  const yes = votes.filter((v) => v.vote === 'Yes').length;
  const no = votes.filter((v) => v.vote === 'No').length;
  const abstain = votes.filter((v) => v.vote === 'Abstain').length;
  const total = votes.length;
  return {
    yes,
    no,
    abstain,
    total,
    yesPct: total > 0 ? (yes / total) * 100 : 0,
    noPct: total > 0 ? (no / total) * 100 : 0,
  };
}

/**
 * Compute alignment score between two bodies' yes/no percentages.
 * 100 = identical, 0 = completely opposite.
 */
function pairwiseAlignment(
  a: { yesPct: number; noPct: number },
  b: { yesPct: number; noPct: number },
): number {
  const diff = Math.abs(a.yesPct - b.yesPct) + Math.abs(a.noPct - b.noPct);
  return Math.max(0, 100 - diff / 2);
}

export async function computeInterBodyAlignment(
  proposalTxHash: string,
  proposalIndex: number,
): Promise<ProposalAlignment> {
  const supabase = createClient();

  const [drepResult, spoResult, ccResult] = await Promise.all([
    supabase
      .from('drep_votes')
      .select('vote')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex),
    supabase
      .from('spo_votes')
      .select('vote')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex),
    supabase
      .from('cc_votes')
      .select('vote')
      .eq('proposal_tx_hash', proposalTxHash)
      .eq('proposal_index', proposalIndex),
  ]);

  const drep = votePcts(drepResult.data || []);
  const spo = votePcts(spoResult.data || []);
  const cc = votePcts(ccResult.data || []);

  const bodiesVoting = [drep, spo, cc].filter((b) => b.total > 0).length;

  let alignmentScore = 100;
  if (bodiesVoting >= 2) {
    const pairs: number[] = [];
    if (drep.total > 0 && spo.total > 0) pairs.push(pairwiseAlignment(drep, spo));
    if (drep.total > 0 && cc.total > 0) pairs.push(pairwiseAlignment(drep, cc));
    if (spo.total > 0 && cc.total > 0) pairs.push(pairwiseAlignment(spo, cc));
    alignmentScore = Math.round(pairs.reduce((s, p) => s + p, 0) / pairs.length);
  }

  return {
    proposalTxHash,
    proposalIndex,
    drep,
    spo,
    cc,
    bodiesVoting,
    alignmentScore,
  };
}

/**
 * Compute alignment for all proposals that have votes from 2+ bodies.
 * Reads from the inter_body_alignment cache if available,
 * otherwise computes from raw vote tables.
 */
export async function getSystemAlignment(): Promise<SystemAlignment> {
  const supabase = createClient();

  const { data: cached } = await supabase
    .from('inter_body_alignment')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1000);

  if (!cached || cached.length === 0) {
    return {
      proposalCount: 0,
      avgAlignmentScore: 0,
      drepSpoAgreement: 0,
      drepCcAgreement: 0,
      spoCcAgreement: 0,
      byProposalType: {},
    };
  }

  const { data: proposals } = await supabase
    .from('proposals')
    .select('tx_hash, proposal_index, proposal_type')
    .limit(500);

  const typeMap = new Map(
    (proposals || []).map((p) => [`${p.tx_hash}-${p.proposal_index}`, p.proposal_type]),
  );

  let totalAlignment = 0;
  let drepSpoSum = 0;
  let drepSpoCount = 0;
  let drepCcSum = 0;
  let drepCcCount = 0;
  let spoCcSum = 0;
  let spoCcCount = 0;
  const byType: Record<string, { totalAlignment: number; count: number }> = {};

  for (const row of cached) {
    totalAlignment += row.alignment_score ?? 0;

    const hasDrep = (row.drep_yes_pct ?? 0) + (row.drep_no_pct ?? 0) > 0;
    const hasSpo = (row.spo_yes_pct ?? 0) + (row.spo_no_pct ?? 0) > 0;
    const hasCc = (row.cc_yes_pct ?? 0) + (row.cc_no_pct ?? 0) > 0;

    if (hasDrep && hasSpo) {
      drepSpoSum += pairwiseAlignment(
        { yesPct: row.drep_yes_pct, noPct: row.drep_no_pct },
        { yesPct: row.spo_yes_pct, noPct: row.spo_no_pct },
      );
      drepSpoCount++;
    }
    if (hasDrep && hasCc) {
      drepCcSum += pairwiseAlignment(
        { yesPct: row.drep_yes_pct, noPct: row.drep_no_pct },
        { yesPct: row.cc_yes_pct, noPct: row.cc_no_pct },
      );
      drepCcCount++;
    }
    if (hasSpo && hasCc) {
      spoCcSum += pairwiseAlignment(
        { yesPct: row.spo_yes_pct, noPct: row.spo_no_pct },
        { yesPct: row.cc_yes_pct, noPct: row.cc_no_pct },
      );
      spoCcCount++;
    }

    const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
    const pType = typeMap.get(key) || 'Unknown';
    if (!byType[pType]) byType[pType] = { totalAlignment: 0, count: 0 };
    byType[pType].totalAlignment += row.alignment_score ?? 0;
    byType[pType].count++;
  }

  return {
    proposalCount: cached.length,
    avgAlignmentScore: Math.round(totalAlignment / cached.length),
    drepSpoAgreement: drepSpoCount > 0 ? Math.round(drepSpoSum / drepSpoCount) : 0,
    drepCcAgreement: drepCcCount > 0 ? Math.round(drepCcSum / drepCcCount) : 0,
    spoCcAgreement: spoCcCount > 0 ? Math.round(spoCcSum / spoCcCount) : 0,
    byProposalType: Object.fromEntries(
      Object.entries(byType).map(([type, { totalAlignment: t, count }]) => [
        type,
        { count, avgAlignment: Math.round(t / count) },
      ]),
    ),
  };
}

/**
 * Batch compute and cache inter-body alignment for all proposals with 2+ body votes.
 * Called from sync pipeline.
 */
export async function computeAndCacheAlignment(): Promise<number> {
  const supabase = getSupabaseAdmin();

  const [spoProposals, ccProposals] = await Promise.all([
    supabase.from('spo_votes').select('proposal_tx_hash, proposal_index').limit(10000),
    supabase.from('cc_votes').select('proposal_tx_hash, proposal_index').limit(10000),
  ]);

  const proposalKeys = new Set<string>();
  for (const v of spoProposals.data || []) {
    proposalKeys.add(`${v.proposal_tx_hash}-${v.proposal_index}`);
  }
  for (const v of ccProposals.data || []) {
    proposalKeys.add(`${v.proposal_tx_hash}-${v.proposal_index}`);
  }

  let upserted = 0;
  for (const key of proposalKeys) {
    const [txHash, indexStr] = key.split('-');
    const index = parseInt(indexStr);

    try {
      const alignment = await computeInterBodyAlignment(txHash, index);
      if (alignment.bodiesVoting < 2) continue;

      const { error } = await supabase.from('inter_body_alignment').upsert(
        {
          proposal_tx_hash: txHash,
          proposal_index: index,
          drep_yes_pct: alignment.drep.yesPct,
          drep_no_pct: alignment.drep.noPct,
          spo_yes_pct: alignment.spo.yesPct,
          spo_no_pct: alignment.spo.noPct,
          cc_yes_pct: alignment.cc.yesPct,
          cc_no_pct: alignment.cc.noPct,
          alignment_score: alignment.alignmentScore,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'proposal_tx_hash,proposal_index' },
      );

      if (!error) upserted++;
    } catch (err) {
      logger.error('[interBodyAlignment] Error computing alignment', {
        proposalKey: key,
        error: err,
      });
    }
  }

  return upserted;
}
