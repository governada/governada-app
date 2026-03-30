/**
 * User Embedding Generation — event-driven Inngest function.
 *
 * Triggered when a user updates their governance profile
 * (quiz answers, philosophy, preferences). Generates a single
 * user_preference embedding for semantic matching.
 *
 * Gated behind `semantic_embeddings` feature flag.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import { composeUserPreference } from '@/lib/embeddings/compose';
import { generateAndStoreEmbeddings } from '@/lib/embeddings/generate';

export const generateUserEmbedding = inngest.createFunction(
  {
    id: 'generate-user-embedding',
    retries: 2,
    concurrency: { limit: 5 },
    triggers: { event: 'governada/user.profile.updated' },
  },
  async ({ event, step }) => {
    const { userId } = event.data as { userId: string };

    if (!userId) return { skipped: true, reason: 'no userId in event data' };

    // Check feature flag
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('semantic_embeddings', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    const result = await step.run('generate-user-embedding', async () => {
      const supabase = getSupabaseAdmin();

      // Get user profile data
      const { data: user } = await supabase
        .from('users')
        .select('id, wallet_address')
        .eq('id', userId)
        .single();

      if (!user) return { generated: 0, reason: 'user not found' };

      // Get governance profile
      const { data: profile } = await supabase
        .from('user_governance_profiles')
        .select('alignment_scores, personality_label, governance_philosophy')
        .eq('wallet_address', user.wallet_address)
        .single();

      if (!profile) return { generated: 0, reason: 'no governance profile' };

      // Build conversation text from profile data
      const parts: string[] = [];

      if (profile.governance_philosophy) {
        parts.push(`Governance philosophy: ${profile.governance_philosophy}`);
      }

      if (profile.alignment_scores && typeof profile.alignment_scores === 'object') {
        const scores = profile.alignment_scores as Record<string, number>;
        const alignmentParts = Object.entries(scores)
          .map(([dim, val]) => `${dim}: ${val}`)
          .join(', ');
        parts.push(`Alignment scores: ${alignmentParts}`);
      }

      if (parts.length === 0) {
        return { generated: 0, reason: 'no meaningful profile content' };
      }

      const doc = composeUserPreference({
        user_id: userId,
        conversation_text: parts.join('\n\n'),
        personality_label: profile.personality_label as string | null,
      });

      const generated = await generateAndStoreEmbeddings([doc]);
      return { generated };
    });

    logger.info('[generate-user-embedding] Complete', { userId, result });
    return result;
  },
);
