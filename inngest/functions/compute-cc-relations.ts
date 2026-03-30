/**
 * Compute CC Relations — Constitutional Intelligence Pipeline (Chunk 2)
 *
 * Computes pairwise agreement matrix (vote agreement + reasoning similarity),
 * detects voting/reasoning blocs, and classifies member archetypes.
 *
 * Triggered after CC votes sync or every 6 hours as a safety net.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { detectBlocs } from '@/lib/cc/blocDetection';
import { classifyArchetype } from '@/lib/cc/archetypeClassification';
import { logger } from '@/lib/logger';
import type { AgreementEntry } from '@/lib/cc/blocDetection';

export const computeCcRelations = inngest.createFunction(
  {
    id: 'compute-cc-relations',
    concurrency: [{ scope: 'env', key: 'cc-relations', limit: 1 }],
    triggers: [{ event: 'cc/votes.synced' }, { cron: '0 */6 * * *' }],
  },
  async ({ step }) => {
    // -----------------------------------------------------------------------
    // Step 1: Compute agreement matrix (vote agreement + reasoning similarity)
    // -----------------------------------------------------------------------
    const agreementResult = await step.run('compute-agreement-matrix', async () => {
      const supabase = getSupabaseAdmin();

      // Get all CC votes
      const { data: votes, error: votesErr } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote');

      if (votesErr) {
        logger.error('[cc-relations] Failed to fetch cc_votes', { error: votesErr.message });
        throw new Error(`Failed to fetch cc_votes: ${votesErr.message}`);
      }
      if (!votes?.length) return { pairs: 0, message: 'No CC votes found' };

      // Build per-member vote map: member -> { proposalKey -> vote }
      const memberVoteMap = new Map<string, Map<string, string>>();
      for (const v of votes) {
        const key = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const map = memberVoteMap.get(v.cc_hot_id) ?? new Map<string, string>();
        map.set(key, v.vote);
        memberVoteMap.set(v.cc_hot_id, map);
      }

      // Get all rationales with cited articles for reasoning similarity
      const { data: rationales } = await supabase
        .from('cc_rationales')
        .select('cc_hot_id, cited_articles');

      // Build per-member article set: member -> Set<article>
      const memberArticleMap = new Map<string, Set<string>>();
      for (const r of rationales ?? []) {
        const articles = r.cited_articles as string[] | null;
        if (!articles?.length) continue;
        const existing = memberArticleMap.get(r.cc_hot_id) ?? new Set<string>();
        for (const article of articles) {
          existing.add(article);
        }
        memberArticleMap.set(r.cc_hot_id, existing);
      }

      // Compute all pairwise comparisons
      const members = Array.from(memberVoteMap.keys()).sort();
      const rows: Array<{
        member_a: string;
        member_b: string;
        agreement_pct: number;
        total_shared_proposals: number;
        agreed_count: number;
        disagreed_count: number;
        last_disagreement_proposal: string | null;
        last_disagreement_index: number | null;
        reasoning_similarity_pct: number | null;
        shared_articles_count: number | null;
        total_articles_union: number | null;
        computed_at: string;
      }> = [];

      const now = new Date().toISOString();

      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const memberA = members[i];
          const memberB = members[j];
          const votesA = memberVoteMap.get(memberA)!;
          const votesB = memberVoteMap.get(memberB)!;

          // Find shared proposals
          let agreed = 0;
          let disagreed = 0;
          let lastDisagreementProposal: string | null = null;
          let lastDisagreementIndex: number | null = null;

          for (const [proposalKey, voteA] of votesA) {
            const voteB = votesB.get(proposalKey);
            if (voteB === undefined) continue;

            if (voteA === voteB) {
              agreed++;
            } else {
              disagreed++;
              const [txHash, idxStr] = proposalKey.split(':');
              lastDisagreementProposal = txHash;
              lastDisagreementIndex = parseInt(idxStr, 10);
            }
          }

          const total = agreed + disagreed;
          if (total === 0) continue;

          const agreementPct = Math.round((agreed / total) * 10000) / 100;

          // Compute Jaccard similarity of cited articles
          const articlesA = memberArticleMap.get(memberA);
          const articlesB = memberArticleMap.get(memberB);

          let reasoningSimilarityPct: number | null = null;
          let sharedArticlesCount: number | null = null;
          let totalArticlesUnion: number | null = null;

          if (articlesA && articlesB && articlesA.size > 0 && articlesB.size > 0) {
            const intersection = new Set<string>();
            for (const a of articlesA) {
              if (articlesB.has(a)) intersection.add(a);
            }
            const union = new Set<string>([...articlesA, ...articlesB]);

            sharedArticlesCount = intersection.size;
            totalArticlesUnion = union.size;
            reasoningSimilarityPct =
              union.size > 0 ? Math.round((intersection.size / union.size) * 10000) / 100 : 0;
          }

          rows.push({
            member_a: memberA,
            member_b: memberB,
            agreement_pct: agreementPct,
            total_shared_proposals: total,
            agreed_count: agreed,
            disagreed_count: disagreed,
            last_disagreement_proposal: lastDisagreementProposal,
            last_disagreement_index: lastDisagreementIndex,
            reasoning_similarity_pct: reasoningSimilarityPct,
            shared_articles_count: sharedArticlesCount,
            total_articles_union: totalArticlesUnion,
            computed_at: now,
          });
        }
      }

      // Upsert in batches of 50
      let upserted = 0;
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase
          .from('cc_agreement_matrix')
          .upsert(batch, { onConflict: 'member_a,member_b' });

        if (error) {
          logger.error('[cc-relations] Agreement matrix upsert failed', {
            error: error.message,
            batch: i,
          });
        } else {
          upserted += batch.length;
        }
      }

      logger.info('[cc-relations] Agreement matrix computed', {
        pairs: upserted,
        members: members.length,
      });

      return { pairs: upserted, members: members.length };
    });

    // -----------------------------------------------------------------------
    // Step 2: Detect blocs using reasoning similarity
    // -----------------------------------------------------------------------
    const blocResult = await step.run('detect-blocs', async () => {
      const supabase = getSupabaseAdmin();

      // Read the agreement matrix
      const { data: matrix, error: matrixErr } = await supabase
        .from('cc_agreement_matrix')
        .select(
          'member_a, member_b, agreement_pct, reasoning_similarity_pct, total_shared_proposals, agreed_count, disagreed_count',
        );

      if (matrixErr) {
        logger.error('[cc-relations] Failed to read agreement matrix', {
          error: matrixErr.message,
        });
        throw new Error(`Failed to read agreement matrix: ${matrixErr.message}`);
      }

      if (!matrix?.length) return { blocs: 0, members: 0 };

      // Convert to AgreementEntry format
      const agreements: AgreementEntry[] = matrix.map((row) => ({
        memberA: row.member_a,
        memberB: row.member_b,
        voteAgreementPct: row.agreement_pct ?? 100,
        reasoningSimilarityPct: row.reasoning_similarity_pct ?? 0,
        totalSharedProposals: row.total_shared_proposals ?? 0,
        agreedCount: row.agreed_count ?? 0,
        disagreedCount: row.disagreed_count ?? 0,
      }));

      const blocs = detectBlocs(agreements);

      // Clear existing bloc assignments and insert new ones
      await supabase.from('cc_bloc_assignments').delete().neq('cc_hot_id', '');

      const now = new Date().toISOString();
      let upserted = 0;

      for (const bloc of blocs) {
        const rows = bloc.members.map((ccHotId) => ({
          cc_hot_id: ccHotId,
          bloc_label: bloc.blocLabel,
          internal_agreement_pct: bloc.internalAgreementPct,
          member_count: bloc.members.length,
          computed_at: now,
        }));

        const { error } = await supabase
          .from('cc_bloc_assignments')
          .upsert(rows, { onConflict: 'cc_hot_id' });

        if (error) {
          logger.error('[cc-relations] Bloc assignment upsert failed', {
            error: error.message,
            bloc: bloc.blocLabel,
          });
        } else {
          upserted += rows.length;
        }
      }

      logger.info('[cc-relations] Blocs detected', {
        totalBlocs: blocs.filter((b) => b.blocLabel !== 'Independent').length,
        independents: blocs.filter((b) => b.blocLabel === 'Independent').length,
        totalMembers: upserted,
      });

      return {
        blocs: blocs.filter((b) => b.blocLabel !== 'Independent').length,
        independents: blocs.filter((b) => b.blocLabel === 'Independent').length,
        members: upserted,
      };
    });

    // -----------------------------------------------------------------------
    // Step 3: Compute archetypes for each CC member
    // -----------------------------------------------------------------------
    const archetypeResult = await step.run('compute-archetypes', async () => {
      const supabase = getSupabaseAdmin();

      // Get current epoch
      const { data: stats } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = stats?.current_epoch ?? 0;

      // Get all CC votes grouped by member
      const { data: votes } = await supabase
        .from('cc_votes')
        .select('cc_hot_id, proposal_tx_hash, proposal_index, vote');

      if (!votes?.length) return { classified: 0 };

      // Group votes by member
      const memberVotes = new Map<
        string,
        Array<{ proposalTxHash: string; proposalIndex: number; vote: string }>
      >();
      for (const v of votes) {
        const list = memberVotes.get(v.cc_hot_id) ?? [];
        list.push({
          proposalTxHash: v.proposal_tx_hash,
          proposalIndex: v.proposal_index,
          vote: v.vote,
        });
        memberVotes.set(v.cc_hot_id, list);
      }

      // Get rationale data for article citation stats
      const { data: rationales } = await supabase
        .from('cc_rationales')
        .select('cc_hot_id, cited_articles');

      // Build per-member article stats
      const memberArticleStats = new Map<
        string,
        { uniqueArticles: Set<string>; totalCitations: number; articlesList: string[] }
      >();
      for (const r of rationales ?? []) {
        const articles = r.cited_articles as string[] | null;
        if (!articles?.length) continue;
        const existing = memberArticleStats.get(r.cc_hot_id) ?? {
          uniqueArticles: new Set<string>(),
          totalCitations: 0,
          articlesList: [],
        };
        for (const article of articles) {
          existing.uniqueArticles.add(article);
          existing.articlesList.push(article);
        }
        existing.totalCitations += articles.length;
        memberArticleStats.set(r.cc_hot_id, existing);
      }

      // Get CC members for authorization epoch and rationale provision rate
      const { data: members } = await supabase
        .from('cc_members')
        .select('cc_hot_id, authorization_epoch, rationale_provision_rate');

      const memberInfoMap = new Map<
        string,
        { authorizationEpoch: number | null; rationaleProvisionRate: number | null }
      >();
      for (const m of members ?? []) {
        memberInfoMap.set(m.cc_hot_id, {
          authorizationEpoch: m.authorization_epoch,
          rationaleProvisionRate: m.rationale_provision_rate,
        });
      }

      // Get bloc assignments
      const { data: blocAssignments } = await supabase
        .from('cc_bloc_assignments')
        .select('cc_hot_id, bloc_label');

      const blocMap = new Map<string, string>();
      for (const b of blocAssignments ?? []) {
        blocMap.set(b.cc_hot_id, b.bloc_label);
      }

      // Get agreement matrix for finding most-aligned/divergent peers
      const { data: agreements } = await supabase
        .from('cc_agreement_matrix')
        .select('member_a, member_b, reasoning_similarity_pct');

      // Build per-member peer similarity map (using reasoning_similarity_pct)
      const peerSimilarity = new Map<string, Map<string, number>>();
      for (const a of agreements ?? []) {
        const simPct = a.reasoning_similarity_pct ?? 0;
        // Add both directions
        const mapA = peerSimilarity.get(a.member_a) ?? new Map<string, number>();
        mapA.set(a.member_b, simPct);
        peerSimilarity.set(a.member_a, mapA);

        const mapB = peerSimilarity.get(a.member_b) ?? new Map<string, number>();
        mapB.set(a.member_a, simPct);
        peerSimilarity.set(a.member_b, mapB);
      }

      // Compute sole dissenter counts: proposals where a member is the only one voting differently
      // Build per-proposal vote distribution
      const proposalVotes = new Map<string, Map<string, string[]>>();
      for (const v of votes) {
        const pKey = `${v.proposal_tx_hash}:${v.proposal_index}`;
        const voteMap = proposalVotes.get(pKey) ?? new Map<string, string[]>();
        const voters = voteMap.get(v.vote) ?? [];
        voters.push(v.cc_hot_id);
        voteMap.set(v.vote, voters);
        proposalVotes.set(pKey, voteMap);
      }

      // For each member, count proposals where they were the sole voter for their choice
      const soleDissenterMap = new Map<
        string,
        { count: number; proposals: Array<{ txHash: string; index: number }> }
      >();

      for (const [pKey, voteMap] of proposalVotes) {
        // Only relevant if there are multiple vote outcomes
        if (voteMap.size <= 1) continue;

        for (const [, voters] of voteMap) {
          if (voters.length === 1) {
            const memberId = voters[0];
            const existing = soleDissenterMap.get(memberId) ?? { count: 0, proposals: [] };
            existing.count++;
            const [txHash, idxStr] = pKey.split(':');
            existing.proposals.push({ txHash, index: parseInt(idxStr, 10) });
            soleDissenterMap.set(memberId, existing);
          }
        }
      }

      // Classify each member
      const now = new Date().toISOString();
      let classified = 0;

      for (const [memberId, mvotes] of memberVotes) {
        const totalVotes = mvotes.length;
        const yesVotes = mvotes.filter((v) => v.vote === 'Yes').length;
        const approvalRate = totalVotes > 0 ? Math.round((yesVotes / totalVotes) * 10000) / 100 : 0;

        const memberInfo = memberInfoMap.get(memberId);
        const articleStats = memberArticleStats.get(memberId);
        const blocLabel = blocMap.get(memberId) ?? 'Independent';
        const dissenterInfo = soleDissenterMap.get(memberId) ?? { count: 0, proposals: [] };

        const archetype = classifyArchetype({
          ccHotId: memberId,
          approvalRate,
          rationaleProvisionRate: memberInfo?.rationaleProvisionRate ?? 0,
          uniqueArticlesCited: articleStats?.uniqueArticles.size ?? 0,
          totalCitations: articleStats?.totalCitations ?? 0,
          articlesCited: articleStats ? Array.from(articleStats.uniqueArticles) : [],
          soleDissenterCount: dissenterInfo.count,
          blocAssignment: blocLabel,
          authorizationEpoch: memberInfo?.authorizationEpoch ?? null,
          currentEpoch,
        });

        // Find most-aligned and most-divergent peers
        const peers = peerSimilarity.get(memberId);
        let mostAlignedMember: string | null = null;
        let mostAlignedPct: number | null = null;
        let mostDivergentMember: string | null = null;
        let mostDivergentPct: number | null = null;

        if (peers && peers.size > 0) {
          let maxSim = -1;
          let minSim = 101;
          for (const [peerId, simPct] of peers) {
            if (simPct > maxSim) {
              maxSim = simPct;
              mostAlignedMember = peerId;
              mostAlignedPct = simPct;
            }
            if (simPct < minSim) {
              minSim = simPct;
              mostDivergentMember = peerId;
              mostDivergentPct = simPct;
            }
          }
        }

        // Build specialization from article citation patterns
        const specialization =
          articleStats && articleStats.uniqueArticles.size > 0
            ? Array.from(articleStats.uniqueArticles).slice(0, 10)
            : null;

        const { error } = await supabase.from('cc_member_archetypes').upsert(
          {
            cc_hot_id: memberId,
            archetype_label: archetype.label,
            archetype_description: archetype.description,
            strictness_score: archetype.strictnessScore,
            independence_profile: archetype.independenceProfile,
            most_aligned_member: mostAlignedMember,
            most_aligned_pct: mostAlignedPct,
            most_divergent_member: mostDivergentMember,
            most_divergent_pct: mostDivergentPct,
            sole_dissenter_count: dissenterInfo.count,
            sole_dissenter_proposals:
              dissenterInfo.proposals.length > 0 ? dissenterInfo.proposals : null,
            specialization,
            computed_at: now,
          },
          { onConflict: 'cc_hot_id' },
        );

        if (error) {
          logger.error('[cc-relations] Archetype upsert failed', {
            error: error.message,
            memberId,
          });
        } else {
          classified++;
        }
      }

      logger.info('[cc-relations] Archetypes classified', { classified });
      return { classified };
    });

    // -----------------------------------------------------------------------
    // Step 4: Emit completion event
    // -----------------------------------------------------------------------
    await step.sendEvent('emit-completion', {
      name: 'cc/relations.computed',
      data: {
        agreement: agreementResult,
        blocs: blocResult,
        archetypes: archetypeResult,
      },
    });

    return {
      agreement: agreementResult,
      blocs: blocResult,
      archetypes: archetypeResult,
    };
  },
);
