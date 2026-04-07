/**
 * Contract C: Governance Context Bundle
 *
 * Assembles all governance context for a proposal into a single bundle.
 * Fetched once per agent request, cached with 60-second TTL.
 *
 * Sources: proposal data (lib/data.ts), versions (Supabase), constitutional
 * articles (hardcoded corpus), voting data (Supabase), community feedback,
 * treasury state, precedent, and personal context (lib/ai/context.ts).
 */

import type { FeedbackTheme } from '../feedback/types';
import type { ChangeJustification } from '../revision/types';
import {
  fetchGovernanceProposalSnapshot,
  fetchGovernanceProposalVotingSnapshot,
} from '@/lib/governance/proposalContext';
import { fetchGovernanceTreasuryContext } from '@/lib/governance/treasuryContext';
import { getSupabaseAdmin } from '@/lib/supabase';
import { assemblePersonalContext } from '@/lib/ai/context';
import { fetchSimilarProposals } from '@/lib/ai/skills/research-precedent';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GovernanceContextBundle type
// ---------------------------------------------------------------------------

export interface GovernanceContextBundle {
  proposal: {
    id: string;
    title: string;
    abstract: string;
    motivation: string;
    rationale: string;
    proposalType: string;
    status: string;
    metadata: Record<string, unknown>;
  };
  versions: Array<{
    versionNumber: number;
    versionName: string;
    createdAt: string;
    changeJustifications?: ChangeJustification[];
  }>;
  constitution: {
    relevantArticles: Array<{ article: string; section?: string; text: string }>;
  };
  voting: {
    drep: { yes: number; no: number; abstain: number };
    spo: { yes: number; no: number; abstain: number };
    cc: { yes: number; no: number; abstain: number };
    deadline?: string;
    epochsRemaining?: number;
  };
  community: {
    themes: FeedbackTheme[];
    totalReviewers: number;
    totalAnnotations: number;
  };
  treasury?: {
    balance: number;
    recentWithdrawals: number;
    tier: string;
  };
  precedent: Array<{
    id: string;
    title: string;
    outcome: string;
    similarity: number;
  }>;
  personal: {
    role: string;
    alignment: Record<string, number>;
    recentVotes: Array<{ proposalTitle: string; vote: string }>;
    philosophy?: string;
  };
}

// ---------------------------------------------------------------------------
// In-memory cache with 60s TTL
// ---------------------------------------------------------------------------

interface CacheEntry {
  bundle: GovernanceContextBundle;
  expiresAt: number;
}

const contextCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function getCacheKey(proposalId: string, userId: string): string {
  return `${proposalId}:${userId}`;
}

