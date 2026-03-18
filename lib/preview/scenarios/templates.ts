/**
 * Template-based review content for scenario generation.
 *
 * Provides realistic governance feedback without AI API calls.
 * Each template uses `{proposal_title}` as a placeholder.
 */

// ---------------------------------------------------------------------------
// Reviewer personas
// ---------------------------------------------------------------------------

export interface ReviewerPersona {
  name: string;
  role: string;
  stakeAddress: string;
}

/**
 * Synthetic reviewers with distinct governance perspectives.
 * Stake addresses use the `preview_` prefix so they're clearly non-real.
 */
export const REVIEWER_PERSONAS: ReviewerPersona[] = [
  {
    name: 'Maria Cardoso',
    role: 'Treasury Committee Analyst',
    stakeAddress: 'stake_preview_treasury_analyst_01',
  },
  {
    name: 'James Okonkwo',
    role: 'DeFi Protocol Developer',
    stakeAddress: 'stake_preview_defi_dev_02',
  },
  {
    name: 'Anika Sharma',
    role: 'Community Advocate',
    stakeAddress: 'stake_preview_community_03',
  },
  {
    name: 'Carlos Reyes',
    role: 'Stake Pool Operator',
    stakeAddress: 'stake_preview_spo_04',
  },
  {
    name: 'Elena Vasquez',
    role: 'Constitutional Committee Member',
    stakeAddress: 'stake_preview_cc_member_05',
  },
  {
    name: 'David Park',
    role: 'Academic Researcher',
    stakeAddress: 'stake_preview_researcher_06',
  },
  {
    name: 'Fatima Al-Hassan',
    role: 'Governance Tooling Builder',
    stakeAddress: 'stake_preview_tooling_07',
  },
  {
    name: 'Liam Chen',
    role: 'DRep & Policy Analyst',
    stakeAddress: 'stake_preview_drep_policy_08',
  },
  {
    name: 'Sophia Andersen',
    role: 'Treasury Auditor',
    stakeAddress: 'stake_preview_auditor_09',
  },
  {
    name: 'Raj Patel',
    role: 'Infrastructure Engineer',
    stakeAddress: 'stake_preview_infra_10',
  },
];

// ---------------------------------------------------------------------------
// Review feedback templates
// ---------------------------------------------------------------------------

export type ReviewCategory = 'supportive' | 'critical' | 'constructive' | 'technical';

export const REVIEW_TEMPLATES: Record<ReviewCategory, string[]> = {
  supportive: [
    'This proposal addresses a critical gap in the ecosystem. The {proposal_title} initiative aligns well with Cardano governance priorities and demonstrates clear community benefit.',
    'Strong proposal with clear deliverables. The budget allocation for {proposal_title} seems reasonable given the scope of work described.',
    'I appreciate the thoroughness of this proposal. {proposal_title} fills an important need that multiple community members have identified over the past several epochs.',
    'The team behind {proposal_title} has a solid track record. Their previous contributions give me confidence in their ability to deliver on this.',
    'Well-structured proposal. {proposal_title} provides measurable outcomes and a realistic timeline. The phased approach is particularly sensible for a project of this scope.',
    'This is exactly the kind of initiative Cardano governance should be funding. {proposal_title} creates lasting infrastructure value rather than one-off deliverables.',
    '{proposal_title} represents good value for the treasury. The cost per deliverable is competitive with similar projects, and the expected impact justifies the investment.',
    'I support this proposal. {proposal_title} addresses a real pain point I have seen discussed across multiple governance forums and town halls.',
  ],
  critical: [
    'While the intent behind {proposal_title} is sound, the implementation timeline seems overly optimistic. I would recommend extending Phase 1 by at least 2 months to account for realistic development cycles.',
    'The budget breakdown for {proposal_title} lacks detail in the operational costs section. Can the proposer provide a more granular breakdown of how the personnel budget is allocated?',
    'I have concerns about the sustainability of {proposal_title} after the funding period ends. What is the plan for ongoing maintenance and operation once treasury funding concludes?',
    '{proposal_title} overlaps significantly with an existing project that was funded 3 epochs ago. The proposer should clarify how this differs and whether collaboration was considered.',
    'The success metrics for {proposal_title} are too vague. Statements like "increase adoption" need specific, measurable targets — how many users, by when, measured how?',
    'I am not convinced {proposal_title} justifies the requested amount. Similar initiatives in other blockchain ecosystems have been delivered at roughly 40% of this cost.',
    'The risk assessment in {proposal_title} is notably absent. What happens if the primary developer leaves? What are the technical risks? Where are the contingency plans?',
    '{proposal_title} does not adequately address how it will handle the regulatory considerations that apply to this type of governance action. This needs to be resolved before on-chain submission.',
  ],
  constructive: [
    'Consider adding a milestone-based payment structure for {proposal_title}. This would provide better accountability and reduce treasury risk while still supporting the team.',
    'I would suggest the {proposal_title} team coordinate with the existing governance tooling projects to avoid duplicating effort. A brief alignment session could save months of parallel work.',
    'The proposal could be strengthened by including a community feedback mechanism. For {proposal_title}, I recommend quarterly progress reports with community Q&A sessions.',
    '{proposal_title} would benefit from a clearer escalation path. If milestones are missed, what remediation steps are proposed? This is standard practice for treasury-funded projects.',
    'I recommend splitting {proposal_title} into two phases: a smaller proof-of-concept (Phase 1) funded at 30% of the total, then the full build contingent on Phase 1 delivery.',
    'For {proposal_title}, consider establishing an advisory board of 3-5 community members who can provide ongoing governance oversight during the project lifecycle.',
    'The {proposal_title} proposal would be more compelling with user research data. Even informal surveys from governance forums would strengthen the case for this investment.',
    'One suggestion for {proposal_title}: document the intellectual property and licensing approach upfront. Open-source commitments should be explicit in the proposal text.',
  ],
  technical: [
    'The technical architecture described in {proposal_title} would benefit from a formal security audit before on-chain submission. Has the team identified a qualified auditor?',
    'Has the {proposal_title} team considered using CIP-68 for the metadata standard? It would simplify cross-platform integration and future-proof the solution.',
    'The API design outlined in {proposal_title} should follow the emerging Cardano governance API standards. This ensures interoperability with other governance tools in the ecosystem.',
    'For {proposal_title}, I recommend using Plutus V3 smart contracts rather than V2. The performance improvements and reduced execution costs would significantly benefit end users.',
    'The data model in {proposal_title} needs to account for the upcoming Conway era changes. Specifically, the DRep credential format is evolving and the proposal should accommodate both old and new formats.',
    '{proposal_title} should specify its approach to chain indexing. Will it use a custom indexer, Koios, or another solution? This has significant implications for reliability and cost.',
    'The scalability section of {proposal_title} underestimates the growth trajectory. Based on current governance participation trends, the system should be designed for at least 10x the stated capacity.',
    'I notice {proposal_title} plans to store data off-chain. The proposal should specify the data availability guarantees and what happens if the off-chain storage provider becomes unavailable.',
  ],
};

