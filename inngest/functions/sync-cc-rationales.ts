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
  computeFidelityScore,
  computeRationaleProvision,
  computeAvgArticleCoverage,
  computeAvgReasoningQuality,
  computeConsistencyIndependence,
} from '@/lib/cc/fidelityScore';
import { computeFullTransparencyIndex } from '@/lib/scoring/ccTransparency';
import type { CCMemberVoteData } from '@/lib/scoring/ccTransparency';
import { logger } from '@/lib/logger';
import { errMsg } from '@/lib/sync-utils';

export const syncCcRationales = inngest.createFunction(
  {
    id: 'sync-cc-rationales',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"cc-rationales"' },
  },
  [{ cron: '15 */6 * * *' }, { event: 'drepscore/sync.cc-rationales' }],
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
                internal_vote: rationale.internalVote as any,
                cited_articles: rationale.citedArticles as any,
                raw_json: rationale.rawJson as any,
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
        // Fetch committee_info from Koios
        const res = await fetch('https://api.koios.rest/api/v1/committee_info?limit=10', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15_000),
        });

        if (!res.ok) return { members: 0, source: 'koios_failed' };
        const data = await res.json();

        // committee_info returns proposals with nested members array
        const allMembers: Array<{
          cc_hot_id: string;
          cc_cold_id: string;
          status: string;
          expiration_epoch: number;
          has_script: boolean;
        }> = [];

        for (const proposal of data) {
          if (Array.isArray(proposal.members)) {
            for (const m of proposal.members) {
              if (m.cc_hot_id) {
                allMembers.push({
                  cc_hot_id: m.cc_hot_id,
                  cc_cold_id: m.cc_cold_id ?? null,
                  status: m.status ?? 'unknown',
                  expiration_epoch: m.expiration_epoch ?? null,
                  has_script: m.cc_hot_has_script ?? false,
                });
              }
            }
          }
        }

        // Dedupe by cc_hot_id (keep latest)
        const memberMap = new Map<string, (typeof allMembers)[0]>();
        for (const m of allMembers) memberMap.set(m.cc_hot_id, m);

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
        for (const [hotId, m] of memberMap) {
          const { error } = await supabase.from('cc_members').upsert(
            {
              cc_hot_id: hotId,
              cc_cold_id: m.cc_cold_id,
              author_name: authorMap.get(hotId) ?? null,
              status: m.status,
              expiration_epoch: m.expiration_epoch,
              has_script: m.has_script,
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
        .select('tx_hash, index, proposal_type, block_time');

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
        proposalMap.set(`${p.tx_hash}:${p.index}`, {
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

      // Get DRep alignment data for independence scoring
      const { data: alignmentRows } = await supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct');

      const drepMajorityMap = new Map<string, string>();
      for (const row of alignmentRows ?? []) {
        const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
        drepMajorityMap.set(
          key,
          row.drep_yes_pct > row.drep_no_pct
            ? 'Yes'
            : row.drep_no_pct > row.drep_yes_pct
              ? 'No'
              : 'Abstain',
        );
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

      // Compute distinct active proposal types
      const activeTypes = new Set(Array.from(proposalMap.values()).map((p) => p.type));

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

        // Pillar 4: Consistency & Independence
        let drepAgreements = 0;
        let drepComparisons = 0;
        let totalDaysToVote = 0;
        let responsiveVotes = 0;
        const memberTypes = new Set<string>();

        for (const v of mvotes) {
          const pKey = `${v.proposalTxHash}:${v.proposalIndex}`;
          const proposal = proposalMap.get(pKey);
          if (proposal) {
            memberTypes.add(proposal.type);
            // Responsiveness
            const daysToVote = (v.blockTime - proposal.blockTime) / 86400;
            if (daysToVote >= 0) {
              totalDaysToVote += daysToVote;
              responsiveVotes++;
            }
          }

          const drepMajority = drepMajorityMap.get(pKey);
          if (drepMajority && drepMajority !== 'Abstain') {
            drepComparisons++;
            if (v.vote === drepMajority) drepAgreements++;
          }
        }

        const drepAlignmentPct =
          drepComparisons > 0 ? (drepAgreements / drepComparisons) * 100 : 50;
        const avgDaysToVote = responsiveVotes > 0 ? totalDaysToVote / responsiveVotes : 10;

        const consistencyIndependence = computeConsistencyIndependence(
          drepAlignmentPct,
          avgDaysToVote,
          memberTypes.size,
          activeTypes.size,
        );

        // Compute composite score
        const result = computeFidelityScore({
          rationaleProvision,
          articleCoverage,
          reasoningQuality,
          consistencyIndependence,
        });

        // Update cc_members with scores
        const { error } = await supabase.from('cc_members').upsert(
          {
            cc_hot_id: ccHotId,
            fidelity_score: result.score,
            rationale_provision_rate: rationaleProvision,
            avg_article_coverage: articleCoverage,
            avg_reasoning_quality: reasoningQuality,
            consistency_score: consistencyIndependence,
            responsiveness_score: Math.round(avgDaysToVote * 10) / 10,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cc_hot_id' },
        );

        if (!error) scored++;
      }

      return { scored };
    });

    // Step 4: Compute Transparency Index + persist snapshots
    const transparencyResult = await step.run('compute-transparency-index', async () => {
      const supabase = getSupabaseAdmin();

      // Get current epoch
      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = stats?.current_epoch ?? 0;

      // Get all CC votes
      const { data: votes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote, block_time, meta_url');

      // Get proposals for eligible count and type lookups
      const { data: proposals } = await supabase
        .from('proposals')
        .select('tx_hash, index, proposal_type, block_time');

      // Get rationales
      const { data: rationales } = await supabase
        .from('cc_rationales')
        .select(
          'cc_hot_id, proposal_tx_hash, proposal_index, cited_articles, reasoning_quality_score',
        );

      if (!votes?.length || !proposals?.length) return { scored: 0 };

      // Build lookups
      const proposalMap = new Map<string, { type: string; blockTime: number }>();
      for (const p of proposals) {
        proposalMap.set(`${p.tx_hash}:${p.index}`, {
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

      // DRep alignment
      const { data: alignmentRows } = await supabase
        .from('inter_body_alignment')
        .select('proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct');

      const drepMajorityMap = new Map<string, string>();
      for (const row of alignmentRows ?? []) {
        const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
        drepMajorityMap.set(
          key,
          row.drep_yes_pct > row.drep_no_pct
            ? 'Yes'
            : row.drep_no_pct > row.drep_yes_pct
              ? 'No'
              : 'Abstain',
        );
      }

      // CC majority per proposal (for independence scoring)
      const proposalCcVotes = new Map<string, Map<string, string>>();
      for (const v of votes) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const voteMap = proposalCcVotes.get(key) ?? new Map<string, string>();
        voteMap.set(v.cc_hot_id, v.vote);
        proposalCcVotes.set(key, voteMap);
      }

      const ccMajorityMap = new Map<string, string>();
      for (const [key, voteMap] of proposalCcVotes) {
        const counts: Record<string, number> = {};
        for (const vote of voteMap.values()) {
          counts[vote] = (counts[vote] ?? 0) + 1;
        }
        const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (majority) ccMajorityMap.set(key, majority[0]);
      }

      // Total eligible proposals (all proposals in the system)
      const totalEligibleProposals = new Set(proposals.map((p) => `${p.tx_hash}:${p.index}`)).size;

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
        const result = computeFullTransparencyIndex({
          ccHotId,
          votes: mvotes,
          proposalMap,
          rationaleMap,
          drepMajorityMap,
          ccMajorityMap,
          totalEligibleProposals,
          questionsAnswered: 0, // Not yet tracked
          endorsementCount: 0, // Not yet tracked
        });

        // Update cc_members with transparency index
        const { error } = await supabase.from('cc_members').upsert(
          {
            cc_hot_id: ccHotId,
            transparency_index: result.index,
            transparency_grade: result.grade,
            participation_score: result.pillars.participation,
            rationale_quality_score: result.pillars.rationaleQuality,
            independence_score: result.pillars.independence,
            community_engagement_score: result.pillars.communityEngagement,
            votes_cast: result.votesCast,
            eligible_proposals: result.eligibleProposals,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cc_hot_id' },
        );

        // Persist snapshot
        if (!error && currentEpoch > 0) {
          await supabase.from('cc_transparency_snapshots').upsert(
            {
              cc_hot_id: ccHotId,
              epoch_no: currentEpoch,
              transparency_index: result.index,
              participation_score: result.pillars.participation,
              rationale_quality_score: result.pillars.rationaleQuality,
              responsiveness_score: result.pillars.responsiveness,
              independence_score: result.pillars.independence,
              community_engagement_score: result.pillars.communityEngagement,
              votes_cast: result.votesCast,
              eligible_proposals: result.eligibleProposals,
            },
            { onConflict: 'cc_hot_id,epoch_no' },
          );
        }

        if (!error) scored++;
      }

      return { scored, epoch: currentEpoch };
    });

    return {
      rationales: fetchResult,
      members: memberResult,
      scores: scoreResult,
      transparency: transparencyResult,
    };
  },
);
