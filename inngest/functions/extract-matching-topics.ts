/**
 * Inngest Function: extract-matching-topics
 *
 * Runs weekly (Sunday 3am UTC) to discover new governance topics from
 * freeform text collected in community intelligence match signals.
 *
 * Uses Claude AI to cluster freeform topic mentions into themes,
 * then upserts new community-detected topics into matching_topics.
 * Also decays stale community topics that are no longer being selected.
 */

import { inngest } from '@/lib/inngest';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';
import { generateJSON } from '@/lib/ai';

const STATIC_TOPICS = [
  'treasury',
  'innovation',
  'security',
  'transparency',
  'decentralization',
  'developer-funding',
  'community-growth',
  'constitutional-compliance',
];

/** Minimum unique citizen mentions to promote a topic */
const MIN_MENTIONS_THRESHOLD = 20;

/** Community topics with fewer than this many selections in 2 epochs get disabled */
const DECAY_THRESHOLD = 5;

interface ExtractedTopic {
  slug: string;
  displayName: string;
  alignmentHints: Record<string, number>;
  mentionCount: number;
}

export const extractMatchingTopics = inngest.createFunction(
  {
    id: 'extract-matching-topics',
    name: 'Extract Matching Topics from Freeform Text',
    retries: 1,
    concurrency: { limit: 1, scope: 'env', key: '"topic-extraction"' },
  },
  { cron: '0 3 * * 0' }, // Weekly, Sunday 3am UTC
  async ({ step }) => {
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Step 1: Collect freeform text from the last 2 epochs of match signals
    const freeformTexts = await step.run('collect-freeform-text', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = getSupabaseAdmin();

      const { data: signals, error } = await supabase
        .from('community_intelligence_snapshots')
        .select('data')
        .eq('snapshot_type', 'match_signal')
        .gte('epoch', currentEpoch - 2);

      if (error || !signals) {
        logger.warn('[ExtractTopics] Failed to fetch match signals', {
          error: error?.message,
        });
        return [];
      }

      const texts: string[] = [];
      for (const row of signals) {
        const d = row.data as { freeformTopics?: string[] };
        if (d.freeformTopics && Array.isArray(d.freeformTopics)) {
          texts.push(...d.freeformTopics);
        }
      }

      return texts;
    });

    if (freeformTexts.length < MIN_MENTIONS_THRESHOLD) {
      logger.info('[ExtractTopics] Not enough freeform text to extract topics', {
        count: freeformTexts.length,
        threshold: MIN_MENTIONS_THRESHOLD,
      });
      return { extracted: 0, decayed: 0, reason: 'insufficient_data' };
    }

    // Step 2: Cluster via Claude AI
    const extractedTopics = await step.run('cluster-topics-ai', async () => {
      const prompt = `You are analyzing governance topic mentions from Cardano citizens who used a DRep matching tool. Given these freeform topic mentions, identify recurring themes that are NOT already in our static topic list.

Static topics (already covered): ${STATIC_TOPICS.join(', ')}

Freeform mentions from citizens (${freeformTexts.length} total):
${freeformTexts.slice(0, 500).join('\n')}

Instructions:
1. Group similar mentions into themes
2. Only include themes mentioned by at least ${MIN_MENTIONS_THRESHOLD} unique citizens (estimate from frequency)
3. For each new theme, provide:
   - A URL-safe slug (lowercase, hyphens)
   - A short display name (2-4 words)
   - Approximate alignment hints as a JSON object with keys from: treasuryConservative, treasuryGrowth, security, innovation, transparency, decentralization (values 0-100)
4. Do NOT include themes that overlap significantly with the static topics
5. Maximum 5 new topics per extraction

Respond with ONLY a JSON array:
[{"slug": "real-world-assets", "displayName": "Real World Assets", "alignmentHints": {"treasuryGrowth": 70, "innovation": 65}, "mentionCount": 25}]

If no new themes meet the threshold, respond with an empty array: []`;

      const result = await generateJSON<ExtractedTopic[]>(prompt, {
        model: 'FAST',
        maxTokens: 1024,
        temperature: 0.3,
        system:
          'You are a governance analyst for the Cardano blockchain. Be conservative — only extract clearly distinct themes with strong signal. Respond with valid JSON only.',
      });

      if (!result || !Array.isArray(result)) {
        logger.warn('[ExtractTopics] AI returned no valid topics');
        return [];
      }

      // Filter to only topics above threshold
      return result.filter(
        (t) =>
          t.slug &&
          t.displayName &&
          t.mentionCount >= MIN_MENTIONS_THRESHOLD &&
          !STATIC_TOPICS.includes(t.slug),
      );
    });

    // Step 3: Upsert new topics
    const upsertResult = await step.run('upsert-topics', async () => {
      if (extractedTopics.length === 0) return { inserted: 0, updated: 0 };

      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = getSupabaseAdmin();

      let inserted = 0;
      let updated = 0;

      for (const topic of extractedTopics) {
        // Check if slug already exists
        const { data: existing } = await supabase
          .from('matching_topics')
          .select('id, selection_count')
          .eq('slug', topic.slug)
          .single();

        if (existing) {
          // Existing community topic — mark as trending if rising
          await supabase
            .from('matching_topics')
            .update({
              trending: true,
              enabled: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          updated++;
        } else {
          // New community-detected topic
          await supabase.from('matching_topics').insert({
            slug: topic.slug,
            display_text: topic.displayName,
            alignment_hints: topic.alignmentHints,
            source: 'community',
            epoch_introduced: currentEpoch,
            selection_count: 0,
            enabled: true,
            trending: true,
          });
          inserted++;
        }
      }

      return { inserted, updated };
    });

    // Step 4: Decay stale community topics
    const decayResult = await step.run('decay-stale-topics', async () => {
      const { getSupabaseAdmin } = await import('@/lib/supabase');
      const supabase = getSupabaseAdmin();

      // Fetch all enabled community topics
      const { data: communityTopics } = await supabase
        .from('matching_topics')
        .select('id, slug, selection_count')
        .eq('source', 'community')
        .eq('enabled', true);

      if (!communityTopics || communityTopics.length === 0) {
        return { disabled: 0, untouched: 0 };
      }

      let disabled = 0;
      let untouched = 0;

      for (const topic of communityTopics) {
        if ((topic.selection_count ?? 0) < DECAY_THRESHOLD) {
          // Low engagement — disable
          await supabase
            .from('matching_topics')
            .update({
              enabled: false,
              trending: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', topic.id);
          disabled++;
        } else {
          // Healthy engagement — keep but remove trending if it was set
          await supabase
            .from('matching_topics')
            .update({
              trending: false,
              updated_at: new Date().toISOString(),
            })
            .eq('id', topic.id);
          untouched++;
        }
      }

      return { disabled, untouched };
    });

    logger.info('[ExtractTopics] Extraction complete', {
      epoch: currentEpoch,
      freeformCount: freeformTexts.length,
      extracted: extractedTopics.length,
      upsert: upsertResult,
      decay: decayResult,
    });

    return {
      epoch: currentEpoch,
      freeformCount: freeformTexts.length,
      extracted: extractedTopics.length,
      upsert: upsertResult,
      decay: decayResult,
    };
  },
);
