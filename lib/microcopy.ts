/**
 * Micro-Copy System — centralized copy bank for UI micro-moments.
 * The difference between a shadcn template and a product with personality.
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

// ─── Governance Terms ────────────────────────────────────────────────────────

export type GovTermSegment = 'anonymous' | 'citizen' | 'drep' | 'spo';

export interface GovTermDef {
  /** Display label used as the tooltip trigger text */
  label: string;
  /** One-sentence plain definition */
  definition: string;
  /** Segment-aware "Why it matters" framing. Falls back to `default`. */
  whyItMatters: Partial<Record<GovTermSegment, string>> & { default: string };
}

export const GOV_TERMS: Record<string, GovTermDef> = {
  drep: {
    label: 'DRep',
    definition:
      'A Delegated Representative — an on-chain agent who casts governance votes on behalf of ADA holders who delegate to them.',
    whyItMatters: {
      anonymous:
        "When you delegate to a DRep, your ADA's voting weight amplifies their voice in every governance decision.",
      citizen:
        'Your DRep votes on every proposal using your delegated ADA. Their track record tells you how well they represent your values.',
      drep: 'Your DRep status means every vote you cast carries the weight of everyone who delegated to you.',
      spo: 'DReps vote on governance actions that directly affect network parameters and treasury allocation — the same decisions that affect your pool.',
      default:
        'DReps vote on Cardano governance proposals using the voting power of the ADA holders who delegate to them.',
    },
  },
  epoch: {
    label: 'Epoch',
    definition:
      'A fixed 5-day period on the Cardano blockchain after which rewards are distributed and governance snapshots are taken.',
    whyItMatters: {
      citizen:
        'Governance proposals can expire at epoch boundaries — your DRep has a narrow window to vote before opportunities close.',
      drep: 'Each epoch is a governance window. Missed votes within an epoch are permanent — they drag your Reliability score.',
      default:
        'Epochs are the heartbeat of Cardano — rewards, delegation snapshots, and governance deadlines all align to epoch boundaries.',
    },
  },
  delegation: {
    label: 'Delegation',
    definition:
      "The act of assigning your ADA's voting power to a DRep without transferring ownership of your ADA.",
    whyItMatters: {
      anonymous:
        "Delegating costs nothing and doesn't move your ADA — it just amplifies a representative's governance voice with your weight.",
      citizen:
        'You can redelegate to a different DRep at any time — switching takes effect at the next epoch snapshot.',
      default:
        'Delegation is how citizens participate in governance without voting on every proposal themselves.',
    },
  },
  governanceAction: {
    label: 'Governance Action',
    definition:
      'An on-chain proposal submitted to the Cardano governance system — covering treasury withdrawals, protocol parameter changes, hard forks, and constitutional amendments.',
    whyItMatters: {
      citizen:
        'Every governance action that passes changes how Cardano works — treasury spending, network rules, and protocol upgrades all flow through this process.',
      drep: 'Your vote on each governance action is recorded on-chain permanently. How you vote (and whether you explain it) shapes your score.',
      default:
        "Governance actions are how Cardano's rules get changed. They require approval from DReps, stake pools, and the Constitutional Committee.",
    },
  },
  votingPower: {
    label: 'Voting Power',
    definition:
      'The total ADA delegated to a DRep, measured in lovelace (1 ADA = 1,000,000 lovelace), representing their weighted influence on governance outcomes.',
    whyItMatters: {
      citizen:
        'The more ADA holders delegate to your DRep, the greater their weight in deciding governance outcomes.',
      drep: 'Civica deliberately excludes voting power from your score — governance quality, not whale capture, is what we reward.',
      default:
        "Voting power determines how much weight a DRep's vote carries. High voting power doesn't mean high quality.",
    },
  },
  rationale: {
    label: 'Rationale',
    definition:
      "A DRep's on-chain or off-chain explanation of why they voted a particular way on a governance action.",
    whyItMatters: {
      citizen:
        "Rationales are your window into your DRep's reasoning — the difference between a representative who thinks and one who just clicks.",
      drep: 'Providing rationales is the single highest-leverage action to improve your Engagement Quality score. Each one is AI-analyzed for depth.',
      default:
        'Rationales turn votes from yes/no signals into accountable positions — essential for informed delegation.',
    },
  },
  drepScore: {
    label: 'DRep Score',
    definition:
      "Civica's composite 0–100 governance quality score, combining Engagement Quality (35%), Effective Participation (25%), Reliability (25%), and Governance Identity (15%).",
    whyItMatters: {
      citizen:
        'The score compresses hundreds of governance data points into one number — but always drill into the pillars to understand the story behind it.',
      drep: 'Your score is percentile-normalized against all DReps. Improving any pillar moves you up relative to the field.',
      default:
        "The DRep Score isn't about voting power — it measures governance discipline, transparency, and engagement quality.",
    },
  },
  tier: {
    label: 'Governance Tier',
    definition:
      'A six-level classification of governance quality: Emerging (0–39), Bronze (40–54), Silver (55–69), Gold (70–84), Diamond (85–94), Legendary (95–100).',
    whyItMatters: {
      citizen:
        "Tier badges give you an instant read on a DRep's governance standing without having to parse raw numbers.",
      drep: 'Each tier unlock is a milestone — Diamond and Legendary DReps are in the top 15% and 5% of the field respectively.',
      default:
        'Tiers translate percentile scores into memorable, comparable labels that make governance quality scannable at a glance.',
    },
  },
  treasury: {
    label: 'Treasury',
    definition:
      'The on-chain ADA reserve — funded by transaction fees and monetary expansion — that finances Cardano ecosystem development via governance-approved withdrawals.',
    whyItMatters: {
      citizen:
        'Your DRep votes on treasury withdrawals. Large disbursements can fund critical infrastructure — or waste community resources.',
      drep: 'Treasury governance actions carry the highest stakes. Your treasury voting record is scrutinized by delegators and analysts.',
      default:
        'The Cardano treasury holds billions in ADA. Every withdrawal requires governance approval from DReps, pools, and the Constitutional Committee.',
    },
  },
  constitutionalCommittee: {
    label: 'Constitutional Committee',
    definition:
      'An elected body of representatives responsible for ensuring governance actions are constitutional before they can be enacted.',
    whyItMatters: {
      citizen:
        'The CC acts as a final check on governance — even if DReps approve an action, the CC can block it if it violates the constitution.',
      default:
        'The Constitutional Committee is one of three governance bodies. Their approval (alongside DReps and stake pools) is required for most governance actions.',
    },
  },
  hardFork: {
    label: 'Hard Fork',
    definition:
      'A protocol upgrade that requires all nodes to update software. On Cardano, hard forks are approved through the governance system.',
    whyItMatters: {
      citizen:
        "Hard forks change Cardano's technical rules. Your DRep's vote on hard fork proposals shapes the network's evolution.",
      spo: 'Hard forks require pool operators to update node software — your vote and upgrade readiness both matter here.',
      default:
        'Hard forks are the highest-stakes governance actions — they literally change how Cardano works at the protocol level.',
    },
  },
  quorum: {
    label: 'Quorum',
    definition:
      'The minimum percentage of active voting stake required for a governance action to be considered valid — varies by proposal type.',
    whyItMatters: {
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
