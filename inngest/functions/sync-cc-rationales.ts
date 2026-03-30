/**
 * CC Rationale Sync — fetches CIP-136 rationale documents for CC votes,
 * parses structured fields, computes Constitutional Fidelity scores,
 * and updates cc_rationales + cc_members tables.
 *
 * Runs after sync-spo-cc-votes to process any new CC votes with meta_url.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { fetchCip136Rationale } from '@/lib/cc/parseCip136';
import {
  computeRationaleProvision,
  computeAvgArticleCoverage,
  computeAvgReasoningQuality,
} from '@/lib/cc/fidelityScore';
import { computeFullConstitutionalFidelity } from '@/lib/scoring/ccTransparency';
import type { CCMemberVoteData } from '@/lib/scoring/ccTransparency';
import { logger } from '@/lib/logger';
import { errMsg, capMsg, alertCritical } from '@/lib/sync-utils';
import { fetchCommitteeInfo } from '@/utils/koios';

export const syncCcRationales = inngest.createFunction(
  {
    id: 'sync-cc-rationales',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"cc-rationales"' },
    onFailure: async ({ error }) => {
      const sb = getSupabaseAdmin();
      const msg = errMsg(error);
      logger.error('[cc-rationales] Function failed permanently', { error });
      await sb
        .from('sync_log')
        .update({
          finished_at: new Date().toISOString(),
          success: false,
          error_message: capMsg(`onFailure: ${msg}`),
        })
        .eq('sync_type', 'cc_votes')
        .is('finished_at', null);
      await alertCritical(
        'CC Rationales Sync Failed',
        `CC rationales sync failed after all retries.\nError: ${msg}\nCheck logs for details.`,
      );
    },
    triggers: [{ cron: '15 */6 * * *' }, { event: 'drepscore/sync.cc-rationales' }],
  },
  async ({ step }) => {
    // Step 1: Fetch and parse rationale documents for CC votes
    const fetchResult = await step.run('fetch-rationales', async () => {
      const supabase = getSupabaseAdmin();

      // Get CC votes that have meta_url but no cached rationale yet
      const { data: votes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, meta_url, meta_hash')
        .not('meta_url', 'is', null);

      if (!votes?.length) return { fetched: 0, cached: 0 };

      // Check which ones are already cached
      const { data: existing } = await supabase
        .from('cc_rationales')
        .select('cc_hot_id, proposal_tx_hash, proposal_index');

      const existingKeys = new Set(
        (existing ?? []).map((e) => `${e.cc_hot_id}:${e.proposal_tx_hash}:${e.proposal_index}`),
      );

      const uncached = votes.filter(
        (v) => !existingKeys.has(`${v.cc_hot_id}:${v.proposal_tx_hash}:${v.proposal_index}`),
      );

      if (uncached.length === 0)
        return { fetched: votes.length, cached: 0, alreadyCached: votes.length };

      let cached = 0;
      // Process in batches of 5 to avoid overwhelming IPFS gateways
      for (let i = 0; i < uncached.length; i += 5) {
        const batch = uncached.slice(i, i + 5);
        const results = await Promise.allSettled(
          batch.map(async (v) => {
            const rationale = await fetchCip136Rationale(v.meta_url!);
            if (!rationale) return null;

            const { error } = await supabase.from('cc_rationales').upsert(
              {
                cc_hot_id: v.cc_hot_id,
                proposal_tx_hash: v.proposal_tx_hash,
                proposal_index: v.proposal_index,
                meta_url: v.meta_url!,
                meta_hash: v.meta_hash,
                author_name: rationale.authorName,
                summary: rationale.summary,
                rationale_statement: rationale.rationaleStatement,
                precedent_discussion: rationale.precedentDiscussion,
                counterargument_discussion: rationale.counterargumentDiscussion,
                conclusion: rationale.conclusion,
                internal_vote: rationale.internalVote as string | null,
                cited_articles: rationale.citedArticles as unknown,
                raw_json: rationale.rawJson as unknown,
                fetched_at: new Date().toISOString(),
              },
              { onConflict: 'cc_hot_id,proposal_tx_hash,proposal_index' },
            );

            if (error) {
              logger.error('[sync-cc-rationales] Upsert failed', { error: error.message });
              return null;
            }
            return rationale;
          }),
        );

        cached += results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;
      }

      return { fetched: votes.length, cached, uncachedTotal: uncached.length };
    });

    // Step 2: Sync CC member metadata from committee_info + rationale authors
    const memberResult = await step.run('sync-members', async () => {
      const supabase = getSupabaseAdmin();

      try {
        // Use shared fetchCommitteeInfo which handles both field name variants
        const committeeData = await fetchCommitteeInfo();
        if (!committeeData?.members?.length) return { members: 0, source: 'no_data' };

        // Get author names from rationales
        const { data: authorNames } = await supabase
          .from('cc_rationales')
          .select('cc_hot_id, author_name')
          .not('author_name', 'is', null);

        const authorMap = new Map<string, string>();
        for (const a of authorNames ?? []) {
          if (a.author_name) authorMap.set(a.cc_hot_id, a.author_name);
        }

        // Upsert members
        let upserted = 0;
        for (const m of committeeData.members) {
          const { error } = await supabase.from('cc_members').upsert(
            {
              cc_hot_id: m.cc_hot_id,
              cc_cold_id: m.cc_cold_id,
              author_name: authorMap.get(m.cc_hot_id) ?? null,
              status: m.status,
              expiration_epoch: m.expiration_epoch,
              authorization_epoch: m.start_epoch ?? null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'cc_hot_id' },
          );
          if (!error) upserted++;
        }

        return { members: upserted };
      } catch (err) {
        logger.error('[sync-cc-rationales] Member sync failed', { error: err });
        return { members: 0, error: errMsg(err) };
      }
    });

    // Step 3: Compute fidelity scores per member
    const scoreResult = await step.run('compute-fidelity', async () => {
      const supabase = getSupabaseAdmin();

      // Get all CC votes with proposal types
      const { data: votes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote, block_time, meta_url');

      // Get proposal types and block times
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, proposal_type, block_time');

      // Get cached rationales
      const { data: rationales } = await supabase
        .from('cc_rationales')
        .select(
          'cc_hot_id, proposal_tx_hash, proposal_index, cited_articles, reasoning_quality_score',
        );

      if (!votes?.length) return { scored: 0 };

      // Build lookups
      const proposalMap = new Map<string, { type: string; blockTime: number }>();
      for (const p of proposals ?? []) {
        proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, {
          type: p.proposal_type,
          blockTime: p.block_time,
        });
      }

      const rationaleMap = new Map<
        string,
        { citedArticles: string[]; reasoningScore: number | null }
      >();
      for (const r of rationales ?? []) {
        rationaleMap.set(`${r.cc_hot_id}:${r.proposal_tx_hash}:${r.proposal_index}`, {
          citedArticles: (r.cited_articles as string[]) ?? [],
          reasoningScore: r.reasoning_quality_score,
        });
      }

      // Group votes by member
      const memberVotes = new Map<
        string,
        Array<{
          proposalTxHash: string;
          proposalIndex: number;
          vote: string;
          blockTime: number;
          hasRationale: boolean;
        }>
      >();
      for (const v of votes) {
        const list = memberVotes.get(v.cc_hot_id) ?? [];
        list.push({
          proposalTxHash: v.proposal_tx_hash,
          proposalIndex: v.proposal_index,
          vote: v.vote,
          blockTime: v.block_time,
          hasRationale: !!v.meta_url,
        });
        memberVotes.set(v.cc_hot_id, list);
      }

      let scored = 0;
      for (const [ccHotId, mvotes] of memberVotes) {
        const totalVotes = mvotes.length;
        const votesWithRationale = mvotes.filter((v) => v.hasRationale).length;

        // Pillar 1: Rationale Provision
        const rationaleProvision = computeRationaleProvision(totalVotes, votesWithRationale);

        // Pillar 2: Article Coverage (only for votes with rationales)
        const votesWithArticleData: Array<{ proposalType: string; citedArticles: string[] }> = [];
        for (const v of mvotes) {
          const rKey = `${ccHotId}:${v.proposalTxHash}:${v.proposalIndex}`;
          const rationale = rationaleMap.get(rKey);
          if (rationale) {
            const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;
            const proposal = proposalMap.get(pKey);
            votesWithArticleData.push({
              proposalType: proposal?.type ?? 'InfoAction',
              citedArticles: rationale.citedArticles,
            });
          }
        }
        const articleCoverage = computeAvgArticleCoverage(votesWithArticleData);

        // Pillar 3: Reasoning Quality (from AI scores if available)
        const qualityScores: number[] = [];
        for (const v of mvotes) {
          const rKey = `${ccHotId}:${v.proposalTxHash}:${v.proposalIndex}`;
          const rationale = rationaleMap.get(rKey);
          if (rationale?.reasoningScore != null) {
            qualityScores.push(rationale.reasoningScore);
          }
        }
        // If no AI scores yet, estimate from rationale presence + article coverage
        const reasoningQuality =
          qualityScores.length > 0
            ? computeAvgReasoningQuality(qualityScores)
            : votesWithRationale > 0
              ? Math.round(articleCoverage * 0.7 + rationaleProvision * 0.3)
              : 0;

        // Update cc_members with granular pillar values
        const { error } = await supabase.from('cc_members').upsert(
          {
            cc_hot_id: ccHotId,
            rationale_provision_rate: rationaleProvision,
            avg_article_coverage: articleCoverage,
            avg_reasoning_quality: reasoningQuality,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cc_hot_id' },
        );

        if (!error) scored++;
      }

      return { scored };
    });

    // Step 4: Compute Constitutional Fidelity Score + persist snapshots
    const transparencyResult = await step.run('compute-constitutional-fidelity', async () => {
      const supabase = getSupabaseAdmin();

      // Get current epoch
      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = stats?.current_epoch ?? 0;

      // Get all CC votes (include epoch for tenure-start proxy)
      const { data: votes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote, block_time, epoch, meta_url');

      // Get proposals for eligible count and type lookups
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, proposal_index, proposal_type, block_time, proposed_epoch');

      // Get rationales
      const { data: rationales } = await supabase
        .from('cc_rationales')
        .select(
          'cc_hot_id, proposal_tx_hash, proposal_index, cited_articles, reasoning_quality_score',
        );

      // Get AI analysis scores (deliberation_quality + boilerplate_score)
      const { data: aiAnalyses } = await supabase
        .from('cc_rationale_analysis')
        .select(
          'cc_hot_id, proposal_tx_hash, proposal_index, deliberation_quality, boilerplate_score',
        );

      if (!votes?.length || !proposals?.length) return { scored: 0 };

      // Build lookups
      const proposalMap = new Map<string, { type: string; blockTime: number }>();
      for (const p of proposals) {
        proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, {
          type: p.proposal_type,
          blockTime: p.block_time,
        });
      }

      const rationaleMap = new Map<
        string,
        { citedArticles: string[]; reasoningScore: number | null }
      >();
      for (const r of rationales ?? []) {
        rationaleMap.set(`${r.cc_hot_id}:${r.proposal_tx_hash}:${r.proposal_index}`, {
          citedArticles: (r.cited_articles as string[]) ?? [],
          reasoningScore: r.reasoning_quality_score,
        });
      }

      // Global fallback eligible count
      const globalEligibleProposals = new Set(
        proposals.map((p) => `${p.tx_hash}:${p.proposal_index}`),
      ).size;

      // Fetch cc_members authorization/expiration epochs for per-member eligibility
      const { data: ccMembers } = await supabase
        .from('cc_members')
        .select('cc_hot_id, authorization_epoch, expiration_epoch');

      const memberEpochMap = new Map<
        string,
        { authorization_epoch: number | null; expiration_epoch: number | null }
      >();
      for (const m of ccMembers ?? []) {
        memberEpochMap.set(m.cc_hot_id, {
          authorization_epoch: m.authorization_epoch,
          expiration_epoch: m.expiration_epoch,
        });
      }

      // Build earliest vote epoch per member (proxy for tenure start when authorization_epoch is null)
      const earliestVoteEpoch = new Map<string, number>();
      for (const v of votes) {
        if (v.epoch != null) {
          const prev = earliestVoteEpoch.get(v.cc_hot_id);
          if (prev === undefined || v.epoch < prev) earliestVoteEpoch.set(v.cc_hot_id, v.epoch);
        }
      }

      // Build AI scores lookup: cc_hot_id → array of {deliberationQuality, boilerplateScore}
      const memberAiScores = new Map<
        string,
        { deliberationQuality: number; boilerplateScore: number | null }[]
      >();
      for (const a of aiAnalyses ?? []) {
        if (a.deliberation_quality == null) continue;
        const list = memberAiScores.get(a.cc_hot_id) ?? [];
        list.push({
          deliberationQuality: a.deliberation_quality,
          boilerplateScore: a.boilerplate_score ?? null,
        });
        memberAiScores.set(a.cc_hot_id, list);
      }

      // Group votes by member
      const memberVotes = new Map<string, CCMemberVoteData[]>();
      for (const v of votes) {
        const list = memberVotes.get(v.cc_hot_id) ?? [];
        list.push({
          proposalTxHash: v.proposal_tx_hash,
          proposalIndex: v.proposal_index,
          vote: v.vote,
          blockTime: v.block_time,
          hasRationale: !!v.meta_url,
        });
        memberVotes.set(v.cc_hot_id, list);
      }

      let scored = 0;
      for (const [ccHotId, mvotes] of memberVotes) {
        // Per-member eligible proposals based on authorization/expiration epochs.
        // When authorization_epoch is null (Koios doesn't always return start_epoch
        // for newly authorized members), use the member's earliest vote epoch as a
        // proxy for tenure start. This prevents penalizing new members for not voting
        // on proposals from before their authorization.
        const epochs = memberEpochMap.get(ccHotId);
        const authEpoch = epochs?.authorization_epoch ?? earliestVoteEpoch.get(ccHotId) ?? null;

        const memberEligible = proposals.filter((p) => {
          if (!authEpoch || !p.proposed_epoch) return true;
          if (p.proposed_epoch < authEpoch) return false;
          if (epochs?.expiration_epoch && p.proposed_epoch > epochs.expiration_epoch) return false;
          return true;
        });
        const memberEligibleCount = new Set(
          memberEligible.map((p) => `${p.tx_hash}:${p.proposal_index}`),
        ).size;

        const result = computeFullConstitutionalFidelity({
          ccHotId,
          votes: mvotes,
          proposalMap,
          rationaleMap,
          aiScores: memberAiScores.get(ccHotId) ?? [],
          totalEligibleProposals: memberEligibleCount || globalEligibleProposals,
        });

        // Update cc_members with Constitutional Fidelity Score (4-pillar model)
        const { error } = await supabase.from('cc_members').upsert(
          {
            cc_hot_id: ccHotId,
            fidelity_score: result.score,
            fidelity_grade: result.grade,
            participation_score: result.pillars.participation,
            rationale_provision_rate: result.pillars.rationaleProvision,
            avg_reasoning_quality: result.pillars.reasoningQuality,
            constitutional_grounding_score: result.pillars.constitutionalEngagement,
            votes_cast: result.votesCast,
            eligible_proposals: result.eligibleProposals,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cc_hot_id' },
        );

        // Persist snapshot with explicit error logging
        if (!error && currentEpoch > 0) {
          const { error: snapError } = await supabase.from('cc_fidelity_snapshots').upsert(
            {
              cc_hot_id: ccHotId,
              epoch_no: currentEpoch,
              fidelity_score: result.score,
              participation_score: result.pillars.participation,
              rationale_quality_score: result.pillars.reasoningQuality,
              constitutional_grounding_score: result.pillars.constitutionalEngagement,
              votes_cast: result.votesCast,
              eligible_proposals: result.eligibleProposals,
            },
            { onConflict: 'cc_hot_id,epoch_no' },
          );
          if (snapError) {
            logger.error('[sync-cc-rationales] Fidelity snapshot upsert failed', {
              ccHotId,
              epoch: currentEpoch,
              error: snapError.message,
            });
          }
        }

        if (!error) scored++;
      }

      // Log snapshot completeness for cc_fidelity
      if (currentEpoch > 0) {
        const { count: snapshotCount } = await supabase
          .from('cc_fidelity_snapshots')
          .select('cc_hot_id', { count: 'exact', head: true })
          .eq('epoch_no', currentEpoch);

        const expectedCount = memberVotes.size;
        const actualCount = snapshotCount ?? 0;
        const coveragePct =
          expectedCount > 0 ? Math.round((actualCount / expectedCount) * 10000) / 100 : 100;

        await supabase.from('snapshot_completeness_log').upsert(
          {
            snapshot_type: 'cc_fidelity',
            epoch_no: currentEpoch,
            snapshot_date: new Date().toISOString().slice(0, 10),
            record_count: actualCount,
            expected_count: expectedCount,
            coverage_pct: coveragePct,
            metadata: { scored, epoch: currentEpoch },
          },
          { onConflict: 'snapshot_type,epoch_no,snapshot_date' },
        );

        logger.info('[sync-cc-rationales] Constitutional Fidelity snapshots stored', {
          scored,
          snapshotCount: actualCount,
          expected: expectedCount,
          epoch: currentEpoch,
        });
      }

      return { scored, epoch: currentEpoch };
    });

    // Step 5: Create proposal-anchored fidelity snapshots for terminal proposals
    const proposalSnapshotResult = await step.run('snapshot-proposal-scores', async () => {
      const supabase = getSupabaseAdmin();

      // Get current epoch
      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = stats?.current_epoch ?? 0;

      // Fetch proposals that have reached a terminal state
      const { data: allProposals } = await supabase
        .from('proposals')
        .select(
          'tx_hash, proposal_index, proposed_epoch, ratified_epoch, dropped_epoch, enacted_epoch, expired_epoch, expiration_epoch',
        );

      if (!allProposals?.length) return { snapshotted: 0 };

      const terminalProposals = allProposals.filter(
        (p) =>
          p.ratified_epoch != null ||
          p.dropped_epoch != null ||
          p.enacted_epoch != null ||
          p.expired_epoch != null ||
          (p.expiration_epoch != null && p.expiration_epoch <= currentEpoch),
      );

      if (terminalProposals.length === 0) return { snapshotted: 0 };

      // Fetch existing snapshots to skip already-snapshotted proposals
      const { data: existingSnapshots } = await supabase
        .from('cc_fidelity_proposal_snapshots')
        .select('cc_hot_id, proposal_tx_hash, proposal_index');

      const existingKeys = new Set(
        (existingSnapshots ?? []).map(
          (s) => `${s.cc_hot_id}:${s.proposal_tx_hash}:${s.proposal_index}`,
        ),
      );

      // Fetch CC votes on terminal proposals
      const { data: ccVotes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index');

      // Fetch current cumulative fidelity scores from cc_members
      const { data: members } = await supabase
        .from('cc_members')
        .select(
          'cc_hot_id, fidelity_score, participation_score, constitutional_grounding_score, rationale_quality_score, votes_cast, eligible_proposals',
        );

      const memberScoreMap = new Map<
        string,
        {
          fidelity_score: number | null;
          participation_score: number | null;
          constitutional_grounding_score: number | null;
          rationale_quality_score: number | null;
          votes_cast: number | null;
          eligible_proposals: number | null;
        }
      >();
      for (const m of members ?? []) {
        memberScoreMap.set(m.cc_hot_id, {
          fidelity_score: m.fidelity_score,
          participation_score: m.participation_score,
          constitutional_grounding_score: m.constitutional_grounding_score,
          rationale_quality_score: m.rationale_quality_score,
          votes_cast: m.votes_cast,
          eligible_proposals: m.eligible_proposals,
        });
      }

      // Build set of terminal proposal keys
      const terminalKeys = new Set(
        terminalProposals.map((p) => `${p.tx_hash}:${p.proposal_index}`),
      );
      const terminalEpochMap = new Map<string, number | null>();
      for (const p of terminalProposals) {
        terminalEpochMap.set(`${p.tx_hash}:${p.proposal_index}`, p.proposed_epoch);
      }

      // For each CC vote on a terminal proposal, create a snapshot if not already exists
      let snapshotted = 0;
      const rows: Array<{
        cc_hot_id: string;
        proposal_tx_hash: string;
        proposal_index: number;
        proposal_epoch: number | null;
        fidelity_score: number | null;
        participation_score: number | null;
        constitutional_grounding_score: number | null;
        reasoning_quality_score: number | null;
        votes_cast: number | null;
        eligible_proposals: number | null;
        snapshotted_at: string;
      }> = [];

      for (const v of ccVotes ?? []) {
        const pKey = `${v.proposal_tx_hash}:${v.proposal_index}`;
        if (!terminalKeys.has(pKey)) continue;

        const snapKey = `${v.cc_hot_id}:${v.proposal_tx_hash}:${v.proposal_index}`;
        if (existingKeys.has(snapKey)) continue;

        const scores = memberScoreMap.get(v.cc_hot_id);
        if (!scores) continue;

        rows.push({
          cc_hot_id: v.cc_hot_id,
          proposal_tx_hash: v.proposal_tx_hash,
          proposal_index: v.proposal_index,
          proposal_epoch: terminalEpochMap.get(pKey) ?? null,
          fidelity_score: scores.fidelity_score,
          participation_score: scores.participation_score,
          constitutional_grounding_score: scores.constitutional_grounding_score,
          reasoning_quality_score: scores.rationale_quality_score,
          votes_cast: scores.votes_cast,
          eligible_proposals: scores.eligible_proposals,
          snapshotted_at: new Date().toISOString(),
        });
      }

      // Batch upsert in chunks of 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase
          .from('cc_fidelity_proposal_snapshots')
          .upsert(batch, { onConflict: 'cc_hot_id,proposal_tx_hash,proposal_index' });

        if (error) {
          logger.error('[sync-cc-rationales] Proposal snapshot upsert failed', {
            error: error.message,
            batch: i,
          });
        } else {
          snapshotted += batch.length;
        }
      }

      logger.info('[sync-cc-rationales] Proposal fidelity snapshots created', {
        snapshotted,
        terminalProposals: terminalProposals.length,
      });

      return { snapshotted };
    });

    // Emit event for downstream Constitutional Intelligence pipeline
    await step.sendEvent('cc-rationale-sync-done', {
      name: 'cc/rationales.synced',
      data: { count: fetchResult?.cached ?? 0 },
    });

    return {
      rationales: fetchResult,
      members: memberResult,
      scores: scoreResult,
      transparency: transparencyResult,
      proposalSnapshots: proposalSnapshotResult,
    };
  },
);
