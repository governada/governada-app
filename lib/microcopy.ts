/**
 * Micro-Copy System — centralized copy bank for UI micro-moments.
 * The difference between a shadcn template and a product with personality.
 *
 * ── Tone Guide ──────────────────────────────────────────────────────────────
 *
 * All copy in Governada follows one of three tiers, matched to the user's
 * mindset — not the content type.
 *
 * WARM — "Teach me" mode
 *   Where: glossary, onboarding, help pages, first-encounter tooltips,
 *          "why it matters" text (especially citizen/anonymous segments).
 *   Voice: conversational, everyday analogies welcome, like explaining it
 *          to a smart friend over coffee. Never condescending, never cute.
 *   Test:  "Would my mom understand this without a follow-up question?"
 *   Example: "Like choosing a city council member — you pick someone, and
 *             they vote on neighborhood decisions for you."
 *
 * CLEAR — "Get it done" mode
 *   Where: inline tooltips during workflows, form hints, empty states,
 *          error messages, CTAs, loading messages.
 *   Voice: concise, personality through word choice not jokes. One sentence
 *          max. The user is mid-task — don't slow them down.
 *   Test:  "Can I read this in under 3 seconds and know what to do?"
 *   Example: "The chain threw us a curveball. Try refreshing."
 *
 * NEUTRAL — "Prove it" mode
 *   Where: methodology page, score breakdowns, data labels, chart axes.
 *   Voice: precise, no personality. Trust comes from rigor here.
 *   Test:  "Would a skeptic accept this as objective?"
 *   Example: "Importance-weighted participation rate across active proposals."
 *
 * When writing new copy, pick the tier that matches the user's likely
 * mindset at that moment. When in doubt, Clear is the safe default.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const LOADING_MESSAGES = {
  proposals: 'Counting votes...',
  discover: 'Mapping the constellation...',
  dashboard: 'Checking the chain...',
  pulse: 'Reading the governance pulse...',
  treasury: 'Tallying the treasury...',
  profile: 'Loading your governance journey...',
  drep: 'Building their governance portrait...',
  default: 'Loading...',
} as const;

export const ERROR_MESSAGES = {
  generic: 'The chain threw us a curveball. Try refreshing.',
  network: 'Lost connection to the governance layer. Check your network and try again.',
  notFound: "We looked everywhere in the constellation — this page doesn't exist.",
  rateLimit: 'Too many requests. Governance moves at its own pace — try again in a moment.',
} as const;

export const SCORE_BAND_LABELS: Record<string, string> = {
  strong: 'Governance powerhouse',
  good: 'Solid contributor',
  fair: 'Getting started',
  low: 'Room to grow',
};

export const CTA_LABELS = {
  connectWallet: 'Enter Governance',
  connectWalletShort: 'Connect',
  exploreDreps: 'Explore DReps',
  seeProposals: 'See Live Proposals',
  delegate: 'Delegate Your Voice',
  findDrep: 'Find Your Representative',
  viewProfile: 'View Full Profile',
  compare: 'Compare DReps',
  claimProfile: 'Claim Your Profile',
} as const;

export const PAGE_DESCRIPTIONS = {
  discover: 'Find the representative that matches your governance values.',
  proposals: 'Track Cardano governance proposals, DRep votes, and treasury decisions in real time.',
  pulse: "Real-time health of Cardano's on-chain governance.",
  treasury: "How Cardano's treasury is being spent — and whether it should be.",
  governance: 'Your personal governance hub. Track your delegation and participation.',
  dashboard: 'Your command center for governance.',
  compare: 'See how DReps stack up against each other.',
} as const;

export const EMPTY_STATE_MESSAGES = {
  noProposals:
    'The governance pipeline has quiet moments — check back soon or broaden your search.',
  noDreps:
    'No DReps match. Try adjusting your filters — there are hundreds of active representatives to explore.',
  noVotes: 'This DRep may be new or taking a break from governance.',
  noWatchlist:
    "Your watchlist is empty. Star DReps you want to track — you'll see their activity here.",
  noInbox: 'All caught up! No pending actions right now.',
} as const;

export function getLoadingMessage(page: keyof typeof LOADING_MESSAGES): string {
  return LOADING_MESSAGES[page] || LOADING_MESSAGES.default;
}

export function getScoreBandLabel(score: number): string {
  if (score >= 80) return SCORE_BAND_LABELS.strong;
  if (score >= 60) return SCORE_BAND_LABELS.good;
  if (score >= 40) return SCORE_BAND_LABELS.fair;
  return SCORE_BAND_LABELS.low;
}

// ─── Governance Terms (Warm tier for definitions, segment-aware for context) ─

export type GovTermSegment = 'anonymous' | 'citizen' | 'drep' | 'spo';

export interface GovTermDef {
  /** Display label used as the tooltip trigger text */
  label: string;
  /** One-sentence plain definition (Warm tier) */
  definition: string;
  /** Segment-aware "Why it matters" framing. Falls back to `default`. */
  whyItMatters: Partial<Record<GovTermSegment, string>> & { default: string };
}

