/**
 * Fetch per-proposal vote data and return a Map from drep_id to vote choice.
 * Used by the globe's vote cluster visualization to color DRep nodes by their vote.
 */

export type VoteChoice = 'Yes' | 'No' | 'Abstain';

interface ProposalVotesResponse {
  data: {
    drep_votes: Array<{ drep_id: string; vote: string }>;
  };
}

export async function fetchVoteSplit(
  txHash: string,
  index: number,
): Promise<Map<string, VoteChoice>> {
  const res = await fetch(`/api/v1/proposals/${txHash}/${index}/votes`);
  if (!res.ok) return new Map();

  const json = (await res.json()) as ProposalVotesResponse;
  const votes = json.data?.drep_votes;
  if (!Array.isArray(votes)) return new Map();

  const map = new Map<string, VoteChoice>();
  for (const v of votes) {
    if (v.drep_id && (v.vote === 'Yes' || v.vote === 'No' || v.vote === 'Abstain')) {
      map.set(v.drep_id, v.vote);
    }
  }
  return map;
}
