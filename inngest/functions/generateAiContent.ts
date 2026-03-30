/**
 * Generate AI Content — runs after epoch transitions to produce
 * AI character profiles for DReps and SPOs, plus observatory narratives.
 *
 * Triggered by: drepscore/epoch.transition (emitted by generate-epoch-summary)
 *
 * Three steps:
 * 1. drep-characters: Generate/refresh character profiles for active DReps
 * 2. spo-characters: Generate/refresh character profiles for active SPOs
 * 3. observatory-narratives: Generate Seneca narratives for the observatory
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  computeInputHash,
  generateCharacter,
  getEmergingVoiceCharacter,
  type CharacterInput,
  type CharacterOutput,
} from '@/lib/ai/characterGenerator';
import { buildSenecaPrompt } from '@/lib/ai/senecaPersona';
import { generateText } from '@/lib/ai';
import { logger } from '@/lib/logger';

const DREP_BATCH = 20;
const SPO_BATCH = 20;

export const generateAiContent = inngest.createFunction(
  {
    id: 'generate-ai-content',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"ai-content"' },
    triggers: { event: 'drepscore/epoch.transition' },
  },
  async ({ event, step }) => {
    const epoch = event.data?.epoch as number | undefined;
    if (!epoch) {
      logger.warn('[ai-content] No epoch in event data');
      return { skipped: true, reason: 'no epoch' };
    }

    // ── Step 1: DRep characters ──────────────────────────────────────────
    const drepResult = await step.run('drep-characters', async () => {
      const supabase = getSupabaseAdmin();

      // Fetch active DReps with their scores and alignment data
      const { data: dreps, error: drepsErr } = await supabase
        .from('dreps')
        .select(
          'id, info, score, engagement_quality, effective_participation_v3, reliability_v3, governance_identity, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .not('info->isActive', 'eq', false);

      if (drepsErr || !dreps) {
        logger.error('[ai-content] Failed to fetch DReps', { error: drepsErr });
        return { error: drepsErr?.message ?? 'No DReps', generated: 0, skipped: 0 };
      }

      // Fetch existing characters for hash comparison
      const { data: existingChars } = await supabase
        .from('drep_characters')
        .select('drep_id, input_hash')
        .eq('epoch', epoch);

      const existingHashes = new Map((existingChars ?? []).map((c) => [c.drep_id, c.input_hash]));

      let generated = 0;
      let skipped = 0;

      for (let i = 0; i < dreps.length; i += DREP_BATCH) {
        const batch = dreps.slice(i, i + DREP_BATCH);

        await Promise.all(
          batch.map(async (drep) => {
            try {
              const info = (drep.info ?? {}) as Record<string, unknown>;
              const totalVotes = (info.totalVotes as number) ?? 0;
              const yesVotes = (info.yesVotes as number) ?? 0;
              const abstainVotes = (info.abstainVotes as number) ?? 0;
              const delegatorCount = (info.delegatorCount as number) ?? 0;

              const input: CharacterInput = {
                entityId: drep.id,
                name: (info.name as string) ?? (info.ticker as string) ?? null,
                alignments: {
                  treasuryConservative: drep.alignment_treasury_conservative ?? 50,
                  treasuryGrowth: drep.alignment_treasury_growth ?? 50,
                  decentralization: drep.alignment_decentralization ?? 50,
                  security: drep.alignment_security ?? 50,
                  innovation: drep.alignment_innovation ?? 50,
                  transparency: drep.alignment_transparency ?? 50,
                },
                votePattern: {
                  total: totalVotes,
                  yesRate: totalVotes > 0 ? yesVotes / totalVotes : 0,
                  abstainRate: totalVotes > 0 ? abstainVotes / totalVotes : 0,
                  proposalTypesVoted: [],
                },
                scoreComponents: {
                  engagementQuality: drep.engagement_quality ?? 0,
                  effectiveParticipation: drep.effective_participation_v3 ?? 0,
                  reliability: drep.reliability_v3 ?? 0,
                  governanceIdentity: drep.governance_identity ?? 0,
                  semanticDiversity: 0,
                },
                rationaleQuality:
                  (drep.engagement_quality ?? 0) >= 80
                    ? 'excellent'
                    : (drep.engagement_quality ?? 0) >= 50
                      ? 'substantive'
                      : (drep.engagement_quality ?? 0) >= 20
                        ? 'minimal'
                        : 'none',
                delegatorTrend: 'stable',
                delegatorCount,
                profileText: (info.description as string) ?? null,
                tier:
                  drep.score >= 80
                    ? 'Diamond'
                    : drep.score >= 60
                      ? 'Gold'
                      : drep.score >= 40
                        ? 'Silver'
                        : drep.score >= 20
                          ? 'Bronze'
                          : 'Emerging',
                ccAlignment: null,
              };

              const hash = computeInputHash(input);

              // Skip if hash unchanged
              if (existingHashes.get(drep.id) === hash) {
                skipped++;
                return;
              }

              let character: CharacterOutput;
              if (totalVotes < 3) {
                character = getEmergingVoiceCharacter(epoch);
              } else {
                character = await generateCharacter(input, 'drep');
              }

              await supabase.from('drep_characters').upsert(
                {
                  drep_id: drep.id,
                  epoch,
                  character_title: character.title,
                  character_summary: character.summary,
                  attribute_pills: character.pills,
                  input_hash: hash,
                  generated_at: new Date().toISOString(),
                },
                { onConflict: 'drep_id,epoch' },
              );

              generated++;
            } catch (err) {
              logger.error('[ai-content] DRep character generation failed', {
                drepId: drep.id,
                error: err,
              });
            }
          }),
        );
      }

      logger.info('[ai-content] DRep characters complete', {
        generated,
        skipped,
        total: dreps.length,
      });
      return { generated, skipped, total: dreps.length };
    });

    // ── Step 2: SPO characters ───────────────────────────────────────────
    const spoResult = await step.run('spo-characters', async () => {
      const supabase = getSupabaseAdmin();

      const { data: pools, error: poolsErr } = await supabase
        .from('pools')
        .select(
          'pool_id, ticker, pool_name, governance_score, vote_count, participation_pct, deliberation_pct, reliability_pct, governance_identity_pct, confidence, delegator_count, live_stake_lovelace, governance_statement, current_tier, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .not('pool_status', 'eq', 'retired')
        .gt('vote_count', 0);

      if (poolsErr || !pools) {
        logger.error('[ai-content] Failed to fetch pools', { error: poolsErr });
        return { error: poolsErr?.message ?? 'No pools', generated: 0, skipped: 0 };
      }

      const { data: existingChars } = await supabase
        .from('spo_characters')
        .select('pool_id, input_hash')
        .eq('epoch', epoch);

      const existingHashes = new Map((existingChars ?? []).map((c) => [c.pool_id, c.input_hash]));

      let generated = 0;
      let skipped = 0;

      for (let i = 0; i < pools.length; i += SPO_BATCH) {
        const batch = pools.slice(i, i + SPO_BATCH);

        await Promise.all(
          batch.map(async (pool) => {
            try {
              const voteCount = pool.vote_count ?? 0;

              const input: CharacterInput = {
                entityId: pool.pool_id,
                name: pool.ticker ?? pool.pool_name ?? null,
                alignments: {
                  treasuryConservative: pool.alignment_treasury_conservative ?? 50,
                  treasuryGrowth: pool.alignment_treasury_growth ?? 50,
                  decentralization: pool.alignment_decentralization ?? 50,
                  security: pool.alignment_security ?? 50,
                  innovation: pool.alignment_innovation ?? 50,
                  transparency: pool.alignment_transparency ?? 50,
                },
                votePattern: {
                  total: voteCount,
                  yesRate: 0.5,
                  abstainRate: 0.1,
                  proposalTypesVoted: [],
                },
                scoreComponents: {
                  engagementQuality: pool.deliberation_pct ?? 0,
                  effectiveParticipation: pool.participation_pct ?? 0,
                  reliability: pool.reliability_pct ?? 0,
                  governanceIdentity: pool.governance_identity_pct ?? 0,
                  semanticDiversity: 0,
                },
                rationaleQuality:
                  (pool.deliberation_pct ?? 0) >= 80
                    ? 'excellent'
                    : (pool.deliberation_pct ?? 0) >= 50
                      ? 'substantive'
                      : (pool.deliberation_pct ?? 0) >= 20
                        ? 'minimal'
                        : 'none',
                delegatorTrend: 'stable',
                delegatorCount: pool.delegator_count ?? 0,
                profileText: pool.governance_statement ?? null,
                tier: pool.current_tier ?? 'Emerging',
                ccAlignment: null,
              };

              const hash = computeInputHash(input);

              if (existingHashes.get(pool.pool_id) === hash) {
                skipped++;
                return;
              }

              let character: CharacterOutput;
              if (voteCount < 3) {
                character = getEmergingVoiceCharacter(epoch);
              } else {
                character = await generateCharacter(input, 'spo');
              }

              await supabase.from('spo_characters').upsert(
                {
                  pool_id: pool.pool_id,
                  epoch,
                  character_title: character.title,
                  character_summary: character.summary,
                  attribute_pills: character.pills,
                  input_hash: hash,
                  generated_at: new Date().toISOString(),
                },
                { onConflict: 'pool_id,epoch' },
              );

              generated++;
            } catch (err) {
              logger.error('[ai-content] SPO character generation failed', {
                poolId: pool.pool_id,
                error: err,
              });
            }
          }),
        );
      }

      logger.info('[ai-content] SPO characters complete', {
        generated,
        skipped,
        total: pools.length,
      });
      return { generated, skipped, total: pools.length };
    });

    // ── Step 3: Observatory narratives ────────────────────────────────────
    const narrativeResult = await step.run('observatory-narratives', async () => {
      const supabase = getSupabaseAdmin();

      // Check if we already have narratives for this epoch
      const { data: existing } = await supabase
        .from('observatory_narratives')
        .select('id')
        .eq('epoch', epoch)
        .maybeSingle();

      if (existing) {
        return { skipped: true, reason: 'narratives already exist for this epoch' };
      }

      // Gather context data for narratives
      const [treasuryResult, ghiResult, proposalResult] = await Promise.all([
        supabase
          .from('treasury_snapshots')
          .select('balance_ada, runway_months')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('ghi_snapshots')
          .select('composite_score, participation_score, deliberation_score, representation_score')
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('proposals')
          .select('tx_hash', { count: 'exact', head: true })
          .eq('proposed_epoch', epoch),
      ]);

      const treasury = treasuryResult.data;
      const ghi = ghiResult.data;
      const newProposals = proposalResult.count ?? 0;

      const contextData = [
        treasury
          ? `Treasury: ${Math.round((treasury.balance_ada ?? 0) / 1_000_000)}M ADA, ~${treasury.runway_months ?? '?'} months runway`
          : 'Treasury data unavailable',
        ghi
          ? `GHI: ${ghi.composite_score}/100 (participation: ${ghi.participation_score}, deliberation: ${ghi.deliberation_score}, representation: ${ghi.representation_score})`
          : 'GHI data unavailable',
        `New proposals this epoch: ${newProposals}`,
      ].join('\n');

      const narrativeTypes = ['observatory', 'treasury', 'committee', 'vitals'] as const;
      const narratives: Record<string, string | null> = {};

      for (const type of narrativeTypes) {
        try {
          const systemPrompt = buildSenecaPrompt(type);
          const text = await generateText(
            `Here is the current governance context for epoch ${epoch}:\n\n${contextData}\n\nGenerate your narrative.`,
            { system: systemPrompt, maxTokens: 200 },
          );
          narratives[type] = text?.trim() ?? null;
        } catch (err) {
          logger.error(`[ai-content] Failed to generate ${type} narrative`, { error: err });
          narratives[type] = null;
        }
      }

      const { error: insertErr } = await supabase.from('observatory_narratives').insert({
        epoch,
        unified: narratives.observatory,
        treasury: narratives.treasury,
        committee: narratives.committee,
        health: narratives.vitals,
        generated_at: new Date().toISOString(),
      });

      if (insertErr) {
        logger.error('[ai-content] Failed to insert observatory narratives', { error: insertErr });
        return { error: insertErr.message };
      }

      return { generated: true, epoch };
    });

    logger.info('[ai-content] AI content generation complete', {
      epoch,
      dreps: drepResult,
      spos: spoResult,
      narratives: narrativeResult,
    });

    return { epoch, dreps: drepResult, spos: spoResult, narratives: narrativeResult };
  },
);