/** Evict expired entries periodically to prevent unbounded growth */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of contextCache) {
    if (now > entry.expiresAt) {
      contextCache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Constitutional Corpus (key articles relevant to governance proposals)
// ---------------------------------------------------------------------------

const CONSTITUTIONAL_ARTICLES = [
  {
    article: 'Article I',
    section: 'Section 1',
    text: 'The Cardano Blockchain ecosystem shall be governed by a decentralized, on-chain governance model, utilizing the CIP-1694 framework to enable transparent and participatory decision-making.',
  },
  {
    article: 'Article I',
    section: 'Section 2',
    text: 'All governance actions shall be consistent with the principles laid down in this Constitution and the Cardano Blockchain Guardrails.',
  },
  {
    article: 'Article II',
    section: 'Section 1',
    text: 'The Cardano Blockchain shall operate according to the principle of fiscal responsibility. Treasury withdrawals shall be justified, transparent, and subject to community oversight.',
  },
  {
    article: 'Article II',
    section: 'Section 4',
    text: 'Treasury withdrawal proposals shall include a clear scope of work, measurable deliverables, a realistic timeline, and a detailed budget breakdown.',
  },
  {
    article: 'Article III',
    section: 'Section 1',
    text: 'Changes to protocol parameters must be thoroughly analyzed for their potential impact on network security, decentralization, and performance.',
  },
  {
    article: 'Article III',
    section: 'Section 5',
    text: 'The Cardano Blockchain shall not be hard forked without the explicit consent of a supermajority of DReps and SPOs as defined in the guardrails.',
  },
  {
    article: 'Article IV',
    section: 'Section 1',
    text: 'The Constitutional Committee shall ensure that governance actions are consistent with this Constitution. A "No" vote indicates a constitutional concern.',
  },
  {
    article: 'Article V',
    section: 'Section 1',
    text: 'All governance proposals shall be submitted with sufficient information for informed decision-making, including rationale, expected impact, and risk assessment.',
  },
  {
    article: 'Article V',
    section: 'Section 3',
    text: 'Governance actions shall respect the rights of ADA holders and the integrity of the blockchain network.',
  },
  {
    article: 'Article VI',
    section: 'Section 1',
    text: 'No governance action shall compromise the security, decentralization, or sustainability of the Cardano network.',
  },
  {
    article: 'Article VII',
    section: 'Section 1',
    text: 'Amendments to this Constitution shall follow the governance process as specified in CIP-1694 and require a supermajority approval.',
  },
];

/**
 * Select articles relevant to a given proposal type.
 * Treasury proposals get fiscal articles; parameter changes get technical articles; etc.
 */
function selectRelevantArticles(
  proposalType: string,
): Array<{ article: string; section?: string; text: string }> {
  // Always include foundational articles
  const foundational = CONSTITUTIONAL_ARTICLES.filter(
    (a) => a.article === 'Article I' || a.article === 'Article V' || a.article === 'Article VI',
  );

  switch (proposalType) {
    case 'TreasuryWithdrawals':
      return [
        ...foundational,
        ...CONSTITUTIONAL_ARTICLES.filter((a) => a.article === 'Article II'),
      ];
    case 'ParameterChange':
      return [
        ...foundational,
        ...CONSTITUTIONAL_ARTICLES.filter((a) => a.article === 'Article III'),
      ];
    case 'HardForkInitiation':
      return [
        ...foundational,
        ...CONSTITUTIONAL_ARTICLES.filter(
          (a) => a.article === 'Article III' && a.section === 'Section 5',
        ),
      ];
    case 'NoConfidence':
    case 'NewCommittee':
      return [
        ...foundational,
        ...CONSTITUTIONAL_ARTICLES.filter((a) => a.article === 'Article IV'),
      ];
    case 'NewConstitution':
      return [
        ...foundational,
        ...CONSTITUTIONAL_ARTICLES.filter((a) => a.article === 'Article VII'),
      ];
    default:
      return foundational;
  }
}

// ---------------------------------------------------------------------------
// Main assembly function
// ---------------------------------------------------------------------------

/**
 * Assemble the full governance context for a proposal + user.
 *
 * Fetches proposal data, versions, constitutional articles, voting data,
 * community feedback, treasury state, precedent, and personal context.
 * Results are cached for 60 seconds per proposalId:userId pair.
 */
export async function assembleGovernanceContext(
  proposalId: string,
  userId: string,
  stakeAddress?: string,
): Promise<GovernanceContextBundle> {
  // Check cache
  const cacheKey = getCacheKey(proposalId, userId);
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.bundle;
  }

  // Periodic cleanup
  if (contextCache.size > 50) {
    evictExpired();
  }

  const supabase = getSupabaseAdmin();

  // Determine if this is a draft ID (UUID) or on-chain proposal (txHash)
  const isDraft = proposalId.length === 36 && proposalId.includes('-');

  // Fetch data in parallel
  const [proposalData, versionsData, feedbackData, annotationsData, personalData, precedentData] =
    await Promise.allSettled([
      // 1. Proposal data
      isDraft
        ? fetchDraftProposal(supabase, proposalId)
        : fetchOnChainProposal(supabase, proposalId),

      // 2. Versions (only for drafts)
      isDraft ? fetchDraftVersions(supabase, proposalId) : Promise.resolve([]),

      // 3. Community feedback themes
      fetchFeedbackThemes(supabase, proposalId),

      // 4. Annotation count + reviewer count
      fetchAnnotationStats(supabase, proposalId),

      // 5. Personal context
      stakeAddress ? assemblePersonalContext(stakeAddress, 'drep') : Promise.resolve(null),

      // 6. Similar proposals for precedent
      fetchPrecedent(proposalId, isDraft ? undefined : proposalId),
    ]);

  // Extract results with safe defaults
  const proposal = proposalData.status === 'fulfilled' ? proposalData.value : null;
  const versions = versionsData.status === 'fulfilled' ? versionsData.value : [];
  const themes = feedbackData.status === 'fulfilled' ? feedbackData.value : [];
  const annotationStats =
    annotationsData.status === 'fulfilled'
      ? annotationsData.value
      : { totalAnnotations: 0, totalReviewers: 0 };
  const personalCtx = personalData.status === 'fulfilled' ? personalData.value : null;
  const precedent = precedentData.status === 'fulfilled' ? precedentData.value : [];

  // Build proposal section
  const proposalBundle = proposal ?? {
    id: proposalId,
    title: '',
    abstract: '',
    motivation: '',
    rationale: '',
    proposalType: 'InfoAction',
    status: 'unknown',
    metadata: {},
  };

  // Constitutional articles relevant to this proposal type
  const relevantArticles = selectRelevantArticles(proposalBundle.proposalType);

  // Voting data (for on-chain proposals)
  const voting = await fetchVotingData(supabase, proposalId, isDraft);

  // Treasury state (for treasury withdrawals)
  const treasury =
    proposalBundle.proposalType === 'TreasuryWithdrawals' ? await fetchTreasuryState() : undefined;

  // Personal context bundle
  const personal = personalCtx
    ? {
        role: personalCtx.role,
        alignment: personalCtx.alignmentScores ?? {},
        recentVotes: personalCtx.recentVotes.map((v) => ({
          proposalTitle: v.proposalTitle,
          vote: v.vote,
        })),
        philosophy: personalCtx.philosophy ?? undefined,
      }
    : {
        role: 'citizen',
        alignment: {},
        recentVotes: [],
      };

  const bundle: GovernanceContextBundle = {
    proposal: proposalBundle,
    versions,
    constitution: { relevantArticles },
    voting,
    community: {
      themes,
      totalReviewers: annotationStats.totalReviewers,
      totalAnnotations: annotationStats.totalAnnotations,
    },
    treasury,
    precedent,
    personal,
  };

  // Cache the result
  contextCache.set(cacheKey, {
    bundle,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return bundle;
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

async function fetchDraftProposal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
): Promise<GovernanceContextBundle['proposal']> {
  const { data, error } = await supabase
    .from('proposal_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (error || !data) {
    logger.warn('[Agent Context] Draft not found', { draftId });
    return {
      id: draftId,
      title: '',
      abstract: '',
      motivation: '',
      rationale: '',
      proposalType: 'InfoAction',
      status: 'draft',
      metadata: {},
    };
  }

  return {
    id: data.id,
    title: data.title ?? '',
    abstract: data.abstract ?? '',
    motivation: data.motivation ?? '',
    rationale: data.rationale ?? '',
    proposalType: data.proposal_type ?? 'InfoAction',
    status: data.status ?? 'draft',
    metadata: (data.type_specific as Record<string, unknown>) ?? {},
  };
}

async function fetchOnChainProposal(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  txHashOrId: string,
): Promise<GovernanceContextBundle['proposal']> {
  const proposal = await fetchGovernanceProposalSnapshot(supabase, txHashOrId);
  if (!proposal) {
    logger.warn('[Agent Context] On-chain proposal not found', { proposalId: txHashOrId });
    return {
      id: txHashOrId,
      title: '',
      abstract: '',
      motivation: '',
      rationale: '',
      proposalType: 'InfoAction',
      status: 'unknown',
      metadata: {},
    };
  }

  return {
    id: txHashOrId,
    title: proposal.title,
    abstract: proposal.abstract,
    motivation: proposal.motivation,
    rationale: proposal.rationale,
    proposalType: proposal.proposalType,
    status: proposal.status,
    metadata: {
      withdrawalAmount: proposal.withdrawalAmount,
      treasuryTier: proposal.treasuryTier,
      proposedEpoch: proposal.proposedEpoch,
    },
  };
}

async function fetchDraftVersions(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
): Promise<GovernanceContextBundle['versions']> {
  const { data, error } = await supabase
    .from('proposal_draft_versions')
    .select('version_number, version_name, created_at, change_justifications')
    .eq('draft_id', draftId)
    .order('version_number', { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((row: any) => ({
    versionNumber: row.version_number,
    versionName: row.version_name ?? '',
    createdAt: row.created_at,
    changeJustifications: row.change_justifications ?? undefined,
  }));
}

async function fetchFeedbackThemes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  proposalId: string,
): Promise<FeedbackTheme[]> {
  // Try fetching from proposal_feedback_themes table
  // This table may not exist yet (Phase 0 migration), so handle gracefully
  try {
    const { data, error } = await supabase
      .from('proposal_feedback_themes')
      .select('*')
      .or(`proposal_tx_hash.eq.${proposalId},draft_id.eq.${proposalId}`)
      .order('endorsement_count', { ascending: false });

    if (error || !data) return [];

    return data.map((row: any) => ({
      id: row.id,
      summary: row.theme_summary ?? '',
      category: row.theme_category ?? 'concern',
      endorsementCount: row.endorsement_count ?? 0,
      keyVoices: row.key_voices ?? [],
      novelContributions: row.novel_contributions ?? [],
      addressedStatus: row.addressed_status ?? 'open',
      addressedReason: row.addressed_reason ?? undefined,
      linkedAnnotationIds: [],
    }));
  } catch {
    // Table may not exist yet
    return [];
  }
}

async function fetchAnnotationStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  proposalId: string,
): Promise<{ totalAnnotations: number; totalReviewers: number }> {
  try {
    const { data, error } = await supabase
      .from('proposal_annotations')
      .select('id, user_id')
      .or(`proposal_tx_hash.eq.${proposalId},draft_id.eq.${proposalId}`);

    if (error || !data) return { totalAnnotations: 0, totalReviewers: 0 };

    const uniqueReviewers = new Set(data.map((a: any) => a.user_id));
    return {
      totalAnnotations: data.length,
      totalReviewers: uniqueReviewers.size,
    };
  } catch {
    return { totalAnnotations: 0, totalReviewers: 0 };
  }
}

async function fetchVotingData(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  proposalId: string,
  isDraft: boolean,
): Promise<GovernanceContextBundle['voting']> {
  const emptyVoting = {
    drep: { yes: 0, no: 0, abstain: 0 },
    spo: { yes: 0, no: 0, abstain: 0 },
    cc: { yes: 0, no: 0, abstain: 0 },
  };

  if (isDraft) return emptyVoting;

  try {
    const voting = await fetchGovernanceProposalVotingSnapshot(supabase, proposalId);

    return {
      drep: voting.drep,
      spo: voting.spo,
      cc: voting.cc,
      epochsRemaining: voting.epochsRemaining,
    };
  } catch (err) {
    logger.warn('[Agent Context] Failed to fetch voting data', { error: err });
    return emptyVoting;
  }
}

async function fetchTreasuryState(): Promise<GovernanceContextBundle['treasury']> {
  try {
    const treasury = await fetchGovernanceTreasuryContext();
    if (!treasury) {
      return { balance: 0, recentWithdrawals: 0, tier: 'unknown' };
    }

    return {
      balance: treasury.treasuryData.balanceAda,
      recentWithdrawals: treasury.recentRatifiedWithdrawalsAda,
      tier: treasury.tier,
    };
  } catch {
    return { balance: 0, recentWithdrawals: 0, tier: 'unknown' };
  }
}

async function fetchPrecedent(
  proposalId: string,
  txHash?: string,
): Promise<GovernanceContextBundle['precedent']> {
  try {
    // Get the proposal type to find similar proposals
    const supabase = getSupabaseAdmin();
    let proposalType = 'InfoAction';
    let title = '';

    if (txHash) {
      const proposal = await fetchGovernanceProposalSnapshot(supabase, txHash);
      if (proposal) {
        proposalType = proposal.proposalType ?? 'InfoAction';
        title = proposal.title ?? '';
      }
    } else {
      const { data } = await supabase
        .from('proposal_drafts')
        .select('proposal_type, title')
        .eq('id', proposalId)
        .maybeSingle();
      if (data) {
        proposalType = data.proposal_type ?? 'InfoAction';
        title = data.title ?? '';
      }
    }

    const similar = await fetchSimilarProposals(proposalType, title, 5);

    return similar.map((p) => ({
      id: p.tx_hash,
      title: p.title ?? 'Untitled',
      outcome: p.ratified_epoch
        ? 'ratified'
        : p.expired_epoch
          ? 'expired'
          : p.dropped_epoch
            ? 'dropped'
            : 'active',
      similarity: 0.5, // Default similarity — semantic similarity would require embeddings
    }));
  } catch {
    return [];
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Format the governance context bundle as a concise string for injection into
 * the system prompt. Used by system-prompt.ts.
 */
export function formatContextForPrompt(ctx: GovernanceContextBundle): string {
  const lines: string[] = [];

  // Personal context
  if (ctx.personal.philosophy) {
    lines.push(`Your governance philosophy: ${ctx.personal.philosophy}`);
  }
  if (ctx.personal.recentVotes.length > 0) {
    const votes = ctx.personal.recentVotes
      .slice(0, 5)
      .map((v) => `  ${v.vote} on "${v.proposalTitle}"`)
      .join('\n');
    lines.push(`Recent votes:\n${votes}`);
  }

  // Voting data
  const v = ctx.voting;
  const totalDRep = v.drep.yes + v.drep.no + v.drep.abstain;
  if (totalDRep > 0) {
    lines.push(
      `Current voting: DRep (${v.drep.yes}Y/${v.drep.no}N/${v.drep.abstain}A), ` +
        `SPO (${v.spo.yes}Y/${v.spo.no}N/${v.spo.abstain}A), ` +
        `CC (${v.cc.yes}Y/${v.cc.no}N/${v.cc.abstain}A)`,
    );
    if (v.epochsRemaining != null) {
      lines.push(`Voting deadline: ${v.epochsRemaining} epochs remaining`);
    }
  }

  // Community feedback
  if (ctx.community.themes.length > 0) {
    const themeSummary = ctx.community.themes
      .slice(0, 5)
      .map(
        (t) =>
          `  - [${t.category.toUpperCase()}] "${t.summary}" (${t.endorsementCount} endorsements, ${t.addressedStatus})`,
      )
      .join('\n');
    lines.push(
      `Community feedback (${ctx.community.totalReviewers} reviewers, ${ctx.community.totalAnnotations} annotations):\n${themeSummary}`,
    );
  }

  // Treasury (if applicable)
  if (ctx.treasury) {
    lines.push(
      `Treasury: ${Math.round(ctx.treasury.balance).toLocaleString()} ADA balance, ` +
        `${Math.round(ctx.treasury.recentWithdrawals).toLocaleString()} ADA in recent withdrawals`,
    );
  }

  // Precedent
  if (ctx.precedent.length > 0) {
    const prec = ctx.precedent
      .slice(0, 3)
      .map((p) => `  - "${p.title}" (${p.outcome})`)
      .join('\n');
    lines.push(`Similar proposals:\n${prec}`);
  }

  // Versions
  if (ctx.versions.length > 1) {
    lines.push(
      `Revision history: ${ctx.versions.length} versions (latest: v${ctx.versions[0]?.versionNumber})`,
    );
  }

  return lines.join('\n\n');
}
