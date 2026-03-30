/**
 * Epoch Summary Generator — runs daily, detects epoch transitions,
 * and writes per-user epoch_summary events to governance_events.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { errMsg } from '@/lib/sync-utils';
import { logger } from '@/lib/logger';

const USER_BATCH = 50;

export const generateEpochSummary = inngest.createFunction(
  {
    id: 'generate-epoch-summary',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"epoch-summary"' },
    triggers: { cron: '0 22 * * *' },
  },
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
        .select('id, wallet_address, delegation_history')
        .gte('last_visit_at', thirtyDaysAgo);

      if (userErr || !activeUsers) {
        logger.error('[epoch-summary] Failed to fetch users', { error: userErr });
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
              user_id: user.id,
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
          logger.error('[epoch-summary] Insert error', { error: insertErr });
        } else {
          processed += events.length;
        }
      }

      return processed;
    });

    // Step 4: Enrich governance events (drep_vote + proposal_outcome events)
    const enrichResult = await step.run('enrich-governance-events', async () => {
      const supabase = getSupabaseAdmin();
      let eventsWritten = 0;

      // Write proposal_outcome events for proposals that concluded this epoch
      const { data: concludedProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, title, ratified_epoch, enacted_epoch, expired_epoch, dropped_epoch',
        )
        .or(
          `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},expired_epoch.eq.${epoch},dropped_epoch.eq.${epoch}`,
        );

      if (concludedProposals && concludedProposals.length > 0) {
        // Find users who had their DRep vote on these proposals
        const txHashes = concludedProposals.map((p) => p.tx_hash);
        const { data: relevantVotes } = await supabase
          .from('drep_votes')
          .select('drep_id, proposal_tx_hash, proposal_index, vote')
          .in('proposal_tx_hash', txHashes);

        if (relevantVotes && relevantVotes.length > 0) {
          // Find delegators for each DRep that voted
          const drepIds = [...new Set(relevantVotes.map((v) => v.drep_id))];
          const { data: delegators } = await supabase
            .from('users')
            .select('id, wallet_address, delegation_history')
            .limit(500);

          const userToDrep = new Map<
            string,
            { id: string; wallet_address: string; drepId: string }
          >();
          for (const u of delegators || []) {
            const drepId = extractDrepId(u.delegation_history);
            if (drepId && drepIds.includes(drepId)) {
              userToDrep.set(u.id, { id: u.id, wallet_address: u.wallet_address, drepId });
            }
          }

          const outcomeEvents = [];
          for (const [, { id: userId, wallet_address, drepId }] of userToDrep) {
            for (const p of concludedProposals) {
              const vote = relevantVotes.find(
                (v) => v.drep_id === drepId && v.proposal_tx_hash === p.tx_hash,
              );
              if (!vote) continue;

              const outcome =
                p.enacted_epoch === epoch
                  ? 'enacted'
                  : p.ratified_epoch === epoch
                    ? 'ratified'
                    : p.expired_epoch === epoch
                      ? 'expired'
                      : 'dropped';

              outcomeEvents.push({
                id: crypto.randomUUID(),
                user_id: userId,
                wallet_address,
                event_type: 'proposal_outcome',
                event_data: {
                  proposal_tx_hash: p.tx_hash,
                  proposal_index: p.proposal_index,
                  title: p.title,
                  outcome,
                  drep_vote: vote.vote,
                },
                related_drep_id: drepId,
                epoch,
                created_at: new Date().toISOString(),
              });
            }
          }

          if (outcomeEvents.length > 0) {
            const { error } = await supabase
              .from('governance_events')
              .insert(outcomeEvents.slice(0, 500));
            if (!error) eventsWritten += Math.min(outcomeEvents.length, 500);
          }
        }
      }

      return { eventsWritten };
    });

    // Step 5: Generate epoch recap with stats
    const recapResult = await step.run('generate-epoch-recap', async () => {
      const supabase = getSupabaseAdmin();

      const [ratifiedResult, expiredResult, droppedResult, submittedResult] = await Promise.all([
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('ratified_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('expired_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('dropped_epoch', epoch),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('proposed_epoch', epoch),
      ]);

      const ratified = ratifiedResult.count || 0;
      const expired = expiredResult.count || 0;
      const dropped = droppedResult.count || 0;
      const submitted = submittedResult.count || 0;

      // DRep participation: count DReps who voted this epoch vs total active
      const [votersResult, totalDrepsResult] = await Promise.all([
        supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
        supabase
          .from('dreps')
          .select('id', { count: 'exact', head: true })
          .not('info->isActive', 'eq', false),
      ]);

      const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id)).size;
      const totalDreps = totalDrepsResult.count || 1;
      const participationPct = Math.round((uniqueVoters / totalDreps) * 100 * 10) / 10;

      // Treasury withdrawn this epoch
      const { data: treasuryData } = await supabase
        .from('proposals')
        .select('withdrawal_amount')
        .eq('proposal_type', 'TreasuryWithdrawals')
        .eq('enacted_epoch', epoch);

      const treasuryWithdrawn = (treasuryData || []).reduce(
        (sum, p) => sum + (p.withdrawal_amount || 0),
        0,
      );

      // Generate a news-quality AI narrative from the epoch data
      const fallbackNarrative = [
        `Epoch ${epoch}:`,
        submitted > 0 ? `${submitted} proposals submitted` : null,
        ratified > 0 ? `${ratified} ratified` : null,
        expired > 0 ? `${expired} expired` : null,
        dropped > 0 ? `${dropped} dropped` : null,
        `${participationPct}% DRep participation`,
        treasuryWithdrawn > 0
          ? `${Math.round(treasuryWithdrawn / 1_000_000)}M ADA withdrawn from treasury`
          : null,
      ]
        .filter(Boolean)
        .join(', ');

      let narrative = fallbackNarrative;
      try {
        const { generateText } = await import('@/lib/ai');
        const aiNarrative = await generateText(
          `You are the editor of a governance newsletter for the Cardano blockchain network. Write a 2-3 sentence summary of what happened this epoch.

TONE RULES (critical):
- Frame governance activity POSITIVELY. Cardano governance is working — highlight what was accomplished, not what's lacking.
- NEVER use words like "low", "only", "bleak", "concerning", "struggling", "declining", "weak", "poor", "failed", or "inactive".
- If participation numbers are modest, frame them as governance being active and representatives engaging, not as turnout being low.
- Remember: governance proposals span ~6 epochs (~30 days). A DRep not voting in ONE 5-day epoch is normal — they may vote later in the proposal's lifecycle. Do not call this "low participation".
- Lead with the most important positive development. Use active voice, plain English, no jargon.
- Do not start with "Epoch ${epoch}" or "This epoch". Do not use marketing language.

DATA FOR EPOCH ${epoch}:
- ${submitted} new governance proposals submitted
- ${ratified} proposals ratified (approved)
- ${expired} proposals expired (ran out of time)
- ${dropped} proposals dropped (withdrawn)
- DRep participation rate this epoch: ${participationPct}% (note: this is a single 5-day window; real participation is measured across each proposal's full ~30-day lifecycle)
- Treasury withdrawals: ${treasuryWithdrawn > 0 ? `${Math.round(treasuryWithdrawn / 1_000_000)}M ADA` : 'none'}

Output ONLY the narrative paragraph, nothing else.`,
          { maxTokens: 200 },
        );
        if (aiNarrative && aiNarrative.length > 20) {
          narrative = aiNarrative.trim();
        }
      } catch {
        logger.warn('[epoch-summary] AI narrative generation failed, using fallback');
      }

      const { error: upsertErr } = await supabase.from('epoch_recaps').upsert(
        {
          epoch,
          proposals_submitted: submitted,
          proposals_ratified: ratified,
          proposals_expired: expired,
          proposals_dropped: dropped,
          drep_participation_pct: participationPct,
          treasury_withdrawn_ada: Math.round(treasuryWithdrawn),
          ai_narrative: narrative,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );

      if (upsertErr) {
        logger.error('[epoch-summary] Epoch recap upsert error', { error: upsertErr });
        return { success: false, error: upsertErr.message };
      }

      return { success: true, epoch, narrative };
    });

    // Step 6: Governance participation snapshot (system-wide metrics for this epoch)
    const participationSnapshot = await step.run('snapshot-governance-participation', async () => {
      try {
        const supabase = getSupabaseAdmin();

        const { data: existing } = await supabase
          .from('governance_participation_snapshots')
          .select('epoch')
          .eq('epoch', epoch)
          .maybeSingle();
        if (existing) return { skipped: true };

        const [votersResult, totalDrepsResult, totalPowerResult, rationaleResult] =
          await Promise.all([
            supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
            supabase
              .from('dreps')
              .select('id', { count: 'exact', head: true })
              .not('info->isActive', 'eq', false),
            supabase.from('dreps').select('info').not('info->isActive', 'eq', false),
            supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('epoch_no', epoch)
              .not('meta_url', 'is', null),
          ]);

        const uniqueVoters = new Set((votersResult.data || []).map((v) => v.drep_id));
        const activeDreps = uniqueVoters.size;
        const totalDreps = totalDrepsResult.count || 1;
        const participationRate = Math.round((activeDreps / totalDreps) * 10000) / 100;

        const totalVotes = votersResult.data?.length ?? 0;
        const rationaleCount = rationaleResult.count ?? 0;
        const rationaleRate =
          totalVotes > 0 ? Math.round((rationaleCount / totalVotes) * 10000) / 100 : 0;

        const totalPower = (totalPowerResult.data || []).reduce((sum, row) => {
          const info = row.info as Record<string, unknown>;
          return sum + BigInt((info?.votingPowerLovelace as string) || '0');
        }, BigInt(0));

        const { error } = await supabase.from('governance_participation_snapshots').insert({
          epoch,
          active_drep_count: activeDreps,
          total_drep_count: totalDreps,
          participation_rate: participationRate,
          rationale_rate: rationaleRate,
          total_voting_power_lovelace: totalPower.toString(),
        });

        if (error) throw new Error(error.message);

        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'governance_participation',
            epoch_no: epoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: 1,
            expected_count: 1,
            coverage_pct: 100,
            metadata: { participation_rate: participationRate },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );

        logger.info('[epoch-summary] Participation snapshot stored', {
          activeDreps,
          totalDreps,
          participationRate,
          epoch,
        });
        return { inserted: true, activeDreps, totalDreps, participationRate };
      } catch (err) {
        logger.error('[epoch-summary] Participation snapshot failed', { error: err });
        return { error: errMsg(err) };
      }
    });

    // Step 7: Governance epoch stats
    const epochStats = await step.run('snapshot-governance-epoch-stats', async () => {
      try {
        const supabase = getSupabaseAdmin();
        const { data: existing } = await supabase
          .from('governance_epoch_stats')
          .select('epoch_no')
          .eq('epoch_no', epoch)
          .maybeSingle();
        if (existing) return { skipped: true };

        const [votes, rationales, submitted, ratified, expired, dropped, totalProposals, scores] =
          await Promise.all([
            supabase.from('drep_votes').select('drep_id').eq('epoch_no', epoch),
            supabase
              .from('drep_votes')
              .select('vote_tx_hash', { count: 'exact', head: true })
              .eq('epoch_no', epoch)
              .not('meta_url', 'is', null),
            supabase
              .from('proposals')
              .select('tx_hash', { count: 'exact', head: true })
              .eq('proposed_epoch', epoch),
            supabase
              .from('proposals')
              .select('tx_hash', { count: 'exact', head: true })
              .eq('ratified_epoch', epoch),
            supabase
              .from('proposals')
              .select('tx_hash', { count: 'exact', head: true })
              .eq('expired_epoch', epoch),
            supabase
              .from('proposals')
              .select('tx_hash', { count: 'exact', head: true })
              .eq('dropped_epoch', epoch),
            supabase
              .from('proposals')
              .select('tx_hash', { count: 'exact', head: true })
              .lte('proposed_epoch', epoch),
            supabase
              .from('drep_score_history')
              .select('score')
              .eq('epoch_no', epoch)
              .not('score', 'is', null),
          ]);

        const uniqueVoters = new Set((votes.data || []).map((v) => v.drep_id));
        const activeDreps = uniqueVoters.size;
        const allVoters = await supabase
          .from('drep_votes')
          .select('drep_id')
          .lte('epoch_no', epoch);
        const totalDreps = new Set((allVoters.data || []).map((v) => v.drep_id)).size;
        const totalVotes = (votes.data || []).length;
        const participationRate =
          totalDreps > 0 ? Math.round((activeDreps / totalDreps) * 10000) / 100 : 0;
        const rationaleRate =
          totalVotes > 0 ? Math.round(((rationales.count || 0) / totalVotes) * 10000) / 100 : 0;
        const avgScore =
          scores.data && scores.data.length > 0
            ? Math.round(
                (scores.data.reduce((s, r) => s + (r.score || 0), 0) / scores.data.length) * 100,
              ) / 100
            : null;

        const { error } = await supabase.from('governance_epoch_stats').upsert(
          {
            epoch_no: epoch,
            total_dreps: totalDreps,
            active_dreps: activeDreps,
            total_proposals: totalProposals.count || 0,
            proposals_submitted: submitted.count || 0,
            proposals_ratified: ratified.count || 0,
            proposals_expired: expired.count || 0,
            proposals_dropped: dropped.count || 0,
            participation_rate: participationRate,
            rationale_rate: rationaleRate,
            avg_drep_score: avgScore,
            computed_at: new Date().toISOString(),
          },
          { onConflict: 'epoch_no' },
        );
        if (error) throw new Error(error.message);
        return { inserted: true };
      } catch (err) {
        logger.error('[epoch-summary] Epoch stats snapshot failed', { error: err });
        return { error: errMsg(err) };
      }
    });

    // Step 8: Vote snapshots + inter-body alignment for active proposals
    const voteSnapshots = await step.run('snapshot-vote-alignment', async () => {
      try {
        const supabase = getSupabaseAdmin();

        // Get proposals that were active during this epoch
        const { data: activeProposals } = await supabase
          .from('proposals')
          .select('tx_hash, proposal_index')
          .lte('proposed_epoch', epoch)
          .or(
            `enacted_epoch.gte.${epoch},ratified_epoch.gte.${epoch},expired_epoch.gte.${epoch},dropped_epoch.gte.${epoch},enacted_epoch.is.null`,
          );

        if (!activeProposals || activeProposals.length === 0) return { skipped: true };

        let snapshotted = 0;
        for (const prop of activeProposals) {
          const [drepVotes, spoVotes, ccVotes] = await Promise.all([
            supabase
              .from('drep_votes')
              .select('vote, voting_power_lovelace')
              .eq('proposal_tx_hash', prop.tx_hash)
              .eq('proposal_index', prop.proposal_index)
              .eq('epoch_no', epoch),
            supabase
              .from('spo_votes')
              .select('vote')
              .eq('proposal_tx_hash', prop.tx_hash)
              .eq('proposal_index', prop.proposal_index)
              .eq('epoch', epoch),
            supabase
              .from('cc_votes')
              .select('vote')
              .eq('proposal_tx_hash', prop.tx_hash)
              .eq('proposal_index', prop.proposal_index)
              .eq('epoch', epoch),
          ]);

          const dv = drepVotes.data || [];
          const sv = spoVotes.data || [];
          const cv = ccVotes.data || [];
          if (dv.length === 0 && sv.length === 0 && cv.length === 0) continue;

          const drepYes = dv.filter((v) => v.vote === 'Yes');
          const drepNo = dv.filter((v) => v.vote === 'No');
          const drepAbstain = dv.filter((v) => v.vote === 'Abstain');

          await supabase.from('proposal_vote_snapshots').upsert(
            {
              epoch,
              proposal_tx_hash: prop.tx_hash,
              proposal_index: prop.proposal_index,
              drep_yes_count: drepYes.length,
              drep_no_count: drepNo.length,
              drep_abstain_count: drepAbstain.length,
              drep_yes_power: drepYes.reduce((s, v) => s + Number(v.voting_power_lovelace || 0), 0),
              drep_no_power: drepNo.reduce((s, v) => s + Number(v.voting_power_lovelace || 0), 0),
              spo_yes_count: sv.filter((v) => v.vote === 'Yes').length,
              spo_no_count: sv.filter((v) => v.vote === 'No').length,
              spo_abstain_count: sv.filter((v) => v.vote === 'Abstain').length,
              cc_yes_count: cv.filter((v) => v.vote === 'Yes').length,
              cc_no_count: cv.filter((v) => v.vote === 'No').length,
              cc_abstain_count: cv.filter((v) => v.vote === 'Abstain').length,
              snapshot_at: new Date().toISOString(),
            },
            { onConflict: 'epoch,proposal_tx_hash,proposal_index' },
          );

          // Inter-body alignment
          const dTotal = dv.length;
          const sTotal = sv.length;
          const cTotal = cv.length;
          const dYesPct = dTotal > 0 ? Math.round((drepYes.length / dTotal) * 10000) / 100 : 0;
          const sYesPct =
            sTotal > 0
              ? Math.round((sv.filter((v) => v.vote === 'Yes').length / sTotal) * 10000) / 100
              : 0;
          const cYesPct =
            cTotal > 0
              ? Math.round((cv.filter((v) => v.vote === 'Yes').length / cTotal) * 10000) / 100
              : 0;

          const bodies = [
            dTotal > 0 ? dYesPct : null,
            sTotal > 0 ? sYesPct : null,
            cTotal > 0 ? cYesPct : null,
          ].filter((v): v is number => v !== null);

          let alignScore = 100;
          if (bodies.length >= 2) {
            let diff = 0;
            let pairs = 0;
            for (let i = 0; i < bodies.length; i++) {
              for (let j = i + 1; j < bodies.length; j++) {
                diff += Math.abs(bodies[i] - bodies[j]);
                pairs++;
              }
            }
            alignScore = Math.round((100 - diff / pairs) * 100) / 100;
          }

          await supabase.from('inter_body_alignment_snapshots').upsert(
            {
              epoch,
              proposal_tx_hash: prop.tx_hash,
              proposal_index: prop.proposal_index,
              drep_yes_pct: dYesPct,
              drep_no_pct: dTotal > 0 ? Math.round((drepNo.length / dTotal) * 10000) / 100 : 0,
              drep_total: dTotal,
              spo_yes_pct: sYesPct,
              spo_no_pct:
                sTotal > 0
                  ? Math.round((sv.filter((v) => v.vote === 'No').length / sTotal) * 10000) / 100
                  : 0,
              spo_total: sTotal,
              cc_yes_pct: cYesPct,
              cc_no_pct:
                cTotal > 0
                  ? Math.round((cv.filter((v) => v.vote === 'No').length / cTotal) * 10000) / 100
                  : 0,
              cc_total: cTotal,
              alignment_score: Math.max(0, Math.min(100, alignScore)),
              snapshot_at: new Date().toISOString(),
            },
            { onConflict: 'epoch,proposal_tx_hash,proposal_index' },
          );
          snapshotted++;
        }
        return { snapshotted, proposals: activeProposals.length };
      } catch (err) {
        logger.error('[epoch-summary] Vote/alignment snapshots failed', { error: err });
        return { error: errMsg(err) };
      }
    });

    // Step 9: Delegation snapshots from power snapshots
    const delegationSnapshot = await step.run('snapshot-delegation', async () => {
      try {
        const supabase = getSupabaseAdmin();
        const { data: powerSnaps } = await supabase
          .from('drep_power_snapshots')
          .select('drep_id, amount_lovelace, delegator_count')
          .eq('epoch_no', epoch);

        if (!powerSnaps || powerSnaps.length === 0) return { skipped: true };

        const rows = powerSnaps.map((s) => ({
          epoch,
          drep_id: s.drep_id,
          delegator_count: s.delegator_count || 0,
          total_power_lovelace: s.amount_lovelace,
          snapshot_at: new Date().toISOString(),
        }));

        for (let i = 0; i < rows.length; i += 100) {
          await supabase
            .from('delegation_snapshots')
            .upsert(rows.slice(i, i + 100), { onConflict: 'epoch,drep_id' });
        }
        return { inserted: rows.length };
      } catch (err) {
        logger.error('[epoch-summary] Delegation snapshot failed', { error: err });
        return { error: errMsg(err) };
      }
    });

    // Trigger citizen briefing generation for the new epoch
    await step.sendEvent('trigger-citizen-briefings', {
      name: 'drepscore/epoch.transition',
      data: { epoch: epochInfo.currentEpoch, previousEpoch: epoch },
    });

    logger.info('[epoch-summary] Epoch summary generated', { epoch, usersProcessed });
    return {
      epoch,
      usersProcessed,
      ...proposalStats,
      recap: recapResult,
      enrichment: enrichResult,
      participation: participationSnapshot,
      epochStats,
      voteSnapshots,
      delegationSnapshot,
    };
  },
);

function extractDrepId(history: unknown): string | null {
  if (!Array.isArray(history) || history.length === 0) return null;
  const latest = history[history.length - 1];
  return typeof latest === 'object' && latest !== null && 'drepId' in latest
    ? (latest as { drepId: string }).drepId
    : null;
}
