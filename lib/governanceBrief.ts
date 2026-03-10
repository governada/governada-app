/**
 * Governance Brief Assembly Pipeline
 *
 * Gathers governance data from existing sources and assembles a
 * personalized weekly brief for DReps and holders.
 */

import { getSupabaseAdmin } from './supabase';
import { logger } from '@/lib/logger';

export interface DRepBriefContext {
  drepId: string;
  drepName: string;
  currentScore: number;
  scoreChange: number;
  rank: number;
  rankChange: number;
  totalDReps: number;
  delegatorCount: number;
  delegatorChange: number;
  proposalsOpen: number;
  proposalsCritical: number;
  votesThisEpoch: number;
  rationalesThisEpoch: number;
  treasuryHealthSummary: string;
  epoch: number;
}

export interface HolderBriefContext {
  drepId: string | null;
  drepName: string | null;
  drepScore: number | null;
  drepScoreChange: number | null;
  repScore: number | null;
  proposalsOpen: number;
  proposalsCritical: number;
  governanceLevel: string | null;
  treasuryHealthSummary: string;
  epoch: number;
}

export interface BriefSection {
  heading: string;
  content: string;
}

export interface GeneratedBrief {
  greeting: string;
  sections: BriefSection[];
  ctaText: string;
  ctaUrl: string;
}

// ── Data Assembly ─────────────────────────────────────────────────────────────

export async function assembleDRepBriefContext(
  drepId: string,
  userId: string,
): Promise<DRepBriefContext | null> {
  const supabase = getSupabaseAdmin();

  const [drepRes, proposalRes, scoreHistoryRes, allDrepsRes] = await Promise.all([
    supabase
      .from('dreps')
      .select('drep_id, display_name, score, rank, delegator_count')
      .eq('drep_id', drepId)
      .single(),
    supabase
      .from('proposals')
      .select('proposal_type')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
    supabase
      .from('drep_score_history')
      .select('score, created_at')
      .eq('drep_id', drepId)
      .order('created_at', { ascending: false })
      .limit(2),
    supabase.from('dreps').select('id', { count: 'exact', head: true }),
  ]);

  if (!drepRes.data) return null;
  const drep = drepRes.data;

  const currentScore = drep.score ?? 0;
  const previousScore = scoreHistoryRes.data?.[1]?.score ?? currentScore;
  const scoreChange = currentScore - previousScore;

  const proposals = proposalRes.data ?? [];
  const { getProposalPriority } = await import('@/utils/proposalPriority');
  const critical = proposals.filter((p) => getProposalPriority(p.proposal_type) === 'critical');

  const { data: votes } = await supabase
    .from('drep_votes')
    .select('vote_tx_hash')
    .eq('drep_id', drepId)
    .gte('created_at', new Date(Date.now() - 5 * 86400000).toISOString());

  const { data: rationales } = await supabase
    .from('vote_rationales')
    .select('id')
    .eq('drep_id', drepId)
    .gte('created_at', new Date(Date.now() - 5 * 86400000).toISOString());

  const { data: epochRes } = await supabase
    .from('sync_log')
    .select('metrics')
    .eq('sync_type', 'dreps')
    .order('started_at', { ascending: false })
    .limit(1);
  void userId;

  return {
    drepId,
    drepName: drep.display_name || drepId.slice(0, 12) + '...',
    currentScore,
    scoreChange,
    rank: drep.rank ?? 0,
    rankChange: 0,
    totalDReps: allDrepsRes.count ?? 0,
    delegatorCount: drep.delegator_count ?? 0,
    delegatorChange: 0,
    proposalsOpen: proposals.length,
    proposalsCritical: critical.length,
    votesThisEpoch: votes?.length ?? 0,
    rationalesThisEpoch: rationales?.length ?? 0,
    treasuryHealthSummary: 'Stable',
    epoch: (epochRes?.[0]?.metrics as Record<string, number>)?.epoch ?? 0,
  };
}

