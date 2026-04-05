import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase';

/**
 * Proposal metadata from the cached proposals table.
 * Used to enrich vote records with stable proposal facts.
 */
export interface CachedProposal {
  txHash: string;
  proposalIndex: number;
  title: string | null;
  abstract: string | null;
  aiSummary: string | null;
  proposalType: string | null;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  relevantPrefs: string[];
}

/**
 * Get proposals by their IDs (tx_hash + proposal_index).
 * This stays a leaf read helper so multiple consumers can share one proposal enrichment path.
 */
export async function getProposalsByIds(
  proposalIds: { txHash: string; index: number }[],
): Promise<Map<string, CachedProposal>> {
  const result = new Map<string, CachedProposal>();

  if (proposalIds.length === 0) return result;

  try {
    const supabase = createClient();

    // Supabase does not support compound key IN queries cleanly, so fetch by tx_hash and filter locally.
    const txHashes = [...new Set(proposalIds.map((proposal) => proposal.txHash))];

    const { data: rows, error } = await supabase
      .from('proposals')
      .select(
        'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, relevant_prefs',
      )
      .in('tx_hash', txHashes);

    if (error) {
      logger.warn('[ProposalEnrichment] getProposalsByIds query failed', { error: error.message });
      return result;
    }

    if (!rows || rows.length === 0) {
      logger.warn('[ProposalEnrichment] getProposalsByIds: no proposals found', {
        txHashCount: txHashes.length,
      });
      return result;
    }

    const requestedIds = new Set(
      proposalIds.map((proposal) => `${proposal.txHash}-${proposal.index}`),
    );

    for (const row of rows) {
      const key = `${row.tx_hash}-${row.proposal_index}`;
      if (requestedIds.has(key)) {
        result.set(key, {
          txHash: row.tx_hash,
          proposalIndex: row.proposal_index,
          title: row.title,
          abstract: row.abstract,
          aiSummary: row.ai_summary || null,
          proposalType: row.proposal_type,
          withdrawalAmount: row.withdrawal_amount != null ? Number(row.withdrawal_amount) : null,
          treasuryTier: row.treasury_tier,
          relevantPrefs: row.relevant_prefs || [],
        });
      }
    }

    return result;
  } catch (err) {
    logger.error('[ProposalEnrichment] getProposalsByIds error', { error: err });
    return result;
  }
}

export interface RationaleRecord {
  rationaleText: string | null;
  rationaleAiSummary: string | null;
  hashVerified: boolean | null;
}

/**
 * Get cached rationale text and AI summary for votes by their tx hashes.
 */
export async function getRationalesByVoteTxHashes(
  voteTxHashes: string[],
): Promise<Map<string, RationaleRecord>> {
  const result = new Map<string, RationaleRecord>();

  if (voteTxHashes.length === 0) return result;

  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('vote_rationales')
      .select('vote_tx_hash, rationale_text, ai_summary, hash_verified')
      .in('vote_tx_hash', voteTxHashes);

    if (error) {
      logger.warn('[ProposalEnrichment] getRationalesByVoteTxHashes query failed', {
        error: error.message,
      });
      return result;
    }

    if (!rows) return result;

    for (const row of rows) {
      result.set(row.vote_tx_hash, {
        rationaleText: row.rationale_text || null,
        rationaleAiSummary: row.ai_summary || null,
        hashVerified: row.hash_verified ?? null,
      });
    }

    return result;
  } catch (err) {
    logger.error('[ProposalEnrichment] getRationalesByVoteTxHashes error', { error: err });
    return result;
  }
}

/**
 * Row shape returned from the drep_votes table.
 */
export interface DRepVoteRow {
  vote_tx_hash: string;
  drep_id: string;
  proposal_tx_hash: string;
  proposal_index: number;
  vote: 'Yes' | 'No' | 'Abstain';
  epoch_no: number | null;
  block_time: number;
  meta_url: string | null;
  meta_hash: string | null;
  rationale_quality: number | null;
  rationale_specificity: number | null;
  rationale_reasoning_depth: number | null;
  rationale_proposal_awareness: number | null;
}

/**
 * Get all votes for a specific DRep from Supabase, ordered most recent first.
 */
export async function getVotesByDRepId(drepId: string): Promise<DRepVoteRow[]> {
  try {
    const supabase = createClient();

    const { data: rows, error } = await supabase
      .from('drep_votes')
      .select('*')
      .eq('drep_id', drepId)
      .order('block_time', { ascending: false });

    if (error) {
      logger.warn('[ProposalEnrichment] getVotesByDRepId query failed', { error: error.message });
      return [];
    }

    return (rows as DRepVoteRow[]) || [];
  } catch (err) {
    logger.error('[ProposalEnrichment] getVotesByDRepId error', { error: err });
    return [];
  }
}
