/**
 * Epoch Summary Generator — runs daily, detects epoch transitions,
 * and writes per-user epoch_summary events to governance_events.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';

const USER_BATCH = 50;

export const generateEpochSummary = inngest.createFunction(
  {
    id: 'generate-epoch-summary',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"epoch-summary"' },
  },
  { cron: '0 22 * * *' },
  async ({ step }) => {
    const epochInfo = await step.run('detect-epoch-transition', async () => {
      const supabase = getSupabaseAdmin();
      const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .limit(1)
        .single();

      const storedEpoch = stats?.current_epoch ?? 0;
      const isNewEpoch = currentEpoch > storedEpoch;

      if (isNewEpoch) {
        await supabase
          .from('governance_stats')
          .update({
            current_epoch: currentEpoch,
            epoch_end_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', stats?.current_epoch ? 1 : 1);
      }

      return { currentEpoch, previousEpoch: currentEpoch - 1, isNewEpoch, storedEpoch };
    });

    if (!epochInfo.isNewEpoch) {
      return { skipped: true, reason: `epoch ${epochInfo.currentEpoch} already processed` };
    }

    const epoch = epochInfo.previousEpoch;

    const proposalStats = await step.run('gather-proposal-stats', async () => {
      const supabase = getSupabaseAdmin();

      const [closedResult, openedResult, highlightResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .or(
            `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
          ),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('proposed_epoch', epoch),
        supabase
          .from('proposals')
          .select('title, ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch')
          .or(
            `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
          )
          .limit(1),
      ]);

      const highlight = highlightResult.data?.[0] ?? null;
      let highlightProposal: { title: string; outcome: string } | null = null;
      if (highlight) {
        const outcome =
          highlight.enacted_epoch === epoch
            ? 'enacted'
            : highlight.ratified_epoch === epoch
              ? 'ratified'
              : highlight.expired_epoch === epoch
                ? 'expired'
                : 'dropped';
        highlightProposal = { title: highlight.title || 'Untitled', outcome };
      }

      return {
        proposalsClosed: closedResult.count || 0,
        proposalsOpened: openedResult.count || 0,
        highlightProposal,
      };
    });

    const usersProcessed = await step.run('generate-user-summaries', async () => {
      const supabase = getSupabaseAdmin();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: activeUsers, error: userErr } = await supabase
        .from('users')
        .select('wallet_address, delegation_history')
        .gte('last_visit_at', thirtyDaysAgo);

      if (userErr || !activeUsers) {
        console.error('[epoch-summary] Failed to fetch users:', userErr?.message);
        return 0;
      }

      let processed = 0;
      for (let i = 0; i < activeUsers.length; i += USER_BATCH) {
        const batch = activeUsers.slice(i, i + USER_BATCH);
        const events = await Promise.all(
          batch.map(async (user) => {
            const drepId = extractDrepId(user.delegation_history);
            let drepVoteCount = 0;
            let drepRationaleCount = 0;
            let representationScore: number | null = null;
            let repScoreDelta: number | null = null;

            if (drepId) {
              const [votes, rationales, currentScore, prevScore] = await Promise.all([
                supabase
                  .from('drep_votes')
                  .select('vote_tx_hash', { count: 'exact', head: true })
                  .eq('drep_id', drepId)
                  .eq('epoch_no', epoch),
                supabase
                  .from('drep_votes')
                  .select('vote_tx_hash', { count: 'exact', head: true })
                  .eq('drep_id', drepId)
                  .eq('epoch_no', epoch)
                  .not('meta_url', 'is', null),
                supabase
                  .from('drep_score_history')
                  .select('score')
                  .eq('drep_id', drepId)
                  .order('created_at', { ascending: false })
                  .limit(1),
                supabase
                  .from('drep_score_history')
                  .select('score')
                  .eq('drep_id', drepId)
                  .order('created_at', { ascending: false })
                  .range(1, 1),
              ]);

              drepVoteCount = votes.count || 0;
              drepRationaleCount = rationales.count || 0;
              representationScore = currentScore.data?.[0]?.score ?? null;
              const prev = prevScore.data?.[0]?.score ?? null;
              if (representationScore !== null && prev !== null) {
                repScoreDelta = representationScore - prev;
              }
            }

            return {
              wallet_address: user.wallet_address,
              event_type: 'epoch_summary',
              event_data: {
                ...proposalStats,
                drepVoteCount,
                drepRationaleCount,
                representationScore,
                repScoreDelta,
              },
              related_drep_id: drepId || null,
              epoch,
              created_at: new Date().toISOString(),
            };
          }),
        );

        const { error: insertErr } = await supabase.from('governance_events').insert(events);

        if (insertErr) {
          console.error('[epoch-summary] Insert error:', insertErr.message);
        } else {
          processed += events.length;
        }
      }

      return processed;
    });

    console.log(`[epoch-summary] Epoch ${epoch} summary generated for ${usersProcessed} users`);
    return { epoch, usersProcessed, ...proposalStats };
  },
);

function extractDrepId(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const latest = history[history.length - 1];
  return typeof latest === 'object' && latest !== null && 'drepId' in latest
    ? (latest as { drepId: string }).drepId
    : null;
}
