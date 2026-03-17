/**
 * Contract C: Governance Context Bundle
 *
 * Assembled per-request for the agent. Contains everything the agent needs
 * to answer questions and take actions on a governance proposal.
 * This is the agent's "codebase" — the full context it operates on.
 */

import type { FeedbackTheme } from '../feedback/types';

/** Constitutional article relevant to a proposal */
export interface ConstitutionalArticle {
  article: string;
  section?: string;
  text: string;
}

/** Vote tally for a single governance body */
export interface VoteTally {
  yes: number;
  no: number;
  abstain: number;
}

/** Similar past proposal with outcome */
export interface PrecedentProposal {
  id: string;
  title: string;
  outcome: string;
  similarity: number;
}

/** The full governance context bundle for the agent */
export interface GovernanceContextBundle {
  /** Proposal content and metadata */
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

  /** Version history */
  versions: Array<{
    versionNumber: number;
    versionName: string;
    createdAt: string;
    changeJustifications?: Array<{
      field: string;
      justification: string;
      linkedThemeId?: string;
    }>;
  }>;

  /** Constitutional context */
  constitution: {
    relevantArticles: ConstitutionalArticle[];
  };

  /** Current voting data */
  voting: {
    drep: VoteTally;
    spo: VoteTally;
    cc: VoteTally;
    deadline?: string;
    epochsRemaining?: number;
  };

  /** Community feedback */
  community: {
    themes: FeedbackTheme[];
    totalReviewers: number;
    totalAnnotations: number;
  };

  /** Treasury state (for withdrawal proposals) */
  treasury?: {
    balance: number;
    recentWithdrawals: number;
    tier: string;
  };

  /** Similar past proposals */
  precedent: PrecedentProposal[];

  /** Personal governance profile */
  personal: {
    role: string;
    alignment: Record<string, number>;
    recentVotes: Array<{ proposalTitle: string; vote: string }>;
    philosophy?: string;
  };
}

/**
 * Assemble the full governance context for a proposal + user.
 *
 * Stub — implemented in Phase 1B (Agent Backend).
 * Caches with 60s TTL to avoid redundant fetches.
 */
export async function assembleGovernanceContext(
  _proposalId: string,
  _userId: string,
): Promise<GovernanceContextBundle> {
  throw new Error('Not implemented — Phase 1B');
}
