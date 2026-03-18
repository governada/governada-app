/**
 * Scenario Generator — populates preview cohorts with realistic governance data.
 *
 * Queries real on-chain proposals from the `proposals` table, creates
 * `proposal_drafts` at various lifecycle stages, and generates synthetic
 * community reviews using template-based content. All data is tagged with
 * `preview_cohort_id` so it stays isolated from production.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { DraftStatus, ProposalType } from '@/lib/workspace/types';
import type { Database, Json } from '@/types/database';
import {
  REVIEWER_PERSONAS,
  REVIEW_TEMPLATES,
  FEEDBACK_THEMES,
  SCORE_RANGES,
  VERSION_EDIT_SUMMARIES,
  VERSION_NAMES,
  EDGE_CASE_TITLES,
  EDGE_CASE_ABSTRACTS,
  EDGE_CASE_MOTIVATIONS,
  EDGE_CASE_REVIEWS,
  type ReviewCategory,
  type ReviewerPersona,
} from './templates';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScenarioResult {
  proposalsCreated: number;
  reviewsCreated: number;
  versionsCreated: number;
  errors: string[];
}

type ProposalRow = Database['public']['Tables']['proposals']['Row'];

/** Distribution of drafts across lifecycle stages */
const STAGE_DISTRIBUTION: { status: DraftStatus; count: number }[] = [
  { status: 'draft', count: 2 },
  { status: 'community_review', count: 3 },
  { status: 'final_comment', count: 2 },
  { status: 'submitted', count: 2 },
  { status: 'archived', count: 1 },
];

const TOTAL_NEEDED = STAGE_DISTRIBUTION.reduce((sum, s) => sum + s.count, 0);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pick a random element from an array */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick N random unique elements from an array */
function pickRandomN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** Map on-chain proposal_type strings to our ProposalType enum */
function normalizeProposalType(raw: string): ProposalType {
  const mapping: Record<string, ProposalType> = {
    InfoAction: 'InfoAction',
    TreasuryWithdrawals: 'TreasuryWithdrawals',
    ParameterChange: 'ParameterChange',
    HardForkInitiation: 'HardForkInitiation',
    NoConfidence: 'NoConfidence',
    NewCommittee: 'NewCommittee',
    NewConstitution: 'NewConstitution',
  };
  return mapping[raw] ?? 'InfoAction';
}

/** Generate a synthetic owner stake address for a draft */
function syntheticOwner(index: number): string {
  return `stake_preview_proposer_${String(index + 1).padStart(2, '0')}`;
}

/** Create a realistic ISO timestamp within the last N days */
function recentTimestamp(maxDaysAgo: number): string {
  const now = Date.now();
  const offset = Math.random() * maxDaysAgo * 24 * 60 * 60 * 1000;
  return new Date(now - offset).toISOString();
}

// ---------------------------------------------------------------------------
// Core generator
// ---------------------------------------------------------------------------