export async function assembleHolderBriefContext(
  userId: string,
  drepId: string | null,
): Promise<HolderBriefContext> {
  const supabase = getSupabaseAdmin();

  const [proposalRes] = await Promise.all([
    supabase
      .from('proposals')
      .select('proposal_type')
      .is('ratified_epoch', null)
      .is('enacted_epoch', null)
      .is('dropped_epoch', null)
      .is('expired_epoch', null),
  ]);

  const proposals = proposalRes.data ?? [];
  const { getProposalPriority } = await import('@/utils/proposalPriority');
  const critical = proposals.filter((p) => getProposalPriority(p.proposal_type) === 'critical');

  let drepName: string | null = null;
  let drepScore: number | null = null;
  const drepScoreChange: number | null = null;

  if (drepId) {
    const { data: drep } = await supabase
      .from('dreps')
      .select('display_name, score')
      .eq('drep_id', drepId)
      .single();
    if (drep) {
      drepName = drep.display_name || drepId.slice(0, 12) + '...';
      drepScore = drep.score;
    }
  }
  void userId;

  return {
    drepId,
    drepName,
    drepScore,
    drepScoreChange,
    repScore: null,
    proposalsOpen: proposals.length,
    proposalsCritical: critical.length,
    governanceLevel: null,
    treasuryHealthSummary: 'Stable',
    epoch: 0,
  };
}

// ── Brief Generation ──────────────────────────────────────────────────────────

export async function generateAIDRepBrief(ctx: DRepBriefContext): Promise<GeneratedBrief> {
  const template = generateDRepBriefTemplate(ctx);
  try {
    const { generateText } = await import('./ai');
    const contextSummary = template.sections.map((s) => `${s.heading}: ${s.content}`).join('\n');
    const prompt = `You are a governance analyst writing a personalized weekly brief for a Cardano DRep named ${ctx.drepName}. Rewrite the following data points into a warm, concise 150-word narrative. Tone: knowledgeable friend, not corporate. Keep all numbers accurate. Output only the narrative text, no headings.

DATA:
${contextSummary}
Score: ${ctx.currentScore} (${ctx.scoreChange > 0 ? 'up' : ctx.scoreChange < 0 ? 'down' : 'unchanged'} ${Math.abs(ctx.scoreChange)} from last week)
Rank: #${ctx.rank} of ${ctx.totalDReps}
Open proposals: ${ctx.proposalsOpen}${ctx.proposalsCritical > 0 ? ` (${ctx.proposalsCritical} critical)` : ''}`;

    const narrative = await generateText(prompt, { maxTokens: 400 });
    if (narrative) {
      return {
        greeting: template.greeting,
        sections: [
          { heading: 'Your Weekly Update', content: narrative },
          ...template.sections.slice(1),
        ],
        ctaText: template.ctaText,
        ctaUrl: template.ctaUrl,
      };
    }
  } catch (err) {
    logger.error('[GovernanceBrief] AI narration failed, using template', { error: err });
  }
  return template;
}

export async function generateAIHolderBrief(ctx: HolderBriefContext): Promise<GeneratedBrief> {
  const template = generateHolderBriefTemplate(ctx);
  try {
    const { generateText } = await import('./ai');
    const contextSummary = template.sections.map((s) => `${s.heading}: ${s.content}`).join('\n');
    const prompt = `You are a governance analyst writing a weekly brief for a Cardano ADA holder. Rewrite these data points into a warm, concise 100-word narrative. Tone: knowledgeable friend encouraging governance participation. Keep all numbers accurate. Output only the narrative text, no headings.

DATA:
${contextSummary}`;

    const narrative = await generateText(prompt, { maxTokens: 300 });
    if (narrative) {
      return {
        greeting: template.greeting,
        sections: [
          { heading: 'Your Weekly Update', content: narrative },
          ...template.sections.slice(1),
        ],
        ctaText: template.ctaText,
        ctaUrl: template.ctaUrl,
      };
    }
  } catch (err) {
    logger.error('[GovernanceBrief] AI narration failed, using template', { error: err });
  }
  return template;
}

export function generateDRepBrief(ctx: DRepBriefContext): GeneratedBrief {
  return generateDRepBriefTemplate(ctx);
}

