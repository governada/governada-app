import type { createClient } from '@/lib/supabase';
import {
  buildProposalVoteSummary,
  type ProposalWithVoteSummary,
} from '@/lib/governance/proposalSummary';
import {
  fetchProposalVotingSummaries,
  indexProposalVotingSummaryTriBodies,
} from '@/lib/governance/proposalVotingSummary';

type QueryClient = Pick<ReturnType<typeof createClient>, 'from'>;

export type ProposalListStatus = 'active' | 'ratified' | 'enacted' | 'expired' | 'dropped' | 'all';

export type ProposalListSort = 'newest' | 'most_votes' | 'most_contested';

interface ProposalListOptions {
  status: ProposalListStatus;
  type?: string | null;
  sort: ProposalListSort;
  limit: number;
  offset: number;
}

interface ProposalListPage {
  proposals: ProposalWithVoteSummary[];
  total: number;
}

interface ProposalListQueryBuilder<TSelf> {
  is(column: string, value: null): TSelf;
  not(column: string, operator: string, value: null): TSelf;
  eq(column: string, value: string): TSelf;
}

const PROPOSAL_LIST_SELECT =
  'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, relevant_prefs, proposed_epoch, block_time, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch, expiration_epoch, param_changes';

function applyStatusFilter<T extends ProposalListQueryBuilder<T>>(
  query: T,
  status: ProposalListStatus,
): T {
  switch (status) {
    case 'active':
      return query
        .is('ratified_epoch', null)
        .is('enacted_epoch', null)
        .is('dropped_epoch', null)
        .is('expired_epoch', null);
    case 'enacted':
      return query.not('enacted_epoch', 'is', null);
    case 'ratified':
      return query.not('ratified_epoch', 'is', null).is('enacted_epoch', null);
    case 'expired':
      return query
        .not('expired_epoch', 'is', null)
        .is('enacted_epoch', null)
        .is('ratified_epoch', null);
    case 'dropped':
      return query
        .not('dropped_epoch', 'is', null)
        .is('enacted_epoch', null)
        .is('ratified_epoch', null)
        .is('expired_epoch', null);
    case 'all':
    default:
      return query;
  }
}

function buildBaseProposalListQuery(
  supabase: QueryClient,
  { status, type }: Pick<ProposalListOptions, 'status' | 'type'>,
) {
  let query = supabase.from('proposals').select(PROPOSAL_LIST_SELECT, { count: 'exact' });
  query = applyStatusFilter(query, status);
  if (type) {
    query = query.eq('proposal_type', type);
  }
  return query;
}

function sortProposals(
  proposals: ProposalWithVoteSummary[],
  sort: ProposalListSort,
): ProposalWithVoteSummary[] {
  const sorted = [...proposals];

  if (sort === 'most_votes') {
    sorted.sort((a, b) => b.totalVotes - a.totalVotes);
  } else if (sort === 'most_contested') {
    sorted.sort((a, b) => {
      const contestA = a.totalVotes > 0 ? Math.min(a.yesCount, a.noCount) / a.totalVotes : 0;
      const contestB = b.totalVotes > 0 ? Math.min(b.yesCount, b.noCount) / b.totalVotes : 0;
      return contestB - contestA;
    });
  }

  return sorted;
}

export async function fetchProposalListPage(
  supabase: QueryClient,
  options: ProposalListOptions,
): Promise<ProposalListPage> {
  const { status, type, sort, limit, offset } = options;

  const newestQuery = buildBaseProposalListQuery(supabase, { status, type }).order('block_time', {
    ascending: false,
  });

  const queryResult =
    sort === 'newest' ? await newestQuery.range(offset, offset + limit - 1) : await newestQuery;

  const { data, error, count } = queryResult;
  if (error || !data || data.length === 0) {
    return { proposals: [], total: count ?? 0 };
  }

  const votingSummaryRows = await fetchProposalVotingSummaries(
    supabase,
    data.map((proposal) => proposal.tx_hash),
    'proposal_tx_hash, proposal_index, drep_yes_votes_cast, drep_no_votes_cast, drep_abstain_votes_cast, pool_yes_votes_cast, pool_no_votes_cast, pool_abstain_votes_cast, committee_yes_votes_cast, committee_no_votes_cast, committee_abstain_votes_cast',
  );
  const triBodyMap = indexProposalVotingSummaryTriBodies(votingSummaryRows);

  const mapped = data.map((proposal) => {
    const triBody = triBodyMap.get(`${proposal.tx_hash}-${proposal.proposal_index}`);
    return buildProposalVoteSummary({
      proposal,
      drepCounts: triBody?.drep,
      triBody,
    });
  });

  if (sort === 'newest') {
    return { proposals: mapped, total: count ?? mapped.length };
  }

  const sorted = sortProposals(mapped, sort);
  return {
    proposals: sorted.slice(offset, offset + limit),
    total: count ?? sorted.length,
  };
}
