/**
 * Governance glossary — plain-English definitions for Cardano governance terms.
 * Used by the GovTerm tooltip component and the /help/glossary page.
 * Keep definitions to 1-2 sentences, no jargon in the definition itself.
 *
 * "Mom test": every definition should be clear to an ADA holder who has
 * never heard of on-chain governance.
 */

export interface GlossaryEntry {
  term: string;
  definition: string;
  /** Which section this term belongs to on the glossary page */
  category: GlossaryCategory;
  learnMoreUrl?: string;
}

export type GlossaryCategory =
  | 'The Basics'
  | 'People & Roles'
  | 'Your Participation'
  | 'How Decisions Work'
  | 'Money & Treasury'
  | 'Scores & Quality'
  | 'Technical';

/** Display order for categories on the glossary page */
export const CATEGORY_ORDER: GlossaryCategory[] = [
  'The Basics',
  'People & Roles',
  'Your Participation',
  'How Decisions Work',
  'Money & Treasury',
  'Scores & Quality',
  'Technical',
];

const entries: GlossaryEntry[] = [
  // ─── The Basics ──────────────────────────────────────────────────────────────
  {
    term: 'ADA',
    definition:
      'The digital currency of Cardano — like dollars for the Cardano network. If you hold ADA, you automatically have the right to participate in how Cardano is run.',
    category: 'The Basics',
  },
  {
    term: 'Cardano',
    definition:
      'A blockchain network — a global, shared computer system — that runs on ADA. It lets people send money, run applications, and vote on how the network should evolve.',
    category: 'The Basics',
  },
  {
    term: 'governance',
    definition:
      "How decisions get made about Cardano's future. Instead of a company making all the calls, ADA holders get to vote on changes — like a digital democracy for the network.",
    category: 'The Basics',
  },
  {
    term: 'blockchain',
    definition:
      'A shared digital record book that no single person controls. Every transaction and vote is written down permanently and can be verified by anyone.',
    category: 'The Basics',
  },
  {
    term: 'on-chain',
    definition:
      'Recorded permanently on the blockchain where anyone can see it. When something happens "on-chain," it\'s like publishing it in a public record that can never be erased.',
    category: 'The Basics',
  },
  {
    term: 'wallet',
    definition:
      'An app on your phone or computer that holds your ADA and lets you interact with Cardano. Your ADA never actually leaves your wallet when you participate in governance.',
    category: 'The Basics',
  },
  {
    term: 'constitution',
    definition:
      "Cardano's rulebook. It defines what governance decisions are allowed and sets boundaries that protect the network. Think of it like a country's constitution, but for a blockchain.",
    category: 'The Basics',
  },

  // ─── People & Roles ──────────────────────────────────────────────────────────
  {
    term: 'DRep',
    definition:
      'Short for Delegated Representative. Someone who studies governance proposals and votes on them on your behalf — like choosing a city council member to represent your neighborhood. You pick one, they vote for you.',
    category: 'People & Roles',
  },
  {
    term: 'representative',
    definition:
      "Another name for a DRep. The person you choose to vote on Cardano decisions for you. You can switch your representative at any time — it's your choice.",
    category: 'People & Roles',
  },
  {
    term: 'delegator',
    definition:
      "That's you! An ADA holder who has chosen a representative to vote on their behalf. Your ADA stays in your wallet — you're just lending your voice, not your money.",
    category: 'People & Roles',
  },
  {
    term: 'SPO',
    definition:
      "Stake Pool Operator — a person or team that runs one of the computers keeping Cardano running. Think of them as the network's infrastructure operators. They also vote on certain big decisions.",
    category: 'People & Roles',
  },
  {
    term: 'stake pool',
    definition:
      'A computer server that helps process transactions and keep Cardano running. When you "stake" your ADA to a pool, you earn rewards for helping the network — like earning interest.',
    category: 'People & Roles',
  },
  {
    term: 'Constitutional Committee',
    definition:
      "A small group of elected officials who act as referees. Before any decision takes effect, they check that it follows Cardano's rules (the constitution). They can block proposals that break the rules, even if they got enough votes.",
    category: 'People & Roles',
  },

  // ─── Your Participation ───────────────────────────────────────────────────────
  {
    term: 'delegation',
    definition:
      "Choosing who votes on your behalf. It's free, takes about a minute, and your ADA never leaves your wallet. Think of it like registering to vote and picking your representative in one step.",
    category: 'Your Participation',
  },
  {
    term: 'voting power',
    definition:
      "The total ADA backing a representative. When you delegate to someone, your ADA adds to their voting power — giving their votes more weight. It's like the difference between a petition with 10 signatures vs. 10,000.",
    category: 'Your Participation',
  },
  {
    term: 'staking',
    definition:
      'Locking your ADA with a stake pool to help secure the network. In return, you earn regular rewards (like interest). Staking and governance delegation are separate — you can do both at the same time.',
    category: 'Your Participation',
  },
  {
    term: 'staking rewards',
    definition:
      "ADA you earn every 5 days for staking. It's paid automatically into your wallet. You earn rewards regardless of whether you also participate in governance.",
    category: 'Your Participation',
  },
  {
    term: 'Abstain',
    definition:
      'A special option that means "I choose not to vote on this." You can delegate to the built-in Abstain option if you want to sit out governance entirely while still earning staking rewards.',
    category: 'Your Participation',
  },
  {
    term: 'No Confidence',
    definition:
      "A special delegation option that signals you've lost trust in the current Constitutional Committee. It's a formal protest vote — like a vote of no confidence in a parliament.",
    category: 'Your Participation',
  },

  // ─── How Decisions Work ───────────────────────────────────────────────────────
  {
    term: 'governance action',
    definition:
      'A formal proposal submitted for the community to vote on. It could be about spending community funds, changing how the network works, or updating the rules. Anyone can submit one.',
    category: 'How Decisions Work',
  },
  {
    term: 'proposal',
    definition:
      'A specific request for the community to decide on — like "fund this project" or "change this network setting." Every proposal goes through a structured voting process before anything changes.',
    category: 'How Decisions Work',
  },
  {
    term: 'vote',
    definition:
      "A representative's decision on a proposal: Yes, No, or Abstain. Votes are recorded on the blockchain permanently, so you can always check how your representative voted.",
    category: 'How Decisions Work',
  },
  {
    term: 'rationale',
    definition:
      "A representative's written explanation of why they voted a certain way. Good representatives explain their thinking so you can judge whether they represent your values.",
    category: 'How Decisions Work',
  },
  {
    term: 'ratification',
    definition:
      'When a proposal gets enough votes to pass. After ratification, the change gets applied to Cardano automatically — no one can block it at that point.',
    category: 'How Decisions Work',
  },
  {
    term: 'quorum',
    definition:
      "The minimum number of people who need to participate for a vote to count. This prevents a small group from sneaking through a decision when most people aren't paying attention.",
    category: 'How Decisions Work',
  },
  {
    term: 'epoch',
    definition:
      'A 5-day cycle on Cardano. Think of it like a work week for the blockchain — at the end of each epoch, staking rewards are paid out, votes are tallied, and governance snapshots are taken.',
    category: 'How Decisions Work',
  },
  {
    term: 'hard fork',
    definition:
      'A major upgrade to how Cardano works — like a big software update that everyone adopts at the same time. These are rare and need approval from representatives, pool operators, and the Constitutional Committee.',
    category: 'How Decisions Work',
  },
  {
    term: 'parameter change',
    definition:
      'A proposal to adjust a specific network setting — like transaction fees or block size. These are smaller changes than a hard fork but still require a community vote.',
    category: 'How Decisions Work',
  },
  {
    term: 'treasury withdrawal',
    definition:
      "A proposal to spend money from Cardano's community fund. Each withdrawal request is voted on individually, so the community controls every spending decision.",
    category: 'How Decisions Work',
  },
  {
    term: 'info action',
    definition:
      "A proposal that doesn't change anything — it's just asking the community for their opinion on a topic. Like a poll or a non-binding referendum.",
    category: 'How Decisions Work',
  },
  {
    term: 'update committee',
    definition:
      'A proposal to change who sits on the Constitutional Committee — adding new members, removing existing ones, or adjusting how many need to agree for a decision to pass.',
    category: 'How Decisions Work',
  },

  // ─── Money & Treasury ─────────────────────────────────────────────────────────
  {
    term: 'treasury',
    definition:
      "Cardano's community fund — a shared pool of ADA that grows automatically from transaction fees. It's like a city budget, and the community votes on how to spend it.",
    category: 'Money & Treasury',
  },
  {
    term: 'runway',
    definition:
      "How long the treasury can keep funding projects at the current spending rate before it runs out. If the runway is 5 years, that means there's enough money for 5 more years of spending at today's pace.",
    category: 'Money & Treasury',
  },
  {
    term: 'proportional share',
    definition:
      'Your slice of the treasury pie, based on how much voting power your representative carries. If your representative controls 1% of all voting power, "your" proportional share is 1% of the treasury.',
    category: 'Money & Treasury',
  },
  {
    term: 'monetary expansion',
    definition:
      'New ADA that gets created each epoch and added to the treasury and staking rewards. The amount decreases over time, so the total supply of ADA has a fixed limit.',
    category: 'Money & Treasury',
  },
  {
    term: 'transaction fee',
    definition:
      'A small amount of ADA paid whenever someone sends a transaction on Cardano. Part of these fees goes to stake pools and part goes to the treasury.',
    category: 'Money & Treasury',
  },

  // ─── Scores & Quality ─────────────────────────────────────────────────────────
  {
    term: 'DRep Score',
    definition:
      "A quality rating from 0 to 100 that measures how well a representative is doing their job. It looks at things like: Do they vote consistently? Do they explain their decisions? Are they transparent about who they are? It's not about how much ADA they have — it's about how responsible they are.",
    category: 'Scores & Quality',
  },
  {
    term: 'governance tier',
    definition:
      'A quality badge based on a representative\'s score: Emerging, Bronze, Silver, Gold, Diamond, or Legendary. Like a trust rating — higher tiers mean a better track record. A "Gold" representative is in the top ~30% of all representatives.',
    category: 'Scores & Quality',
  },
  {
    term: 'alignment',
    definition:
      "How closely a representative's voting pattern matches what you care about. Governada analyzes their votes across categories like treasury spending, transparency, and technical changes to show you who thinks like you.",
    category: 'Scores & Quality',
  },
  {
    term: 'governance health',
    definition:
      "A measure of how well Cardano's governance is working overall. It looks at things like how many people are participating, whether power is spread out fairly, and whether decisions are being made responsibly.",
    category: 'Scores & Quality',
  },
  {
    term: 'engagement quality',
    definition:
      'One part of a representative\'s score that measures how thoughtfully they participate. Do they just click "yes" or "no," or do they write detailed explanations of their reasoning?',
    category: 'Scores & Quality',
  },
  {
    term: 'reliability',
    definition:
      "One part of a representative's score that measures how consistently they show up and vote. A reliable representative doesn't miss important votes or disappear for weeks.",
    category: 'Scores & Quality',
  },
  {
    term: 'transparency',
    definition:
      "One part of a representative's score that measures how open they are about who they are and what they stand for. Do they have a profile? Do they explain their voting philosophy?",
    category: 'Scores & Quality',
  },

  // ─── Technical ────────────────────────────────────────────────────────────────
  {
    term: 'CIP',
    definition:
      'Cardano Improvement Proposal — a formal document suggesting a change to how Cardano works. Think of it like a bill being proposed in Congress. It gets debated and refined before anything changes.',
    category: 'Technical',
  },
  {
    term: 'CIP-1694',
    definition:
      "The specific proposal that created Cardano's entire governance system. It's the reason ADA holders can vote on decisions today. Named after its proposal number.",
    category: 'Technical',
  },
  {
    term: 'CIP-100',
    definition:
      'A standard format for publishing vote explanations on Cardano. It makes sure every rationale is structured consistently, so tools like Governada can display them clearly.',
    category: 'Technical',
  },
  {
    term: 'CIP-119',
    definition:
      'A standard for representative profiles on Cardano. It defines how representatives publish their name, bio, and contact information so you can learn about them before choosing one.',
    category: 'Technical',
  },
  {
    term: 'metadata',
    definition:
      "Extra information attached to a transaction — like a representative's profile, a vote rationale, or a proposal description. It's stored alongside the transaction on the blockchain.",
    category: 'Technical',
  },
  {
    term: 'stake address',
    definition:
      "A special address tied to your wallet that handles staking and governance. It's different from the address you use to send ADA. You don't need to know your stake address to participate — your wallet handles it automatically.",
    category: 'Technical',
  },
  {
    term: 'deposit',
    definition:
      'A refundable amount of ADA required to submit a governance proposal or register as a representative. You get it back when the proposal expires or you step down. It prevents spam.',
    category: 'Technical',
  },
];

/** Lookup a glossary entry by term (case-insensitive) */
export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  const lower = term.toLowerCase();
  return entries.find((e) => e.term.toLowerCase() === lower);
}

/** All glossary entries */
export const GLOSSARY = entries;

/** Glossary entries grouped by category, in display order */
export function getGlossaryByCategory(): {
  category: GlossaryCategory;
  entries: GlossaryEntry[];
}[] {
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    entries: entries.filter((e) => e.category === cat),
  })).filter((g) => g.entries.length > 0);
}
