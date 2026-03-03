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
