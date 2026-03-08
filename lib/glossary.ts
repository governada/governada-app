/**
 * Governance glossary — plain-English definitions for Cardano governance terms.
 * Used by the GovTerm tooltip component for contextual education.
 * Keep definitions to 1-2 sentences, no jargon in the definition itself.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  learnMoreUrl?: string;
}

const entries: GlossaryEntry[] = [
  {
    term: 'DRep',
    definition:
      'A Delegated Representative who votes on governance proposals on behalf of ADA holders. You choose one, and they vote for you.',
  },
  {
    term: 'delegation',
    definition:
      'Assigning your voting power to a DRep. Your ADA stays in your wallet — only your governance voice is shared.',
  },
  {
    term: 'epoch',
    definition:
      'A 5-day period on Cardano. Governance actions, staking rewards, and scores are calculated per epoch.',
  },
  {
    term: 'treasury',
    definition:
      'A pool of ADA funded by transaction fees and monetary expansion. It pays for ecosystem development through governance votes.',
  },
  {
    term: 'ADA',
    definition:
      'The native currency of Cardano. Holding ADA gives you the right to participate in governance.',
  },
  {
    term: 'governance action',
    definition:
      'A formal proposal submitted on-chain for the community to vote on. Examples include treasury withdrawals and protocol changes.',
  },
  {
    term: 'proposal',
    definition:
      'A specific governance action requesting a decision — like funding a project, changing a parameter, or updating the constitution.',
  },
  {
    term: 'rationale',
    definition:
      'A public explanation of why a DRep voted a certain way. Published on-chain for transparency.',
  },
  {
    term: 'stake pool',
    definition:
      'A server that processes Cardano transactions and produces blocks. ADA holders delegate to pools to earn staking rewards.',
  },
  {
    term: 'SPO',
    definition:
      'Stake Pool Operator — the person or team running a stake pool. SPOs also vote on certain governance actions.',
  },
  {
    term: 'Constitutional Committee',
    definition:
      'A group of elected members who verify that governance actions comply with the Cardano Constitution before they can be enacted.',
  },
  {
    term: 'CIP',
    definition:
      'Cardano Improvement Proposal — a technical document proposing changes to the Cardano protocol or ecosystem standards.',
  },
  {
    term: 'voting power',
    definition:
      'The amount of ADA delegated to a DRep or stake pool. More ADA delegated means more influence on governance outcomes.',
  },
  {
    term: 'governance health',
    definition:
      'A measure of how well Cardano governance is functioning — based on participation, diversity, and decision quality.',
  },
  {
    term: 'alignment',
    definition:
      "How closely a DRep or SPO's voting patterns match your governance values across key dimensions like treasury and transparency.",
  },
  {
    term: 'score',
    definition:
      "A 0-100 rating reflecting a DRep or SPO's governance participation quality — based on voting, rationales, reliability, and profile.",
  },
  {
    term: 'runway',
    definition:
      'How long the treasury can sustain current spending before running out, measured in months or years.',
  },
  {
    term: 'proportional share',
    definition:
      "Your portion of the treasury based on your delegation's voting power relative to the total.",
  },
  {
    term: 'on-chain',
    definition:
      'Recorded directly on the Cardano blockchain. On-chain data is permanent, transparent, and verifiable by anyone.',
  },
  {
    term: 'CIP-100',
    definition:
      'The standard format for publishing governance rationales on Cardano. Ensures all explanations are structured and machine-readable.',
  },
  {
    term: 'CIP-119',
    definition:
      'The standard for DRep identity metadata on Cardano. Defines how DReps publish their profile, bio, and contact information.',
  },
  {
    term: 'hard fork',
    definition:
      'A major protocol upgrade that changes how Cardano works. Requires broad consensus from DReps, SPOs, and the Constitutional Committee.',
  },
  {
    term: 'parameter change',
    definition:
      'A governance action that adjusts a protocol setting — like transaction fees, block size, or staking rewards.',
  },
  {
    term: 'ratification',
    definition:
      'When a governance action receives enough votes to pass. After ratification, it gets enacted on-chain.',
  },
  {
    term: 'quorum',
    definition:
      'The minimum amount of participation needed for a vote to be valid. Prevents small groups from making decisions for everyone.',
  },
];

/** Lookup a glossary entry by term (case-insensitive) */
export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  const lower = term.toLowerCase();
  return entries.find((e) => e.term.toLowerCase() === lower);
}

/** All glossary entries */
export const GLOSSARY = entries;
