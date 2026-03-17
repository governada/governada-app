/**
 * Scaffold prompt definitions for AI-assisted proposal drafting.
 *
 * Each proposal type has guided questions that help authors articulate their
 * idea before the AI generates a CIP-108 compliant first draft.
 */

import type { ProposalType } from './types';

export interface ScaffoldPrompt {
  /** Unique key for the answer map. */
  key: string;
  /** Displayed question / label. */
  label: string;
  /** Helper text shown as placeholder. */
  placeholder: string;
  /** Textarea rows (default 3). */
  rows?: number;
  /** Must answer before generating. */
  required?: boolean;
}

export interface ScaffoldDefinition {
  proposalType: ProposalType;
  /** Short guidance text shown above the prompts. */
  description: string;
  prompts: ScaffoldPrompt[];
}

export const SCAFFOLD_DEFINITIONS: Record<ProposalType, ScaffoldDefinition> = {
  InfoAction: {
    proposalType: 'InfoAction',
    description:
      'Info Actions communicate information to the community without requesting funds or changing parameters.',
    prompts: [
      {
        key: 'what_information',
        label: 'What information do you want to share with the community?',
        placeholder: 'Describe the key message or finding you want to communicate...',
        rows: 4,
        required: true,
      },
      {
        key: 'why_important',
        label: 'Why is this important for Cardano governance?',
        placeholder: 'Explain the significance and why the community should pay attention...',
        rows: 3,
        required: true,
      },
      {
        key: 'who_affected',
        label: 'Who should care about this?',
        placeholder: 'DReps, SPOs, delegators, developers, treasury teams...',
        rows: 2,
      },
      {
        key: 'desired_outcome',
        label: 'What outcome do you hope for?',
        placeholder: 'What should happen as a result of this information being shared?',
        rows: 3,
      },
    ],
  },

  TreasuryWithdrawals: {
    proposalType: 'TreasuryWithdrawals',
    description:
      'Treasury Withdrawals request ADA from the Cardano treasury to fund work that benefits the ecosystem.',
    prompts: [
      {
        key: 'what_funding_for',
        label: 'What are you requesting funding for?',
        placeholder: 'Describe the project, initiative, or work to be funded...',
        rows: 4,
        required: true,
      },
      {
        key: 'amount_ada',
        label: 'How much ADA are you requesting?',
        placeholder: 'e.g., 500,000 ADA — include a brief budget breakdown if possible',
        rows: 2,
        required: true,
      },
      {
        key: 'team_description',
        label: 'Who is the team delivering this work?',
        placeholder: 'Team members, relevant experience, past Cardano contributions...',
        rows: 3,
        required: true,
      },
      {
        key: 'timeline',
        label: 'What is the expected timeline?',
        placeholder: 'Key milestones and delivery dates...',
        rows: 2,
      },
      {
        key: 'success_metrics',
        label: 'How will success be measured?',
        placeholder: 'Specific, measurable outcomes that prove the work delivered value...',
        rows: 3,
      },
      {
        key: 'why_treasury',
        label: 'Why should the treasury fund this?',
        placeholder: 'What makes this a good use of community funds vs. other funding sources?',
        rows: 3,
        required: true,
      },
    ],
  },

  ParameterChange: {
    proposalType: 'ParameterChange',
    description:
      'Parameter Changes modify protocol-level settings that affect the entire Cardano network.',
    prompts: [
      {
        key: 'which_parameter',
        label: 'Which protocol parameter should change?',
        placeholder: 'e.g., maxBlockBodySize, govActionDeposit, dRepActivity...',
        rows: 1,
        required: true,
      },
      {
        key: 'proposed_value',
        label: 'What should the new value be?',
        placeholder: 'Current value → proposed value, with units if applicable',
        rows: 2,
        required: true,
      },
      {
        key: 'why_change',
        label: 'Why does this parameter need to change?',
        placeholder:
          'What problem does the current value cause? What evidence supports the change?',
        rows: 4,
        required: true,
      },
      {
        key: 'risks',
        label: 'What are the risks or trade-offs?',
        placeholder: 'Potential negative effects, who might be impacted adversely...',
        rows: 3,
      },
      {
        key: 'expected_impact',
        label: 'What impact do you expect?',
        placeholder: 'How will the network or ecosystem improve with this change?',
        rows: 3,
      },
    ],
  },

  HardForkInitiation: {
    proposalType: 'HardForkInitiation',
    description:
      'Hard Fork Initiations propose upgrading the Cardano protocol to a new major version.',
    prompts: [
      {
        key: 'protocol_version',
        label: 'Which protocol version is being proposed?',
        placeholder: 'e.g., major version 10, Conway era update...',
        rows: 1,
        required: true,
      },
      {
        key: 'what_changes',
        label: 'What changes does this hard fork include?',
        placeholder: 'Key features, improvements, or fixes included in this upgrade...',
        rows: 4,
        required: true,
      },
      {
        key: 'why_now',
        label: 'Why should this happen now?',
        placeholder: 'What makes this the right time for the upgrade?',
        rows: 3,
        required: true,
      },
      {
        key: 'backwards_compatibility',
        label: 'How does this affect backwards compatibility?',
        placeholder: 'Impact on existing dApps, wallets, infrastructure, SPOs...',
        rows: 3,
      },
    ],
  },

  NoConfidence: {
    proposalType: 'NoConfidence',
    description:
      'No Confidence motions express that the Constitutional Committee no longer has the community trust needed to fulfill its role.',
    prompts: [
      {
        key: 'specific_concerns',
        label: 'What specific concerns do you have about the current committee?',
        placeholder: 'Concrete actions, inactions, or decisions that eroded trust...',
        rows: 4,
        required: true,
      },
      {
        key: 'evidence',
        label: 'What evidence supports these concerns?',
        placeholder: 'On-chain votes, public statements, missed obligations, timeline of events...',
        rows: 4,
        required: true,
      },
      {
        key: 'what_changed',
        label: 'What changed since the committee was approved?',
        placeholder: 'Was there an event, pattern, or revelation that triggered this motion?',
        rows: 3,
      },
      {
        key: 'path_forward',
        label: 'What should happen after a successful no-confidence vote?',
        placeholder: 'Next steps for governance continuity, interim arrangements...',
        rows: 3,
      },
    ],
  },

  NewCommittee: {
    proposalType: 'NewCommittee',
    description: 'New Committee proposals change the composition of the Constitutional Committee.',
    prompts: [
      {
        key: 'proposed_members',
        label: 'Who are the proposed committee members?',
        placeholder: 'Names/identifiers, credentials, and governance track record...',
        rows: 4,
        required: true,
      },
      {
        key: 'qualifications',
        label: 'What qualifies these members?',
        placeholder: 'Relevant expertise, constitutional knowledge, community standing...',
        rows: 3,
        required: true,
      },
      {
        key: 'term_length',
        label: 'What is the proposed term length?',
        placeholder: 'Duration in epochs or calendar time, and why this length is appropriate...',
        rows: 2,
      },
      {
        key: 'selection_criteria',
        label: 'What criteria were used to select these members?',
        placeholder: 'Selection process, diversity considerations, conflict of interest checks...',
        rows: 3,
      },
      {
        key: 'why_change',
        label: 'Why is a committee change needed?',
        placeholder: 'What gap or issue does the new composition address?',
        rows: 3,
        required: true,
      },
    ],
  },

  NewConstitution: {
    proposalType: 'NewConstitution',
    description:
      'New Constitution proposals replace or amend the Cardano Constitution that guides governance decisions.',
    prompts: [
      {
        key: 'what_changes',
        label: 'What changes to the constitution are being proposed?',
        placeholder:
          'Specific articles, sections, or principles being added, modified, or removed...',
        rows: 4,
        required: true,
      },
      {
        key: 'why_insufficient',
        label: 'Why is the current constitution insufficient?',
        placeholder: 'Gaps, ambiguities, or failures in the current text that this addresses...',
        rows: 4,
        required: true,
      },
      {
        key: 'drafting_process',
        label: 'How was this draft developed?',
        placeholder: 'Who was involved, what consultations happened, how was input gathered?',
        rows: 3,
      },
      {
        key: 'community_input',
        label: 'How was community input incorporated?',
        placeholder: 'Workshops, surveys, public comment periods, delegate feedback...',
        rows: 3,
      },
    ],
  },
};
