import {
  buildPredictionInput,
  computePassagePrediction,
  fetchPredictionData,
  resolvePassagePredictionThresholds,
} from '@/lib/passagePrediction';
import { createHash } from 'crypto';

// `from()` is the only stable surface these helpers need from the Supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseQueryClient = { from: (table: string) => any };

export interface ProposalIntelligenceTarget {
  tx_hash: string;
  proposal_index: number;
  title: string;
  abstract: string | null;
  proposal_type: string;
  motivation: string | null;
  rationale: string | null;
  withdrawal_amount: number | null;
  param_changes: Record<string, unknown> | null;
  meta_json: Record<string, unknown> | null;
  contentHash: string;
}

export type ProposalPredictionTarget = Pick<
  ProposalIntelligenceTarget,
  'tx_hash' | 'proposal_index' | 'proposal_type' | 'withdrawal_amount' | 'param_changes'
>;

export type ProposalIntelligenceSectionType =
  | 'constitutional'
  | 'key_questions'
  | 'passage_prediction';

interface ProposalIntelligenceSectionRecord {
  content: Record<string, unknown>;
  contentHash: string;
  generationTimeMs?: number;
  modelUsed?: string;
  proposalIndex: number;
  proposalTxHash: string;
  sectionType: ProposalIntelligenceSectionType;
  updatedAt?: string;
}

interface RefreshPassagePredictionCacheOptions {
  nowIso?: string;
  onError?: (proposal: ProposalPredictionTarget, error: unknown) => void;
}

function extractCip108Text(metaJson: Record<string, unknown> | null): {
  motivation: string | null;
  rationale: string | null;
} {
  const body = (metaJson?.body ?? metaJson) as Record<string, unknown> | null;
  return {
    motivation: (body?.motivation as string) ?? null,
    rationale: (body?.rationale as string) ?? null,
  };
}

export function hashProposalIntelligenceContent(
  proposal: Pick<
    ProposalIntelligenceTarget,
    'title' | 'abstract' | 'motivation' | 'rationale' | 'proposal_type'
  >,
): string {
  const input = `${proposal.title}|${proposal.abstract ?? ''}|${proposal.motivation ?? ''}|${proposal.rationale ?? ''}|${proposal.proposal_type}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}

export async function listOpenProposalIntelligenceTargets(
  supabase: SupabaseQueryClient,
): Promise<ProposalIntelligenceTarget[]> {
  const { data } = await supabase
    .from('proposals')
    .select(
      'tx_hash, proposal_index, title, abstract, proposal_type, withdrawal_amount, param_changes, meta_json',
    )
    .is('ratified_epoch', null)
    .is('enacted_epoch', null)
    .is('dropped_epoch', null)
    .is('expired_epoch', null)
    .not('title', 'is', null);

  return (data ?? []).map((proposal: Omit<ProposalIntelligenceTarget, 'contentHash'>) => ({
    ...proposal,
    ...extractCip108Text(proposal.meta_json),
    contentHash: hashProposalIntelligenceContent({
      title: proposal.title,
      abstract: proposal.abstract,
      ...extractCip108Text(proposal.meta_json),
      proposal_type: proposal.proposal_type,
    }),
  }));
}

export async function findProposalsNeedingIntelligencePrecompute(
  supabase: SupabaseQueryClient,
  limit = 20,
): Promise<ProposalIntelligenceTarget[]> {
  const proposals = await listOpenProposalIntelligenceTargets(supabase);
  if (proposals.length === 0) {
    return [];
  }

  const txHashes = proposals.map((proposal) => proposal.tx_hash);
  const { data: cached } = await supabase
    .from('proposal_intelligence_cache')
    .select('proposal_tx_hash, proposal_index, section_type, content_hash')
    .in('proposal_tx_hash', txHashes);

  const cacheMap = new Map<string, string>();
  for (const cacheRow of cached ?? []) {
    const row = cacheRow as {
      content_hash: string | null;
      proposal_index: number;
      proposal_tx_hash: string;
      section_type: ProposalIntelligenceSectionType;
    };
    cacheMap.set(
      `${row.proposal_tx_hash}-${row.proposal_index}-${row.section_type}`,
      row.content_hash ?? '',
    );
  }

  return proposals
    .filter((proposal) => {
      const constitutionalKey = `${proposal.tx_hash}-${proposal.proposal_index}-constitutional`;
      const keyQuestionsKey = `${proposal.tx_hash}-${proposal.proposal_index}-key_questions`;
      const passagePredictionKey = `${proposal.tx_hash}-${proposal.proposal_index}-passage_prediction`;

      return (
        cacheMap.get(constitutionalKey) !== proposal.contentHash ||
        cacheMap.get(keyQuestionsKey) !== proposal.contentHash ||
        !cacheMap.has(passagePredictionKey)
      );
    })
    .slice(0, limit);
}

export async function upsertProposalIntelligenceSection(
  supabase: SupabaseQueryClient,
  section: ProposalIntelligenceSectionRecord,
): Promise<void> {
  await supabase.from('proposal_intelligence_cache').upsert(
    {
      proposal_tx_hash: section.proposalTxHash,
      proposal_index: section.proposalIndex,
      section_type: section.sectionType,
      content: section.content,
      content_hash: section.contentHash,
      model_used: section.modelUsed,
      generation_time_ms: section.generationTimeMs,
      updated_at: section.updatedAt ?? new Date().toISOString(),
    },
    { onConflict: 'proposal_tx_hash,proposal_index,section_type' },
  );
}

export async function refreshPassagePredictionCache(
  supabase: SupabaseQueryClient,
  proposals: ProposalPredictionTarget[],
  options: RefreshPassagePredictionCacheOptions = {},
): Promise<number> {
  if (proposals.length === 0) {
    return 0;
  }

  const { voteMap, constMap, sentimentMap } = await fetchPredictionData(supabase, proposals);
  const upsertRows: Array<Record<string, unknown>> = [];
  let updated = 0;

  for (const proposal of proposals) {
    try {
      const { input: predictionInput, voteHash } = buildPredictionInput(
        proposal,
        voteMap,
        constMap,
        sentimentMap,
      );
      const thresholds = await resolvePassagePredictionThresholds({
        proposalType: proposal.proposal_type,
        paramChanges: proposal.param_changes ?? null,
      });
      const prediction = computePassagePrediction({ ...predictionInput, thresholds });

      upsertRows.push({
        proposal_tx_hash: proposal.tx_hash,
        proposal_index: proposal.proposal_index,
        section_type: 'passage_prediction',
        content: prediction as unknown as Record<string, unknown>,
        content_hash: voteHash,
        updated_at: options.nowIso ?? new Date().toISOString(),
      });
      updated++;
    } catch (error) {
      options.onError?.(proposal, error);
    }
  }

  if (upsertRows.length > 0) {
    await supabase
      .from('proposal_intelligence_cache')
      .upsert(upsertRows, { onConflict: 'proposal_tx_hash,proposal_index,section_type' });
  }

  return updated;
}
