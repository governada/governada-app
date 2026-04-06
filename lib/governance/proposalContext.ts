import type { createClient } from '@/lib/supabase';
import { fetchLatestProposalVotingSummary } from '@/lib/governance/proposalVotingSummary';
import { buildTriBodyVotes } from '@/lib/governance/proposalSummary';

type QueryClient = Pick<ReturnType<typeof createClient>, 'from'>;

export interface GovernanceProposalKey {
  txHash: string;
  proposalIndex: number;
}

type GovernanceProposalDimension =
  | 'treasuryConservative'
  | 'treasuryGrowth'
  | 'decentralization'
  | 'security'
  | 'innovation'
  | 'transparency';

export interface GovernanceProposalSnapshot extends GovernanceProposalKey {
  title: string;
  abstract: string;
  aiSummary: string | null;
  proposalType: string;
  withdrawalAmount: number | null;
  treasuryTier: string | null;
  expirationEpoch: number | null;
  proposedEpoch: number | null;
  relevantPrefs: unknown;
  motivation: string;
  rationale: string;
  status: 'active' | 'ratified' | 'enacted' | 'expired' | 'dropped';
}

export interface GovernanceProposalVotingSnapshot {
  drep: { yes: number; no: number; abstain: number };
  spo: { yes: number; no: number; abstain: number };
  cc: { yes: number; no: number; abstain: number };
  epochsRemaining?: number;
}

export interface GovernanceProposalClassificationSummary {
  strongestDimension: GovernanceProposalDimension;
  strongestScore: number;
  strength: 'moderate' | 'strong';
}

export interface GovernanceProposalContextSeed {
  proposal: GovernanceProposalSnapshot;
  voting: GovernanceProposalVotingSnapshot;
  classification: GovernanceProposalClassificationSummary | null;
}

export function normalizeGovernanceProposalKey(
  proposalId: string | GovernanceProposalKey,
): GovernanceProposalKey {
  if (typeof proposalId !== 'string') {
    return proposalId;
  }

  const parts = proposalId.split(/[#/:]/);
  return {
    txHash: parts[0] ?? proposalId,
    proposalIndex: parts.length > 1 ? parseInt(parts[1] ?? '0', 10) || 0 : 0,
  };
}

function extractMetaText(metaJson: unknown, field: string): string {
  if (!metaJson || typeof metaJson !== 'object') return '';
  const body =
    'body' in metaJson && metaJson.body && typeof metaJson.body === 'object'
      ? (metaJson.body as Record<string, unknown>)
      : (metaJson as Record<string, unknown>);
  const value = body[field];
  return typeof value === 'string' ? value : '';
}

export async function fetchGovernanceProposalSnapshot(
  supabase: QueryClient,
  proposalId: string | GovernanceProposalKey,
): Promise<GovernanceProposalSnapshot | null> {
  const { txHash, proposalIndex } = normalizeGovernanceProposalKey(proposalId);

  const { data } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, abstract, ai_summary, proposal_type, withdrawal_amount, treasury_tier, expiration_epoch, proposed_epoch, relevant_prefs, meta_json, ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch',
    )
    .eq('tx_hash', txHash)
    .eq('proposal_index', proposalIndex)
    .maybeSingle();

  if (!data) {
    return null;
  }

  return {
    txHash: data.tx_hash,
    proposalIndex: data.proposal_index,
    title: data.title ?? '',
    abstract: data.abstract ?? '',
    aiSummary: data.ai_summary ?? null,
    proposalType: data.proposal_type ?? 'InfoAction',
    withdrawalAmount: data.withdrawal_amount != null ? Number(data.withdrawal_amount) : null,
    treasuryTier: data.treasury_tier ?? null,
    expirationEpoch: data.expiration_epoch ?? null,
    proposedEpoch: data.proposed_epoch ?? null,
    relevantPrefs: data.relevant_prefs ?? null,
    motivation: extractMetaText(data.meta_json, 'motivation'),
    rationale: extractMetaText(data.meta_json, 'rationale'),
    status: data.enacted_epoch
      ? 'enacted'
      : data.ratified_epoch
        ? 'ratified'
        : data.expired_epoch
          ? 'expired'
          : data.dropped_epoch
            ? 'dropped'
            : 'active',
  };
}

export async function fetchGovernanceProposalVotingSnapshot(
  supabase: QueryClient,
  proposalId: string | GovernanceProposalKey,
): Promise<GovernanceProposalVotingSnapshot> {
  const { txHash, proposalIndex } = normalizeGovernanceProposalKey(proposalId);
  const emptyVoting: GovernanceProposalVotingSnapshot = {
    drep: { yes: 0, no: 0, abstain: 0 },
    spo: { yes: 0, no: 0, abstain: 0 },
    cc: { yes: 0, no: 0, abstain: 0 },
  };

  const [summary, { data: proposalRow }, { data: epochData }] = await Promise.all([
    fetchLatestProposalVotingSummary(supabase, { txHash, proposalIndex }),
    supabase
      .from('proposals')
      .select('expiration_epoch')
      .eq('tx_hash', txHash)
      .eq('proposal_index', proposalIndex)
      .maybeSingle(),
    supabase
      .from('epoch_params')
      .select('epoch_no')
      .order('epoch_no', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!summary) {
    return emptyVoting;
  }

  const expirationEpoch = proposalRow?.expiration_epoch;
  const currentEpoch = epochData?.epoch_no ?? 0;
  const epochsRemaining =
    expirationEpoch != null && currentEpoch > 0 ? expirationEpoch - currentEpoch : undefined;

  return {
    ...buildTriBodyVotes(summary),
    epochsRemaining: epochsRemaining != null && epochsRemaining >= 0 ? epochsRemaining : undefined,
  };
}

function summarizeClassification(
  row: Record<string, number> | null | undefined,
): GovernanceProposalClassificationSummary | null {
  if (!row) return null;

  const dimensions: Array<{ name: GovernanceProposalDimension; score: number }> = [
    { name: 'treasuryConservative', score: row.dim_treasury_conservative ?? 0 },
    { name: 'treasuryGrowth', score: row.dim_treasury_growth ?? 0 },
    { name: 'decentralization', score: row.dim_decentralization ?? 0 },
    { name: 'security', score: row.dim_security ?? 0 },
    { name: 'innovation', score: row.dim_innovation ?? 0 },
    { name: 'transparency', score: row.dim_transparency ?? 0 },
  ];

  const strongest = dimensions.reduce((best, current) =>
    current.score > best.score ? current : best,
  );

  if (strongest.score <= 0.5) {
    return null;
  }

  return {
    strongestDimension: strongest.name,
    strongestScore: strongest.score,
    strength: strongest.score > 0.8 ? 'strong' : 'moderate',
  };
}

export async function fetchGovernanceProposalContextSeed(
  supabase: QueryClient,
  proposalId: string | GovernanceProposalKey,
): Promise<GovernanceProposalContextSeed | null> {
  const proposal = await fetchGovernanceProposalSnapshot(supabase, proposalId);
  if (!proposal) {
    return null;
  }

  const [voting, classificationResult] = await Promise.all([
    fetchGovernanceProposalVotingSnapshot(supabase, proposal),
    supabase
      .from('proposal_classifications')
      .select('*')
      .eq('proposal_tx_hash', proposal.txHash)
      .eq('proposal_index', proposal.proposalIndex)
      .maybeSingle(),
  ]);

  return {
    proposal,
    voting,
    classification: summarizeClassification(
      (classificationResult.data as Record<string, number> | null | undefined) ?? null,
    ),
  };
}
