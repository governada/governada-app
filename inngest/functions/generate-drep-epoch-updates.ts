/**
 * Generate AI-drafted per-DRep epoch voting summaries.
 * Runs daily after epoch summary, generates a plain-English update
 * for each DRep who voted during the previous epoch.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateText } from '@/lib/ai';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';

const DREP_BATCH = 10;

interface DRepVoteRow {
  proposal_tx_hash: string;
  proposal_index: number;
  vote: string;
  meta_url: string | null;
}

interface ProposalRow {
  tx_hash: string;
  proposal_index: number;
  title: string | null;
  proposal_type: string;
}

const EPOCH_UPDATE_SYSTEM = `You are a concise governance communications writer for Cardano DReps.
Write a brief epoch update summarizing voting activity in 2-4 sentences.
Use plain English. Be factual. Mention specific proposals by name when available.
Do not use bullet points or lists. Write in third person ("This DRep voted...").`;

function buildEpochUpdatePrompt(
  drepName: string,
  epoch: number,
  votes: Array<{ title: string; type: string; vote: string; hasRationale: boolean }>,
): string {
  const voteLines = votes
    .map(
      (v) => `- ${v.vote} on "${v.title}" (${v.type})${v.hasRationale ? ' [with rationale]' : ''}`,
    )
    .join('\n');

  const rationaleCount = votes.filter((v) => v.hasRationale).length;

  return `Write a brief epoch update for DRep "${drepName}" for Epoch ${epoch}.

Voting activity:
${voteLines}

Stats: ${votes.length} votes cast, ${rationaleCount} with published rationale.

Write 2-4 sentences summarizing this epoch's voting activity. Be specific about proposals.`;
}

export const generateDrepEpochUpdates = inngest.createFunction(
  {
    id: 'generate-drep-epoch-updates',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"drep-epoch-updates"' },
    triggers: { cron: '30 22 * * *' }, // 30 min after epoch summary
  },
  async ({ step }) => {
    // Step 1: Detect which epoch to process
    const epochInfo = await step.run('detect-epoch', async () => {
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
      const previousEpoch = currentEpoch - 1;

      const supabase = getSupabaseAdmin();
      const { data: existing } = await supabase
        .from('drep_epoch_updates')
        .select('drep_id', { count: 'exact', head: true })
        .eq('epoch', previousEpoch);

      return {
        epoch: previousEpoch,
        currentEpoch,
        alreadyGenerated: existing?.length ?? 0,
      };
    });

    // Step 2: Gather DReps who voted this epoch
    const drepVoteData = await step.run('gather-drep-votes', async () => {
      const supabase = getSupabaseAdmin();
      const epoch = epochInfo.epoch;

      // Get all votes for this epoch
      const { data: votes } = await supabase
        .from('drep_votes')
        .select('drep_id, proposal_tx_hash, proposal_index, vote, meta_url')
        .eq('epoch_no', epoch);

      if (!votes || votes.length === 0)
        return { dreps: [] as string[], votesByDrep: {}, proposals: [] as ProposalRow[] };

      // Group votes by DRep
      const votesByDrep: Record<string, DRepVoteRow[]> = {};
      for (const v of votes) {
        if (!votesByDrep[v.drep_id]) votesByDrep[v.drep_id] = [];
        votesByDrep[v.drep_id].push(v);
      }

      // Get proposal details
      const txHashes = [...new Set(votes.map((v) => v.proposal_tx_hash))];
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, title, proposal_type')
        .in('tx_hash', txHashes);

      // Filter out DReps that already have updates for this epoch
      const { data: existingUpdates } = await supabase
        .from('drep_epoch_updates')
        .select('drep_id')
        .eq('epoch', epoch);

      const existingDreps = new Set((existingUpdates || []).map((u) => u.drep_id));
      const newDreps = Object.keys(votesByDrep).filter((id) => !existingDreps.has(id));

      return {
        dreps: newDreps,
        votesByDrep,
        proposals: proposals || [],
      };
    });

    if (drepVoteData.dreps.length === 0) {
      return { skipped: true, reason: 'no new DReps to process', epoch: epochInfo.epoch };
    }

    // Step 3: Generate updates in batches
    const generateResult = await step.run('generate-updates', async () => {
      const supabase = getSupabaseAdmin();
      const epoch = epochInfo.epoch;
      const proposalMap = new Map<string, ProposalRow>();
      for (const p of (drepVoteData.proposals || []) as ProposalRow[]) {
        proposalMap.set(`${p.tx_hash}-${p.proposal_index}`, p);
      }

      // Get DRep names
      const { data: dreps } = await supabase
        .from('dreps')
        .select('id, info')
        .in('id', drepVoteData.dreps);

      const nameMap = new Map<string, string>();
      for (const d of dreps || []) {
        const info = d.info as Record<string, unknown> | null;
        nameMap.set(d.id, (info?.name as string) || d.id.slice(0, 16) + '...');
      }

      let generated = 0;
      const votesByDrep = drepVoteData.votesByDrep as Record<string, DRepVoteRow[]>;

      for (let i = 0; i < drepVoteData.dreps.length; i += DREP_BATCH) {
        const batch = drepVoteData.dreps.slice(i, i + DREP_BATCH);
        const results = await Promise.allSettled(
          batch.map(async (drepId) => {
            const drepVotes = votesByDrep[drepId] || [];
            if (drepVotes.length === 0) return null;

            const drepName = nameMap.get(drepId) || drepId.slice(0, 16) + '...';
            const voteDetails = drepVotes.map((v) => {
              const key = `${v.proposal_tx_hash}-${v.proposal_index}`;
              const proposal = proposalMap.get(key);
              return {
                title: proposal?.title || `Proposal ${v.proposal_tx_hash.slice(0, 8)}...`,
                type: proposal?.proposal_type || 'Unknown',
                vote: v.vote,
                hasRationale: !!v.meta_url,
              };
            });

            const prompt = buildEpochUpdatePrompt(drepName, epoch, voteDetails);
            const updateText = await generateText(prompt, {
              system: EPOCH_UPDATE_SYSTEM,
              maxTokens: 256,
            });

            if (!updateText) return null;

            const rationaleCount = drepVotes.filter((v) => v.meta_url).length;
            const proposalsVoted = voteDetails.map((v) => ({
              title: v.title,
              type: v.type,
              vote: v.vote,
            }));

            await supabase.from('drep_epoch_updates').upsert(
              {
                drep_id: drepId,
                epoch,
                update_text: updateText.trim(),
                vote_count: drepVotes.length,
                rationale_count: rationaleCount,
                proposals_voted: proposalsVoted,
                generated_at: new Date().toISOString(),
              },
              { onConflict: 'drep_id,epoch' },
            );

            return drepId;
          }),
        );

        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) generated++;
        }
      }

      return { generated, total: drepVoteData.dreps.length };
    });

    logger.info('[drep-epoch-updates] Generated', {
      epoch: epochInfo.epoch,
      ...generateResult,
    });

    return {
      epoch: epochInfo.epoch,
      ...generateResult,
    };
  },
);
