import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import { blockTimeToEpoch } from '@/lib/koios';
import { logger } from '@/lib/logger';

/**
 * Generate Citizen Assembly questions using AI.
 * Runs at the start of each epoch (every 5 days).
 *
 * Gathers governance context, asks Claude to generate 1-2 timely questions,
 * and creates them as draft assemblies for admin review.
 */
export const generateCitizenAssembly = inngest.createFunction(
  {
    id: 'generate-citizen-assembly',
    retries: 2,
    triggers: { cron: '0 12 */5 * *' }, // Every 5 days at noon UTC (approx epoch boundary)
  },
  async ({ step }) => {
    const supabase = getSupabaseAdmin();
    const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

    // Check feature flag
    const shouldAutoGenerate = await step.run('check-feature-flag', async () => {
      const { data } = await supabase
        .from('feature_flags')
        .select('enabled')
        .eq('key', 'citizen_assembly_ai_generation')
        .single();
      return data?.enabled ?? false;
    });

    if (!shouldAutoGenerate) {
      return { skipped: true, reason: 'Feature flag disabled' };
    }

    // Gather context
    const context = await step.run('gather-context', async () => {
      // Active proposals
      const { data: proposals } = await supabase
        .from('proposals')
        .select('title, proposal_type, withdrawal_amount, ai_summary')
        .limit(10)
        .order('proposed_epoch', { ascending: false });

      // Recent governance stats
      const { data: epochStats } = await supabase
        .from('governance_epoch_stats')
        .select('*')
        .order('epoch', { ascending: false })
        .limit(3);

      // Treasury state
      const { data: treasury } = await supabase
        .from('treasury_snapshots')
        .select('balance_ada, epoch')
        .order('epoch', { ascending: false })
        .limit(1)
        .single();

      // Priority signals (what citizens are already saying)
      const { data: priorities } = await supabase
        .from('citizen_priority_rankings')
        .select('rankings, total_voters')
        .order('epoch', { ascending: false })
        .limit(1)
        .single();

      // Recent sentiment on proposals (controversial = high engagement)
      const { data: sentiment } = await supabase
        .from('engagement_signal_aggregations')
        .select('entity_id, data')
        .eq('entity_type', 'proposal')
        .eq('signal_type', 'sentiment')
        .order('computed_at', { ascending: false })
        .limit(10);

      // Last 10 assemblies (non-redundancy check)
      const { data: pastAssemblies } = await supabase
        .from('citizen_assemblies')
        .select('question, title')
        .in('status', ['active', 'closed'])
        .order('created_at', { ascending: false })
        .limit(10);

      return {
        proposals: proposals || [],
        epochStats: epochStats || [],
        treasury,
        priorities,
        sentiment: sentiment || [],
        pastAssemblies: pastAssemblies || [],
      };
    });

    // Generate assembly questions via AI
    const generated = await step.run('generate-questions', async () => {
      const { generateJSON } = await import('@/lib/ai');

      const pastQuestions = context.pastAssemblies.map((a) => a.question).join('\n- ');

      const proposalSummaries = context.proposals
        .map(
          (p) =>
            `"${p.title}" (${p.proposal_type})${p.ai_summary ? `: ${p.ai_summary.slice(0, 150)}` : ''}`,
        )
        .join('\n- ');

      const topPriorities = context.priorities?.rankings
        ? (context.priorities.rankings as { priority: string; rank: number }[])
            .slice(0, 5)
            .map((p) => `#${p.rank} ${p.priority}`)
            .join(', ')
        : 'No priority data yet';

      const treasuryBalance = context.treasury
        ? `${Math.round(context.treasury.balance_ada / 1_000_000)}M ADA`
        : 'Unknown';

      const prompt = `You are the civic editor for Governada, the civic hub for Cardano governance. Generate 1-2 citizen assembly questions for this epoch.

CONTEXT:
- Current epoch: ${currentEpoch}
- Treasury balance: ${treasuryBalance}
- Recent proposals:\n- ${proposalSummaries || 'None'}
- Community priority rankings: ${topPriorities}
- Epoch stats: ${JSON.stringify(context.epochStats?.[0] || {})}

PAST ASSEMBLY QUESTIONS (do NOT repeat or closely paraphrase these):
- ${pastQuestions || 'None yet'}

REQUIREMENTS:
1. Questions must be about governance DIRECTION, not about specific proposals (citizens vote on individual proposals separately)
2. Each question should have 3-5 balanced, non-leading multiple-choice options
3. Questions should be timely -- reference what's actually happening in governance
4. Language must be accessible to non-technical citizens
5. Each question needs a short title (for display) and the full question text
6. Include a brief description explaining why this question matters right now

OUTPUT FORMAT (JSON array):
[{
  "title": "Short display title",
  "description": "Why this question matters right now (1-2 sentences)",
  "question": "The full question text",
  "options": [
    {"key": "option_a", "label": "Option A", "description": "Brief explanation"},
    {"key": "option_b", "label": "Option B", "description": "Brief explanation"},
    {"key": "option_c", "label": "Option C", "description": "Brief explanation"}
  ]
}]`;

      const result = await generateJSON<
        {
          title: string;
          description: string;
          question: string;
          options: { key: string; label: string; description?: string }[];
        }[]
      >(prompt, { maxTokens: 1500, temperature: 0.7 });

      return result;
    });

    if (!generated || generated.length === 0) {
      logger.error('AI assembly generation returned empty result');
      return { generated: 0 };
    }

    // Create draft assemblies
    const created = await step.run('create-drafts', async () => {
      // Calculate epoch window (~5 days)
      const now = new Date();
      const opensAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now (review window)
      const closesAt = new Date(opensAt.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days

      const rows = generated.map((q) => ({
        title: q.title,
        description: q.description,
        question: q.question,
        options: q.options,
        source: 'ai_generated' as const,
        status: 'draft' as const,
        epoch: currentEpoch,
        opens_at: opensAt.toISOString(),
        closes_at: closesAt.toISOString(),
        ai_context: {
          epoch: currentEpoch,
          proposalCount: context.proposals.length,
          topPriorities: context.priorities?.rankings?.slice(0, 3),
          generatedAt: now.toISOString(),
        },
      }));

      const { data, error } = await supabase.from('citizen_assemblies').insert(rows).select('id');

      if (error) {
        logger.error('Failed to create assembly drafts', { error: error.message });
        return [];
      }

      return data || [];
    });

    return {
      generated: generated.length,
      created: created.length,
      epoch: currentEpoch,
    };
  },
);