// ---------------------------------------------------------------------------
// Feedback themes (tags assigned to reviews)
// ---------------------------------------------------------------------------

export const FEEDBACK_THEMES: Record<ReviewCategory, string[][]> = {
  supportive: [
    ['ecosystem-alignment', 'clear-deliverables'],
    ['budget-reasonable', 'scope-appropriate'],
    ['community-need', 'well-researched'],
    ['team-credibility', 'track-record'],
    ['structured-approach', 'measurable-outcomes'],
    ['infrastructure-value', 'long-term-benefit'],
    ['cost-effective', 'good-value'],
    ['community-demand', 'real-pain-point'],
  ],
  critical: [
    ['timeline-concern', 'unrealistic-schedule'],
    ['budget-detail', 'transparency'],
    ['sustainability', 'long-term-viability'],
    ['duplication-risk', 'coordination-needed'],
    ['vague-metrics', 'accountability'],
    ['cost-concern', 'overpriced'],
    ['risk-management', 'contingency-missing'],
    ['regulatory-concern', 'compliance'],
  ],
  constructive: [
    ['milestone-payments', 'accountability'],
    ['coordination', 'ecosystem-alignment'],
    ['community-feedback', 'transparency'],
    ['escalation-path', 'risk-management'],
    ['phased-approach', 'risk-reduction'],
    ['governance-oversight', 'advisory-board'],
    ['user-research', 'evidence-based'],
    ['ip-licensing', 'open-source'],
  ],
  technical: [
    ['security-audit', 'technical-review'],
    ['standards-compliance', 'interoperability'],
    ['api-design', 'ecosystem-standards'],
    ['smart-contracts', 'performance'],
    ['future-proofing', 'conway-era'],
    ['infrastructure', 'chain-indexing'],
    ['scalability', 'capacity-planning'],
    ['data-availability', 'reliability'],
  ],
};

// ---------------------------------------------------------------------------
// Score ranges per review category
// ---------------------------------------------------------------------------

export interface ScoreRange {
  impact: [number, number];
  feasibility: [number, number];
  constitutional: [number, number];
  value: [number, number];
}

/** Score ranges (1-5) for each category — critical reviews score lower, supportive higher */
export const SCORE_RANGES: Record<ReviewCategory, ScoreRange> = {
  supportive: {
    impact: [4, 5],
    feasibility: [4, 5],
    constitutional: [4, 5],
    value: [4, 5],
  },
  critical: {
    impact: [2, 3],
    feasibility: [1, 3],
    constitutional: [2, 4],
    value: [1, 3],
  },
  constructive: {
    impact: [3, 4],
    feasibility: [3, 4],
    constitutional: [3, 5],
    value: [3, 4],
  },
  technical: {
    impact: [3, 5],
    feasibility: [2, 4],
    constitutional: [3, 5],
    value: [3, 4],
  },
};

// ---------------------------------------------------------------------------
// Version history templates (edit summaries for revision history)
// ---------------------------------------------------------------------------

export const VERSION_EDIT_SUMMARIES: string[] = [
  'Revised budget breakdown based on community feedback',
  'Added milestone-based payment schedule',
  'Expanded risk assessment section',
  'Clarified success metrics and KPIs',
  'Addressed constitutional alignment concerns',
  'Updated timeline to incorporate reviewer suggestions',
  'Added technical architecture details',
  'Incorporated feedback from governance forum discussion',
  'Refined abstract for clarity',
  'Added community engagement plan',
];

export const VERSION_NAMES: string[] = [
  'Community feedback revision',
  'Budget clarification update',
  'Technical detail expansion',
  'Risk assessment addition',
  'Metrics refinement',
  'Timeline adjustment',
  'Scope clarification',
  'Governance alignment update',
];