export async function generateScenario(
  cohortId: string,
  options?: { edgeCases?: boolean },
): Promise<ScenarioResult> {
  const result: ScenarioResult = {
    proposalsCreated: 0,
    reviewsCreated: 0,
    versionsCreated: 0,
    errors: [],
  };

  const supabase = getSupabaseAdmin();

  // 1. Verify cohort exists
  const { data: cohort, error: cohortError } = await supabase
    .from('preview_cohorts')
    .select('id, name')
    .eq('id', cohortId)
    .single();

  if (cohortError || !cohort) {
    result.errors.push(`Cohort not found: ${cohortId}`);
    return result;
  }

  // 2. Clean up any existing scenario data for this cohort
  await cleanupExistingScenario(supabase, cohortId, result);

  // 3. Fetch real proposals for content
  const { data: proposals, error: proposalError } = await supabase
    .from('proposals')
    .select('*')
    .not('title', 'is', null)
    .not('abstract', 'is', null)
    .order('block_time', { ascending: false })
    .limit(50);

  if (proposalError || !proposals || proposals.length === 0) {
    result.errors.push(
      `Failed to fetch source proposals: ${proposalError?.message ?? 'no proposals found'}`,
    );
    return result;
  }

  // Pick diverse proposals across types
  const selectedProposals = selectDiverseProposals(proposals, TOTAL_NEEDED);

  if (selectedProposals.length < TOTAL_NEEDED) {
    logger.warn('[scenario-generator] Not enough diverse proposals, using what we have', {
      found: selectedProposals.length,
      needed: TOTAL_NEEDED,
    });
  }

  // 4. Create drafts distributed across lifecycle stages
  let proposalIndex = 0;
  const createdDraftIds: { id: string; status: DraftStatus }[] = [];

  for (const stage of STAGE_DISTRIBUTION) {
    for (let i = 0; i < stage.count && proposalIndex < selectedProposals.length; i++) {
      const source = selectedProposals[proposalIndex];
      const draftId = await createDraft(supabase, source, stage.status, cohortId, proposalIndex);

      if (draftId) {
        createdDraftIds.push({ id: draftId, status: stage.status });
        result.proposalsCreated++;

        // Create initial version for every draft
        const versionCreated = await createInitialVersion(supabase, draftId, source);
        if (versionCreated) result.versionsCreated++;
      } else {
        result.errors.push(
          `Failed to create draft for "${source.title}" at stage "${stage.status}"`,
        );
      }

      proposalIndex++;
    }
  }

  // 5. Generate reviews for community_review and final_comment drafts
  const reviewableDrafts = createdDraftIds.filter(
    (d) => d.status === 'community_review' || d.status === 'final_comment',
  );

  for (const draft of reviewableDrafts) {
    const reviewCount = randInt(3, 8);
    const reviewers = pickRandomN(REVIEWER_PERSONAS, reviewCount);
    const sourceProposal = selectedProposals.find((_, idx) => {
      // Find the index of this draft in the creation order
      const draftEntry = createdDraftIds.find((d) => d.id === draft.id);
      return draftEntry !== undefined && createdDraftIds.indexOf(draftEntry) === idx;
    });

    const title = sourceProposal?.title ?? 'this proposal';

    for (const reviewer of reviewers) {
      const created = await createReview(supabase, draft.id, reviewer, title);
      if (created) result.reviewsCreated++;
    }
  }

  // 6. Create revision versions for drafts in later stages
  const revisedDrafts = createdDraftIds.filter(
    (d) =>
      d.status === 'community_review' || d.status === 'final_comment' || d.status === 'submitted',
  );

  for (const draft of revisedDrafts) {
    const versionCount = randInt(1, 3);
    for (let v = 0; v < versionCount; v++) {
      const created = await createRevisionVersion(supabase, draft.id, v + 2);
      if (created) result.versionsCreated++;
    }
  }

  // 7. Append edge case drafts if requested
  if (options?.edgeCases) {
    await generateEdgeCaseDrafts(supabase, cohortId, proposalIndex, result);
  }

  logger.info('[scenario-generator] Scenario generation complete', {
    cohortId,
    cohortName: cohort.name,
    edgeCases: options?.edgeCases ?? false,
    ...result,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Proposal selection
// ---------------------------------------------------------------------------

/** Select proposals with good type diversity */
function selectDiverseProposals(proposals: ProposalRow[], count: number): ProposalRow[] {
  // Group by type
  const byType = new Map<string, ProposalRow[]>();
  for (const p of proposals) {
    if (!p.title || !p.abstract) continue;
    const list = byType.get(p.proposal_type) ?? [];
    list.push(p);
    byType.set(p.proposal_type, list);
  }

  const selected: ProposalRow[] = [];
  const types = Array.from(byType.keys());

  // Round-robin across types until we have enough
  let typeIndex = 0;
  while (selected.length < count && types.length > 0) {
    const type = types[typeIndex % types.length];
    const pool = byType.get(type);
    if (pool && pool.length > 0) {
      selected.push(pool.shift()!);
    } else {
      // Exhausted this type, remove it
      types.splice(typeIndex % types.length, 1);
      if (types.length === 0) break;
      continue;
    }
    typeIndex++;
  }

  return selected;
}

// ---------------------------------------------------------------------------
// Draft creation
// ---------------------------------------------------------------------------

async function createDraft(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  source: ProposalRow,
  status: DraftStatus,
  cohortId: string,
  index: number,
): Promise<string | null> {
  const now = new Date();
  const createdAt = recentTimestamp(30);
  const stageEnteredAt = recentTimestamp(14);

  // Build type-specific data
  const typeSpecific: { [key: string]: Json | undefined } = {
    _scenarioSource: {
      txHash: source.tx_hash,
      proposalIndex: source.proposal_index,
      generatedAt: now.toISOString(),
    },
  };

  if (source.proposal_type === 'TreasuryWithdrawals' && source.withdrawal_amount) {
    typeSpecific.withdrawalAmount = source.withdrawal_amount;
  }

  // Extract motivation/rationale from meta_json if available
  const metaJson = source.meta_json as Record<string, unknown> | null;
  const body = (metaJson?.body as Record<string, string | undefined>) ?? {};

  const insertData: Database['public']['Tables']['proposal_drafts']['Insert'] = {
    owner_stake_address: syntheticOwner(index),
    title: source.title ?? 'Untitled Proposal',
    abstract: source.abstract ?? '',
    motivation: body.motivation ?? 'Motivation not available from source proposal.',
    rationale: body.rationale ?? 'Rationale not available from source proposal.',
    proposal_type: normalizeProposalType(source.proposal_type),
    type_specific: typeSpecific,
    status,
    current_version: status === 'draft' ? 1 : randInt(2, 4),
    preview_cohort_id: cohortId,
    created_at: createdAt,
    stage_entered_at: stageEnteredAt,
    community_review_started_at: status !== 'draft' ? recentTimestamp(21) : null,
    fcp_started_at:
      status === 'final_comment' || status === 'submitted' || status === 'archived'
        ? recentTimestamp(10)
        : null,
    submitted_tx_hash: status === 'submitted' || status === 'archived' ? source.tx_hash : null,
    submitted_at: status === 'submitted' || status === 'archived' ? recentTimestamp(7) : null,
  };

  const { data, error } = await supabase
    .from('proposal_drafts')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[scenario-generator] Failed to insert draft', {
      error: error?.message,
      title: source.title,
      status,
    });
    return null;
  }

  return data.id;
}

