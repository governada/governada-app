import type { createClient } from '@/lib/supabase';
import { buildTriBodyVotes, type TriBodyVotes } from '@/lib/governance/proposalSummary';

type QueryClient = Pick<ReturnType<typeof createClient>, 'from'>;

export interface ProposalVotingSummaryRow {
  proposal_tx_hash: string;
  proposal_index: number;
  epoch_no?: number | null;
  drep_yes_votes_cast: number | null;
  drep_no_votes_cast: number | null;
  drep_abstain_votes_cast: number | null;
  drep_yes_vote_power?: number | null;
  drep_no_vote_power?: number | null;
  drep_abstain_vote_power?: number | null;
  pool_yes_votes_cast: number | null;
  pool_no_votes_cast: number | null;
  pool_abstain_votes_cast: number | null;
  pool_yes_vote_power?: number | null;
  pool_no_vote_power?: number | null;
  pool_abstain_vote_power?: number | null;
  committee_yes_votes_cast: number | null;
  committee_no_votes_cast: number | null;
  committee_abstain_votes_cast: number | null;
}

export function getProposalVotingSummaryKey(txHash: string, proposalIndex: number): string {
  return `${txHash}-${proposalIndex}`;
}

export async function fetchProposalVotingSummaries(
  supabase: QueryClient,
  txHashes: string[],
  select = '*',
): Promise<ProposalVotingSummaryRow[]> {
  if (txHashes.length === 0) {
    return [];
  }

  const uniqueTxHashes = [...new Set(txHashes)];
  const { data, error } = await supabase
    .from('proposal_voting_summary')
    .select(select)
    .in('proposal_tx_hash', uniqueTxHashes);

  if (error || !data) {
    return [];
  }

  return data as unknown as ProposalVotingSummaryRow[];
}

export async function fetchLatestProposalVotingSummary(
  supabase: QueryClient,
  proposal: { txHash: string; proposalIndex: number },
  select = '*',
  options: { throwOnError?: boolean } = {},
): Promise<ProposalVotingSummaryRow | null> {
  const { throwOnError = false } = options;
  const { data, error } = await supabase
    .from('proposal_voting_summary')
    .select(select)
    .eq('proposal_tx_hash', proposal.txHash)
    .eq('proposal_index', proposal.proposalIndex)
    .order('epoch_no', { ascending: false })
    .limit(1);

  if (error) {
    if (throwOnError) {
      throw error;
    }
    return null;
  }

  if (!data?.length) {
    return null;
  }

  return data[0] as unknown as ProposalVotingSummaryRow;
}

export function indexProposalVotingSummaryTriBodies(
  rows: ProposalVotingSummaryRow[],
): Map<string, TriBodyVotes> {
  const triBodyMap = new Map<string, TriBodyVotes>();

  for (const row of rows) {
    triBodyMap.set(
      getProposalVotingSummaryKey(row.proposal_tx_hash, row.proposal_index),
      buildTriBodyVotes(row),
    );
  }

  return triBodyMap;
}

export function indexProposalVotingSummaries(
  rows: ProposalVotingSummaryRow[],
): Map<string, ProposalVotingSummaryRow> {
  const summaryMap = new Map<string, ProposalVotingSummaryRow>();

  for (const row of rows) {
    summaryMap.set(getProposalVotingSummaryKey(row.proposal_tx_hash, row.proposal_index), row);
  }

  return summaryMap;
}