export const GOV_TERMS: Record<string, GovTermDef> = {
  drep: {
    label: 'DRep',
    definition:
      'Someone who votes on Cardano decisions on behalf of ADA holders like you. Think of them as your elected representative.',
    whyItMatters: {
      anonymous:
        "Pick one and your ADA backs their votes on every governance decision — it never leaves your wallet, you're just lending your voice.",
      citizen:
        "This person votes on every proposal using your ADA's weight. Their track record — right here on Governada — shows how well they actually represent you.",
      drep: 'Every vote you cast carries the weight of everyone who delegated to you. That trust is reflected in your score.',
      spo: 'DReps vote on governance actions that directly affect network parameters and treasury allocation — the same decisions that affect your pool.',
      default:
        'DReps vote on Cardano governance proposals using the voting power of the ADA holders who delegate to them.',
    },
  },
  epoch: {
    label: 'Epoch',
    definition:
      'Cardano runs on 5-day cycles. Think of it like a work week — at the end, staking rewards land in your wallet and governance votes get counted.',
    whyItMatters: {
      citizen:
        'Proposals can expire at the end of a cycle, so your representative has a narrow window to vote. If they miss it, that vote is gone for good.',
      drep: 'Each epoch is a governance window. Missed votes within an epoch are permanent — they drag your Reliability score.',
      default:
        'Epochs are the heartbeat of Cardano — rewards, delegation snapshots, and governance deadlines all align to epoch boundaries.',
    },
  },
  delegation: {
    label: 'Delegation',
    definition:
      'Choosing who votes on your behalf. Like picking your representative in an election — except you can switch anytime, and your ADA never leaves your wallet.',
    whyItMatters: {
      anonymous:
        "It's free, takes about a minute, and doesn't move your ADA anywhere. You're just choosing who speaks for you when governance decisions come up.",
      citizen:
        'You can change your mind anytime — switch representatives and the change kicks in at the start of the next 5-day cycle. No fees, no paperwork.',
      default:
        'Delegation is how ADA holders participate in governance without voting on every proposal themselves.',
    },
  },
  governanceAction: {
    label: 'Governance Action',
    definition:
      'A proposal to change something about Cardano — like spending community funds, updating network rules, or approving a major upgrade.',
    whyItMatters: {
      citizen:
        "Every proposal that passes actually changes how Cardano works. Your representative votes on each one — that's why picking a good one matters.",
      drep: 'Your vote on each governance action is recorded on-chain permanently. How you vote (and whether you explain it) shapes your score.',
      default:
        "Governance actions are how Cardano's rules get changed. They require approval from DReps, stake pools, and the Constitutional Committee.",
    },
  },
  votingPower: {
    label: 'Voting Power',
    definition:
      "The total ADA backing a representative. It's like the difference between a petition with 10 signatures and 10,000 — more backing means more influence.",
    whyItMatters: {
      citizen:
        "When you delegate, your ADA adds to your representative's voting power. The more people choose them, the more weight their votes carry.",
      drep: 'Governada deliberately excludes voting power from your score — governance quality, not whale capture, is what we measure.',
      default:
        "Voting power determines how much weight a DRep's vote carries. High voting power doesn't mean high quality — that's what the score is for.",
    },
  },
  rationale: {
    label: 'Rationale',
    definition:
      'A representative\'s written explanation of why they voted a certain way. The difference between "I voted yes" and "here\'s why I voted yes."',
    whyItMatters: {
      citizen:
        "Rationales let you see your representative's actual thinking. Someone who explains their reasoning is doing the job — someone who just clicks buttons isn't.",
      drep: 'Providing rationales is the single highest-leverage action to improve your Engagement Quality score. Each one is AI-analyzed for depth.',
      default:
        'Rationales turn votes from yes/no signals into accountable positions — essential for informed delegation.',
    },
  },
  drepScore: {
    label: 'DRep Score',
    definition:
      'A quality rating from 0 to 100 that measures how well a representative does their job — not how much ADA they have, but how responsibly they use the trust placed in them.',
    whyItMatters: {
      citizen:
        "Higher is better, but the number is just the headline. Tap through to see what's behind it — are they voting? Explaining their reasoning? Showing up consistently?",
      drep: 'Your score is percentile-normalized against all DReps. Improving any pillar moves you up relative to the field.',
      default:
        "The DRep Score isn't about voting power — it measures governance discipline, transparency, and engagement quality.",
    },
  },
  tier: {
    label: 'Governance Tier',
    definition:
      'A quality badge for representatives — Emerging, Bronze, Silver, Gold, Diamond, or Legendary. Like a trust rating that tells you at a glance how strong their track record is.',
    whyItMatters: {
      citizen:
        "Don't want to dig into the numbers? The tier badge gives you an instant read. Gold and above means they're consistently doing good work.",
      drep: 'Each tier unlock is a milestone — Diamond and Legendary DReps are in the top 15% and 5% of the field respectively.',
      default:
        'Tiers translate percentile scores into memorable, comparable labels that make governance quality scannable at a glance.',
    },
  },
  treasury: {
    label: 'Treasury',
    definition:
      "Cardano's shared community fund — built up from transaction fees over time. Think of it like a city budget that the residents themselves vote on how to spend.",
    whyItMatters: {
      citizen:
        'This is real money, and your representative votes on how it gets spent. A good rep funds critical projects. A careless one can waste community resources.',
      drep: 'Treasury governance actions carry the highest stakes. Your treasury voting record is scrutinized by delegators and analysts.',
      default:
        'The Cardano treasury holds billions in ADA. Every withdrawal requires governance approval from DReps, pools, and the Constitutional Committee.',
    },
  },
  constitutionalCommittee: {
    label: 'Constitutional Committee',
    definition:
      "A small group of elected officials who act as Cardano's referees. They check that every governance decision follows the rules before it takes effect.",
    whyItMatters: {
      citizen:
        "Even if every representative votes yes on a proposal, this committee can block it if it breaks Cardano's rules. They're the safety net.",
      default:
        'The Constitutional Committee is one of three governance bodies. Their approval (alongside DReps and stake pools) is required for most governance actions.',
    },
  },
  hardFork: {
    label: 'Hard Fork',
    definition:
      'A major upgrade to how Cardano works — like a big software update that everyone on the network adopts at the same time. These are rare and require broad agreement.',
    whyItMatters: {
      citizen:
        "These are the biggest decisions in governance. Your representative's vote on a hard fork literally shapes what Cardano becomes next.",
      spo: 'Hard forks require pool operators to update node software — your vote and upgrade readiness both matter here.',
      default:
        'Hard forks are the highest-stakes governance actions — they change how Cardano works at the protocol level.',
    },
  },
  quorum: {
    label: 'Quorum',
    definition:
      "The minimum number of people who need to participate for a vote to count. It's a safeguard — if not enough representatives show up, the decision doesn't go through.",
    whyItMatters: {
      citizen:
        "This is why having an active representative matters. If too many reps sit out a vote, even good proposals can't pass — they just expire.",
      drep: "Low participation hurts everyone — if overall DRep voting doesn't reach quorum, governance actions fail even if those who voted approved them.",
      default:
        "Quorum prevents a small group from passing governance actions when most of the network isn't paying attention.",
    },
  },
} as const;

export function getGovTerm(key: string): GovTermDef | null {
  return GOV_TERMS[key as keyof typeof GOV_TERMS] ?? null;
}

export function getWhyItMatters(term: GovTermDef, segment?: GovTermSegment | null): string {
  if (segment && segment in term.whyItMatters) {
    return (term.whyItMatters as Record<string, string>)[segment];
  }
  return term.whyItMatters.default;
}