function generateDRepBriefTemplate(ctx: DRepBriefContext): GeneratedBrief {
  const scoreSentence =
    ctx.scoreChange !== 0
      ? `Your score ${ctx.scoreChange > 0 ? 'improved' : 'dropped'} by ${Math.abs(ctx.scoreChange)} points to ${ctx.currentScore}.`
      : `Your score holds steady at ${ctx.currentScore}.`;

  const sections: BriefSection[] = [
    {
      heading: 'Your Score',
      content: `${scoreSentence} You're ranked #${ctx.rank} out of ${ctx.totalDReps} DReps.`,
    },
    {
      heading: 'Participation',
      content: `You cast ${ctx.votesThisEpoch} vote${ctx.votesThisEpoch !== 1 ? 's' : ''} and wrote ${ctx.rationalesThisEpoch} rationale${ctx.rationalesThisEpoch !== 1 ? 's' : ''} this period.`,
    },
    {
      heading: 'Governance Landscape',
      content: `${ctx.proposalsOpen} proposal${ctx.proposalsOpen !== 1 ? 's' : ''} are open${ctx.proposalsCritical > 0 ? `, including ${ctx.proposalsCritical} critical` : ''}. Treasury: ${ctx.treasuryHealthSummary}.`,
    },
    {
      heading: 'Delegation',
      content: `You have ${ctx.delegatorCount} delegator${ctx.delegatorCount !== 1 ? 's' : ''}.`,
    },
  ];

  return {
    greeting: `Hey ${ctx.drepName}, here's your weekly governance roundup.`,
    sections,
    ctaText: 'Open Dashboard',
    ctaUrl: '/my-gov',
  };
}

export function generateHolderBrief(ctx: HolderBriefContext): GeneratedBrief {
  return generateHolderBriefTemplate(ctx);
}

function generateHolderBriefTemplate(ctx: HolderBriefContext): GeneratedBrief {
  const sections: BriefSection[] = [];

  if (ctx.drepId && ctx.drepName) {
    let drepContent = `You're delegated to ${ctx.drepName}`;
    if (ctx.drepScore !== null) drepContent += ` (score: ${ctx.drepScore})`;
    drepContent += '.';
    if (ctx.drepScoreChange && ctx.drepScoreChange !== 0) {
      drepContent += ` Their score ${ctx.drepScoreChange > 0 ? 'improved' : 'dropped'} by ${Math.abs(ctx.drepScoreChange)} points this week.`;
    }
    sections.push({ heading: 'Your DRep', content: drepContent });
  } else {
    sections.push({
      heading: 'Delegation Status',
      content:
        "You haven't delegated to a DRep yet. Explore high-scoring DReps on the Discover page.",
    });
  }

  sections.push({
    heading: 'Governance Snapshot',
    content: `${ctx.proposalsOpen} proposal${ctx.proposalsOpen !== 1 ? 's' : ''} are open${ctx.proposalsCritical > 0 ? `, including ${ctx.proposalsCritical} critical` : ''}. Treasury: ${ctx.treasuryHealthSummary}.`,
  });

  if (ctx.governanceLevel) {
    sections.push({
      heading: 'Your Governance Level',
      content: `You're at the ${ctx.governanceLevel} level. Keep participating to level up.`,
    });
  }

  return {
    greeting: "Here's your weekly governance roundup from Governada.",
    sections,
    ctaText: 'Explore DReps',
    ctaUrl: '/governance/representatives',
  };
}

// ── Storage ───────────────────────────────────────────────────────────────────

export async function storeBrief(
  userId: string,
  briefType: 'drep' | 'holder' | 'citizen',
  content: GeneratedBrief,
  epoch: number,
): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('governance_briefs')
    .insert({
      user_id: userId,
      brief_type: briefType,
      content_json: content,
      epoch,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[GovernanceBrief] Store error', { error: error?.message });
    return null;
  }
  return data?.id ?? null;
}

export async function getLatestBrief(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('governance_briefs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data;
}