// ---------------------------------------------------------------------------
// Version creation
// ---------------------------------------------------------------------------

async function createInitialVersion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
  source: ProposalRow,
): Promise<boolean> {
  const metaJson = source.meta_json as Record<string, unknown> | null;
  const body = (metaJson?.body as Record<string, string | undefined>) ?? {};

  const content = {
    title: source.title ?? 'Untitled Proposal',
    abstract: source.abstract ?? '',
    motivation: body.motivation ?? 'Motivation not available from source proposal.',
    rationale: body.rationale ?? 'Rationale not available from source proposal.',
    proposalType: normalizeProposalType(source.proposal_type),
    typeSpecific: {},
  };

  const { error } = await supabase.from('proposal_draft_versions').insert({
    draft_id: draftId,
    version_number: 1,
    version_name: 'Initial draft',
    edit_summary: 'Initial proposal draft created from governance action content.',
    content,
  });

  if (error) {
    logger.error('[scenario-generator] Failed to insert initial version', {
      error: error.message,
      draftId,
    });
    return false;
  }

  return true;
}

async function createRevisionVersion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
  versionNumber: number,
): Promise<boolean> {
  // Get the draft content for the revision base
  const { data: draft, error: draftError } = await supabase
    .from('proposal_drafts')
    .select('title, abstract, motivation, rationale, proposal_type')
    .eq('id', draftId)
    .single();

  if (draftError || !draft) return false;

  const content = {
    title: draft.title,
    abstract: draft.abstract,
    motivation: draft.motivation + '\n\n[Revised based on community feedback]',
    rationale: draft.rationale,
    proposalType: normalizeProposalType(draft.proposal_type),
    typeSpecific: {},
  };

  const { error } = await supabase.from('proposal_draft_versions').insert({
    draft_id: draftId,
    version_number: versionNumber,
    version_name: pickRandom(VERSION_NAMES),
    edit_summary: pickRandom(VERSION_EDIT_SUMMARIES),
    content,
    created_at: recentTimestamp(14),
  });

  if (error) {
    logger.error('[scenario-generator] Failed to insert revision version', {
      error: error.message,
      draftId,
      versionNumber,
    });
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Review creation
// ---------------------------------------------------------------------------

async function createReview(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
  reviewer: ReviewerPersona,
  proposalTitle: string,
): Promise<boolean> {
  // Pick a review category with realistic distribution
  const category = pickReviewCategory();
  const templates = REVIEW_TEMPLATES[category];
  const template = pickRandom(templates);
  const feedbackText = template.replace(/\{proposal_title\}/g, proposalTitle);

  // Pick matching themes
  const templateIndex = templates.indexOf(template);
  const themePool = FEEDBACK_THEMES[category];
  const themes =
    templateIndex >= 0 && templateIndex < themePool.length
      ? themePool[templateIndex]
      : pickRandom(themePool);

  // Generate scores within category range
  const ranges = SCORE_RANGES[category];
  const insertData: Database['public']['Tables']['draft_reviews']['Insert'] = {
    draft_id: draftId,
    reviewer_stake_address: reviewer.stakeAddress,
    feedback_text: `[${reviewer.role}] ${feedbackText}`,
    feedback_themes: themes,
    impact_score: randInt(ranges.impact[0], ranges.impact[1]),
    feasibility_score: randInt(ranges.feasibility[0], ranges.feasibility[1]),
    constitutional_score: randInt(ranges.constitutional[0], ranges.constitutional[1]),
    value_score: randInt(ranges.value[0], ranges.value[1]),
    created_at: recentTimestamp(14),
  };

  const { error } = await supabase.from('draft_reviews').insert(insertData);

  if (error) {
    logger.error('[scenario-generator] Failed to insert review', {
      error: error.message,
      draftId,
      reviewer: reviewer.name,
    });
    return false;
  }

  return true;
}

/** Pick a review category with realistic distribution — more constructive/supportive, fewer purely critical */
function pickReviewCategory(): ReviewCategory {
  const roll = Math.random();
  if (roll < 0.3) return 'supportive';
  if (roll < 0.55) return 'constructive';
  if (roll < 0.8) return 'critical';
  return 'technical';
}

// ---------------------------------------------------------------------------
// Edge case generation
// ---------------------------------------------------------------------------

/** Distribution of edge case drafts across statuses */
const EDGE_CASE_STAGES: { status: DraftStatus; count: number }[] = [
  { status: 'draft', count: 2 },
  { status: 'community_review', count: 2 },
  { status: 'draft', count: 1 },
  { status: 'community_review', count: 1 },
];

async function generateEdgeCaseDrafts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId: string,
  startIndex: number,
  result: ScenarioResult,
): Promise<void> {
  const edgeDraftIds: { id: string; status: DraftStatus; index: number }[] = [];

  let ecIndex = 0;
  for (const stage of EDGE_CASE_STAGES) {
    for (let i = 0; i < stage.count; i++) {
      const draftId = await createEdgeCaseDraft(
        supabase,
        stage.status,
        cohortId,
        startIndex + ecIndex,
        ecIndex,
      );

      if (draftId) {
        edgeDraftIds.push({ id: draftId, status: stage.status, index: ecIndex });
        result.proposalsCreated++;

        // Create initial version with edge case content
        const versionCreated = await createEdgeCaseVersion(supabase, draftId, ecIndex);
        if (versionCreated) result.versionsCreated++;
      } else {
        result.errors.push(
          `Failed to create edge case draft #${ecIndex} at stage "${stage.status}"`,
        );
      }

      ecIndex++;
    }
  }

  // Generate edge case reviews on community_review drafts
  const reviewableDrafts = edgeDraftIds.filter((d) => d.status === 'community_review');

  for (const draft of reviewableDrafts) {
    // Use 2-3 reviewers with edge case feedback
    const reviewerCount = randInt(2, 3);
    const reviewers = pickRandomN(REVIEWER_PERSONAS, reviewerCount);

    for (let r = 0; r < reviewers.length; r++) {
      const created = await createEdgeCaseReview(supabase, draft.id, reviewers[r], r);
      if (created) result.reviewsCreated++;
    }
  }

  logger.info('[scenario-generator] Edge case drafts generated', {
    cohortId,
    edgeDraftsCreated: edgeDraftIds.length,
  });
}

async function createEdgeCaseDraft(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  status: DraftStatus,
  cohortId: string,
  globalIndex: number,
  edgeCaseIndex: number,
): Promise<string | null> {
  const now = new Date();
  const createdAt = recentTimestamp(30);
  const stageEnteredAt = recentTimestamp(14);

  const title = EDGE_CASE_TITLES[edgeCaseIndex % EDGE_CASE_TITLES.length];
  const abstract = EDGE_CASE_ABSTRACTS[edgeCaseIndex % EDGE_CASE_ABSTRACTS.length];
  const motivation = EDGE_CASE_MOTIVATIONS[edgeCaseIndex % EDGE_CASE_MOTIVATIONS.length];

  const typeSpecific: { [key: string]: Json | undefined } = {
    _scenarioSource: {
      generatedAt: now.toISOString(),
      edgeCase: true,
      edgeCaseIndex,
    },
  };

  const insertData: Database['public']['Tables']['proposal_drafts']['Insert'] = {
    owner_stake_address: syntheticOwner(globalIndex),
    title: title || 'Untitled Proposal',
    abstract: abstract || '',
    motivation: motivation || 'Motivation not provided.',
    rationale: 'Edge case rationale for stress testing.',
    proposal_type: 'InfoAction',
    type_specific: typeSpecific,
    status,
    current_version: 1,
    preview_cohort_id: cohortId,
    created_at: createdAt,
    stage_entered_at: stageEnteredAt,
    community_review_started_at: status !== 'draft' ? recentTimestamp(21) : null,
    fcp_started_at: null,
    submitted_tx_hash: null,
    submitted_at: null,
  };

  const { data, error } = await supabase
    .from('proposal_drafts')
    .insert(insertData)
    .select('id')
    .single();

  if (error || !data) {
    logger.error('[scenario-generator] Failed to insert edge case draft', {
      error: error?.message,
      edgeCaseIndex,
      status,
    });
    return null;
  }

  return data.id;
}

async function createEdgeCaseVersion(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
  edgeCaseIndex: number,
): Promise<boolean> {
  const title = EDGE_CASE_TITLES[edgeCaseIndex % EDGE_CASE_TITLES.length];
  const abstract = EDGE_CASE_ABSTRACTS[edgeCaseIndex % EDGE_CASE_ABSTRACTS.length];
  const motivation = EDGE_CASE_MOTIVATIONS[edgeCaseIndex % EDGE_CASE_MOTIVATIONS.length];

  const content = {
    title: title || 'Untitled Proposal',
    abstract: abstract || '',
    motivation: motivation || 'Motivation not provided.',
    rationale: 'Edge case rationale for stress testing.',
    proposalType: 'InfoAction' as const,
    typeSpecific: {},
  };

  const { error } = await supabase.from('proposal_draft_versions').insert({
    draft_id: draftId,
    version_number: 1,
    version_name: 'Edge case initial draft',
    edit_summary: `Edge case draft #${edgeCaseIndex + 1} for stress testing.`,
    content,
  });

  if (error) {
    logger.error('[scenario-generator] Failed to insert edge case version', {
      error: error.message,
      draftId,
    });
    return false;
  }

  return true;
}

async function createEdgeCaseReview(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  draftId: string,
  reviewer: ReviewerPersona,
  reviewIndex: number,
): Promise<boolean> {
  const feedbackText = EDGE_CASE_REVIEWS[reviewIndex % EDGE_CASE_REVIEWS.length];

  const insertData: Database['public']['Tables']['draft_reviews']['Insert'] = {
    draft_id: draftId,
    reviewer_stake_address: reviewer.stakeAddress,
    feedback_text: feedbackText,
    feedback_themes: ['edge-case', 'stress-test'],
    impact_score: randInt(1, 5),
    feasibility_score: randInt(1, 5),
    constitutional_score: randInt(1, 5),
    value_score: randInt(1, 5),
    created_at: recentTimestamp(14),
  };

  const { error } = await supabase.from('draft_reviews').insert(insertData);

  if (error) {
    logger.error('[scenario-generator] Failed to insert edge case review', {
      error: error.message,
      draftId,
      reviewer: reviewer.name,
    });
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanupExistingScenario(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  cohortId: string,
  result: ScenarioResult,
): Promise<void> {
  // Find existing drafts for this cohort
  const { data: existingDrafts } = await supabase
    .from('proposal_drafts')
    .select('id')
    .eq('preview_cohort_id', cohortId);

  if (!existingDrafts || existingDrafts.length === 0) return;

  const draftIds = existingDrafts.map((d) => d.id);

  // Delete reviews, versions, then drafts (respecting FK order)
  const { error: reviewError } = await supabase
    .from('draft_reviews')
    .delete()
    .in('draft_id', draftIds);

  if (reviewError) {
    result.errors.push(`Failed to cleanup reviews: ${reviewError.message}`);
  }

  // Delete review responses first (FK to draft_reviews)
  // We already deleted reviews, but responses have FK to reviews not drafts
  // So delete responses for reviews that belong to these drafts
  // Since we already deleted the reviews, responses should cascade or already be gone
  // But let's be safe: delete versions
  const { error: versionError } = await supabase
    .from('proposal_draft_versions')
    .delete()
    .in('draft_id', draftIds);

  if (versionError) {
    result.errors.push(`Failed to cleanup versions: ${versionError.message}`);
  }

  const { error: draftError } = await supabase
    .from('proposal_drafts')
    .delete()
    .eq('preview_cohort_id', cohortId);

  if (draftError) {
    result.errors.push(`Failed to cleanup drafts: ${draftError.message}`);
  }

  logger.info('[scenario-generator] Cleaned up existing scenario data', {
    cohortId,
    draftsRemoved: draftIds.length,
  });
}
