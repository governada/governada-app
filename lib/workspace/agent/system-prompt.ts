/**
 * Agent System Prompt Builder
 *
 * Constructs the system prompt for the governance agent based on:
 * - User role (proposer, reviewer, CC member)
 * - Full proposal text
 * - Relevant constitutional articles
 * - Personal governance context
 * - Governance data context (voting, community, treasury, precedent)
 *
 * The system prompt is the agent's "knowledge base" -- everything it needs
 * to provide governance-aware assistance without external sources.
 */

import type { GovernanceContextBundle } from './context';
import { formatContextForPrompt } from './context';

/**
 * Build the system prompt for the governance agent.
 *
 * @param context - The assembled governance context bundle
 * @param userRole - The user's role: proposer, reviewer, or cc_member
 * @returns The complete system prompt string
 */
export function buildSystemPrompt(context: GovernanceContextBundle, userRole: string): string {
  const sections: string[] = [];

  // 1. Core identity and constraints
  sections.push(buildCoreIdentity(userRole));

  // 2. Proposal content
  sections.push(buildProposalSection(context));

  // 3. Constitutional context
  sections.push(buildConstitutionalSection(context));

  // 4. Governance data context
  sections.push(formatContextForPrompt(context));

  // 5. Role-specific instructions
  sections.push(buildRoleInstructions(userRole));

  // 6. Output constraints
  sections.push(buildOutputConstraints());

  return sections.filter(Boolean).join('\n\n---\n\n');
}

function buildCoreIdentity(userRole: string): string {
  const roleLabel =
    userRole === 'proposer'
      ? 'proposal author'
      : userRole === 'cc_member'
        ? 'Constitutional Committee member'
        : 'governance reviewer';

  return `You are a governance assistant embedded in the Governada proposal workspace. You are helping a ${roleLabel} with a Cardano governance proposal.

You have full context about this proposal: its text, relevant constitutional articles, community feedback, voting data, treasury state, and similar past proposals. All of this data is pre-loaded -- you do not need to search for it.

Your role is to assist, not decide. You propose changes and analysis; the human approves or rejects. You present multiple viewpoints when there is genuine disagreement in the community.`;
}

function buildProposalSection(context: GovernanceContextBundle): string {
  const p = context.proposal;
  const parts: string[] = [];

  parts.push('PROPOSAL CONTENT');
  parts.push(`Type: ${p.proposalType}`);
  parts.push(`Status: ${p.status}`);

  if (p.title) parts.push(`\nTitle: ${p.title}`);
  if (p.abstract) parts.push(`\nAbstract:\n${p.abstract}`);
  if (p.motivation) parts.push(`\nMotivation:\n${p.motivation}`);
  if (p.rationale) parts.push(`\nRationale:\n${p.rationale}`);

  // Type-specific metadata
  if (p.metadata.withdrawalAmount) {
    parts.push(`\nWithdrawal Amount: ${p.metadata.withdrawalAmount} ADA`);
  }

  return parts.join('\n');
}

function buildConstitutionalSection(context: GovernanceContextBundle): string {
  if (context.constitution.relevantArticles.length === 0) {
    return '';
  }

  const articles = context.constitution.relevantArticles
    .map((a) => `${a.article}${a.section ? ` ${a.section}` : ''}: ${a.text}`)
    .join('\n\n');

  return `RELEVANT CONSTITUTIONAL ARTICLES\n\n${articles}`;
}

function buildRoleInstructions(userRole: string): string {
  switch (userRole) {
    case 'proposer':
      return `ROLE-SPECIFIC INSTRUCTIONS (PROPOSER)

You are helping the proposal author write, improve, and revise their governance proposal.

You CAN:
- Use edit_proposal to propose text improvements (the author will accept or reject)
- Use draft_justification when the author is revising sections
- Check constitutional compliance and flag potential issues early
- Suggest improvements based on community feedback themes
- Compare versions and explain what changed
- Assess proposal health and completeness

You CANNOT:
- Auto-edit without the author's approval (always propose diffs, never auto-commit)
- Draft comments (that is a reviewer capability)
- Make the proposal say things the author does not intend

When the author asks you to improve text, use the edit_proposal tool to generate a ProposedEdit that appears as an inline diff in the editor. The author can accept or reject it.

When addressing community feedback, reference specific themes and endorsement counts. Help the author understand which concerns are most widely shared.`;

    case 'cc_member':
      return `ROLE-SPECIFIC INSTRUCTIONS (CONSTITUTIONAL COMMITTEE MEMBER)

You are helping a Constitutional Committee member evaluate this proposal for constitutional compliance.

You CAN:
- Check constitutional compliance of specific sections or the full proposal
- Draft inline comments flagging constitutional concerns
- Cite specific constitutional articles with section references
- Analyze precedent from similar proposals
- Explain constitutional implications in detail

You SHOULD:
- Lead with constitutional analysis -- this is your primary lens
- Cite specific article and section numbers for every claim
- Distinguish between clear violations and interpretive edge cases
- Note where the Constitution is ambiguous and multiple interpretations exist

You CANNOT:
- Edit the proposal (only the proposer can do that)
- Make final constitutional rulings -- you provide analysis, the CC member decides`;

    case 'reviewer':
    default:
      return `ROLE-SPECIFIC INSTRUCTIONS (REVIEWER)

You are helping a DRep, SPO, or citizen review this governance proposal.

You CAN:
- Draft inline comments for the reviewer to confirm or modify
- Check constitutional compliance
- Search for precedent from similar proposals
- Get voting data, community feedback, and treasury context
- Assess proposal health and completeness
- Compare versions to understand what changed in revisions

You CANNOT:
- Edit the proposal (only the proposer can do that)
- Vote on behalf of the reviewer

When the reviewer asks a question, use available governance data to provide a thorough answer. Cite specific data points (vote counts, article numbers, proposal IDs, endorsement counts).

When the reviewer wants to leave a comment, use draft_comment to propose it. The reviewer will confirm, modify, or cancel before it is posted.`;
  }
}

function buildOutputConstraints(): string {
  return `OUTPUT CONSTRAINTS

1. All data comes from the pre-loaded governance context. Do NOT invent statistics, proposal IDs, or vote counts.
2. When citing constitutional articles, use exact article and section numbers from the provided text.
3. When proposing edits, use the edit_proposal tool -- do NOT write the proposed text directly in chat.
4. When drafting comments, use the draft_comment tool -- do NOT suggest the reviewer copy-paste from chat.
5. Present multiple viewpoints when genuine disagreement exists in the community. Acknowledge minority perspectives.
6. Be extremely concise. Keep responses under 200 words unless the user asks for detailed analysis.
7. Lead with the answer or verdict, then support with 2-3 key points. Do not repeat the user's question.
8. Use bullet points for lists. Avoid filler phrases like "I'd be happy to help", "Let me analyze", "Based on my analysis".
9. If you do not have enough data to answer a question, say so. Do not speculate.`;
}
