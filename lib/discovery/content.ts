/**
 * Discovery content — tour definitions, feature maps, and section descriptions.
 *
 * All content is data-driven and persona-filtered. Components read from here
 * rather than hardcoding tour/feature information.
 */

export type UserSegment = 'anonymous' | 'citizen' | 'drep' | 'spo' | 'cc';
export type SectionId = 'hub' | 'governance' | 'match' | 'workspace' | 'you' | 'help';

/* ─── Spotlight step ─────────────────────────────────── */

export interface SpotlightStep {
  id: string;
  /** CSS selector using data-discovery attribute for stable targeting */
  targetSelector: string;
  title: string;
  description: string;
  position: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

/* ─── Mini tour ──────────────────────────────────────── */

export interface MiniTour {
  id: string;
  section: SectionId;
  label: string;
  description: string;
  icon: string;
  steps: SpotlightStep[];
  /** Which segments see this tour */
  segments: UserSegment[];
  /** Route to navigate to before starting */
  startRoute: string;
}

/* ─── Feature map item ───────────────────────────────── */

export interface DiscoveryFeature {
  id: string;
  section: SectionId;
  label: string;
  description: string;
  href: string;
  icon: string;
  /** JTBD category */
  category: string;
  segments: UserSegment[];
}

/* ─── JTBD categories for the Discovery Panel ────────── */

export const JTBD_CATEGORIES = [
  { id: 'understand', label: 'Understand governance', icon: 'BookOpen' },
  { id: 'find-reps', label: 'Find your representatives', icon: 'Users' },
  { id: 'monitor', label: 'Monitor your representation', icon: 'Eye' },
  { id: 'take-action', label: 'Take action', icon: 'Zap' },
  { id: 'identity', label: 'Build your identity', icon: 'Fingerprint' },
  { id: 'learn', label: 'Learn more', icon: 'GraduationCap' },
] as const;

/* ─── Section metadata ───────────────────────────────── */

export const SECTIONS: Record<SectionId, { label: string; icon: string; description: string }> = {
  hub: { label: 'Home', icon: 'Home', description: 'Your governance control center' },
  governance: { label: 'Governance', icon: 'Landmark', description: 'Explore governance activity' },
  match: { label: 'Match', icon: 'Compass', description: 'Find your governance team' },
  workspace: { label: 'Workspace', icon: 'LayoutDashboard', description: 'Your governance tools' },
  you: { label: 'You', icon: 'User', description: 'Your civic identity' },
  help: { label: 'Help', icon: 'HelpCircle', description: 'Learning resources & guides' },
};

/* ─── Tour definitions ───────────────────────────────── */

export const TOURS: MiniTour[] = [
  // ── Hub tours ──
  {
    id: 'hub-citizen',
    section: 'hub',
    label: 'Your governance home',
    description: 'Learn what your home page shows you and why it matters',
    icon: 'Home',
    segments: ['citizen', 'anonymous'],
    startRoute: '/',
    steps: [
      {
        id: 'hub-briefing',
        targetSelector: '[data-discovery="hub-briefing"]',
        title: 'Governance Briefing',
        description:
          'Your personalized summary of what happened this epoch — proposals, votes, and changes that affect your ADA.',
        position: 'bottom',
      },
      {
        id: 'hub-representation',
        targetSelector: '[data-discovery="hub-representation"]',
        title: 'Your Representation',
        description:
          'See who represents you and how well they are performing. This is your governance health at a glance.',
        position: 'bottom',
      },
      {
        id: 'hub-actions',
        targetSelector: '[data-discovery="hub-actions"]',
        title: 'Discover & Act',
        description:
          'Suggested next steps based on what is happening in governance right now. Proposals to review, votes to cast, and teams to build.',
        position: 'top',
      },
    ],
  },
  {
    id: 'hub-drep',
    section: 'hub',
    label: 'Your DRep cockpit',
    description: 'Navigate your governance workspace and delegator tools',
    icon: 'LayoutDashboard',
    segments: ['drep'],
    startRoute: '/',
    steps: [
      {
        id: 'drep-voting-queue',
        targetSelector: '[data-discovery="drep-voting-queue"]',
        title: 'Voting Queue',
        description:
          'Active proposals awaiting your vote. These are sorted by urgency so you never miss a deadline.',
        position: 'bottom',
      },
      {
        id: 'drep-delegators',
        targetSelector: '[data-discovery="drep-delegators"]',
        title: 'Delegator Overview',
        description:
          'Track who trusts you with their voting power. See growth trends and engagement levels.',
        position: 'bottom',
      },
      {
        id: 'drep-competitive',
        targetSelector: '[data-discovery="drep-competitive"]',
        title: 'Your Standing',
        description:
          'How you compare to other DReps on key governance metrics. Use this to improve your representation quality.',
        position: 'top',
      },
    ],
  },
  {
    id: 'hub-spo',
    section: 'hub',
    label: 'Your pool governance',
    description: 'Understand your pool governance identity and tools',
    icon: 'Server',
    segments: ['spo'],
    startRoute: '/',
    steps: [
      {
        id: 'spo-score',
        targetSelector: '[data-discovery="spo-score"]',
        title: 'Governance Score',
        description:
          'Your pool governance reputation — how actively and responsibly you participate in Cardano governance.',
        position: 'bottom',
      },
      {
        id: 'spo-delegators',
        targetSelector: '[data-discovery="spo-delegators"]',
        title: 'Pool Delegators',
        description:
          'Your delegators and their governance expectations. A differentiator for attracting delegation.',
        position: 'bottom',
      },
      {
        id: 'spo-position',
        targetSelector: '[data-discovery="spo-position"]',
        title: 'Governance Position',
        description:
          'Declare and share your stance on key governance topics. Delegators want to know where you stand.',
        position: 'top',
      },
    ],
  },

  // ── Governance tours ──
  {
    id: 'governance-overview',
    section: 'governance',
    label: 'How governance works',
    description: 'Explore proposals, representatives, and governance health',
    icon: 'Landmark',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
    startRoute: '/governance/proposals',
    steps: [
      {
        id: 'gov-proposals',
        targetSelector: '[data-discovery="gov-proposals"]',
        title: 'Active Proposals',
        description:
          'Every governance action being decided right now — treasury withdrawals, parameter changes, and more. Each proposal shows its current status and voting progress.',
        position: 'bottom',
      },
      {
        id: 'gov-representatives',
        targetSelector: '[data-discovery="gov-representatives"]',
        title: 'Representatives',
        description:
          'The DReps who vote on your behalf. Browse, compare, and find representatives whose values match yours.',
        position: 'bottom',
      },
      {
        id: 'gov-health',
        targetSelector: '[data-discovery="gov-health"]',
        title: 'Governance Health',
        description:
          'An objective measure of how well Cardano governance is functioning — participation rates, voting quality, and systemic resilience.',
        position: 'bottom',
      },
    ],
  },

  // ── Match tour ──
  {
    id: 'match-flow',
    section: 'match',
    label: 'Build your governance team',
    description: 'Find a DRep and pool that match your values in 60 seconds',
    icon: 'Compass',
    segments: ['anonymous', 'citizen'],
    startRoute: '/match',
    steps: [
      {
        id: 'match-questions',
        targetSelector: '[data-discovery="match-questions"]',
        title: 'Value Matching',
        description:
          'Answer 3 quick questions about your governance priorities. No wallet needed — just your perspective.',
        position: 'bottom',
      },
      {
        id: 'match-results',
        targetSelector: '[data-discovery="match-results"]',
        title: 'Your Matches',
        description:
          'See DReps and pools ranked by how closely they align with your values. Each match shows a compatibility score.',
        position: 'bottom',
      },
      {
        id: 'match-delegate',
        targetSelector: '[data-discovery="match-delegate"]',
        title: 'Delegate',
        description:
          'Ready to delegate? Connect your wallet and make it official. Your ADA stays in your wallet — you are just choosing who votes for you.',
        position: 'top',
      },
    ],
  },

  // ── Workspace tours (Step 4) ──
  {
    id: 'workspace-drep',
    section: 'workspace',
    label: 'Managing your representation',
    description: 'Your tools for voting, delegator management, and rationale writing',
    icon: 'LayoutDashboard',
    segments: ['drep'],
    startRoute: '/workspace',
    steps: [
      {
        id: 'ws-cockpit',
        targetSelector: '[data-discovery="ws-cockpit"]',
        title: 'Workspace Cockpit',
        description:
          'Your dashboard for governance action — pending votes, recent activity, and key metrics at a glance.',
        position: 'bottom',
      },
      {
        id: 'ws-votes',
        targetSelector: '[data-discovery="ws-votes"]',
        title: 'Vote Casting',
        description:
          'Review proposals and cast your votes. Each vote includes space for your rationale — delegators want to know your reasoning.',
        position: 'bottom',
      },
      {
        id: 'ws-delegators',
        targetSelector: '[data-discovery="ws-delegators"]',
        title: 'Delegator Insights',
        description:
          'Understand who trusts you: their ADA stake, how long they have delegated, and what they care about.',
        position: 'bottom',
      },
      {
        id: 'ws-rationale',
        targetSelector: '[data-discovery="ws-rationale"]',
        title: 'Rationale Hub',
        description:
          'Write and manage your voting rationales. Clear reasoning builds trust and attracts delegation.',
        position: 'top',
      },
    ],
  },
  {
    id: 'workspace-spo',
    section: 'workspace',
    label: 'Your pool governance identity',
    description: 'Build your governance reputation as a pool operator',
    icon: 'Server',
    segments: ['spo'],
    startRoute: '/workspace',
    steps: [
      {
        id: 'ws-spo-score',
        targetSelector: '[data-discovery="ws-spo-score"]',
        title: 'Governance Score',
        description:
          'Your pool governance reputation score — based on participation quality, reliability, and engagement.',
        position: 'bottom',
      },
      {
        id: 'ws-spo-profile',
        targetSelector: '[data-discovery="ws-spo-profile"]',
        title: 'Pool Profile',
        description:
          'Edit your governance profile. Share your stance on key topics to attract like-minded delegators.',
        position: 'bottom',
      },
      {
        id: 'ws-spo-delegators',
        targetSelector: '[data-discovery="ws-spo-delegators"]',
        title: 'Delegator Analytics',
        description:
          'Track your pool delegators and their governance preferences. A unique differentiator for your pool.',
        position: 'top',
      },
    ],
  },

  // ── You tour ──
  {
    id: 'you-identity',
    section: 'you',
    label: 'Your civic identity',
    description: 'Track your governance journey and build your reputation',
    icon: 'User',
    segments: ['citizen', 'drep', 'spo'],
    startRoute: '/you',
    steps: [
      {
        id: 'you-card',
        targetSelector: '[data-discovery="you-card"]',
        title: 'Identity Card',
        description:
          'Your governance identity at a glance — tier, engagement level, and delegation status.',
        position: 'bottom',
      },
      {
        id: 'you-milestones',
        targetSelector: '[data-discovery="you-milestones"]',
        title: 'Milestones',
        description:
          'Track your governance journey. Each milestone marks a meaningful step in your participation.',
        position: 'bottom',
      },
      {
        id: 'you-history',
        targetSelector: '[data-discovery="you-history"]',
        title: 'Governance History',
        description:
          'A timeline of your governance activity — delegations, votes, and engagement over time.',
        position: 'top',
      },
    ],
  },

  // ── Help tour ──
  {
    id: 'help-resources',
    section: 'help',
    label: 'Learning resources',
    description: 'Governance glossary, scoring methodology, and getting started guides',
    icon: 'HelpCircle',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
    startRoute: '/help',
    steps: [
      {
        id: 'help-getting-started',
        targetSelector: '[data-discovery="help-getting-started"]',
        title: 'Getting Started',
        description:
          'New to Cardano governance? Start here for a quick overview of how it all works and what you can do.',
        position: 'bottom',
      },
      {
        id: 'help-methodology',
        targetSelector: '[data-discovery="help-methodology"]',
        title: 'Scoring Methodology',
        description:
          'Full transparency on how we calculate scores, tiers, and health metrics. Every formula is documented.',
        position: 'bottom',
      },
    ],
  },
];

/* ─── Feature map ────────────────────────────────────── */

export const FEATURES: DiscoveryFeature[] = [
  // Understand governance
  {
    id: 'browse-proposals',
    section: 'governance',
    label: 'Browse proposals',
    description: 'See all active governance actions and their voting progress',
    href: '/governance/proposals',
    icon: 'FileText',
    category: 'understand',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'governance-health',
    section: 'governance',
    label: 'Governance health',
    description: 'Track how well Cardano governance is functioning',
    href: '/governance/health',
    icon: 'Activity',
    category: 'understand',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'committee-activity',
    section: 'governance',
    label: 'Committee activity',
    description: 'Monitor Constitutional Committee members and decisions',
    href: '/governance/committee',
    icon: 'Shield',
    category: 'understand',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },

  // Find representatives
  {
    id: 'match-flow',
    section: 'match',
    label: 'Build your governance team',
    description: 'Find a DRep and pool that match your values',
    href: '/match',
    icon: 'Compass',
    category: 'find-reps',
    segments: ['anonymous', 'citizen'],
  },
  {
    id: 'browse-dreps',
    section: 'governance',
    label: 'Browse DReps',
    description: 'Explore the full directory of governance representatives',
    href: '/governance/representatives',
    icon: 'Users',
    category: 'find-reps',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'browse-pools',
    section: 'governance',
    label: 'Browse pools',
    description: 'See how stake pools participate in governance',
    href: '/governance/pools',
    icon: 'Server',
    category: 'find-reps',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },

  // Monitor representation
  {
    id: 'delegation-health',
    section: 'hub',
    label: 'Delegation health',
    description: 'Check how well your representatives are performing',
    href: '/',
    icon: 'HeartPulse',
    category: 'monitor',
    segments: ['citizen'],
  },
  {
    id: 'governance-coverage',
    section: 'hub',
    label: 'Governance coverage',
    description: 'See if both your DRep and pool are actively governing',
    href: '/',
    icon: 'ShieldCheck',
    category: 'monitor',
    segments: ['citizen'],
  },

  // Take action
  {
    id: 'sentiment-voting',
    section: 'governance',
    label: 'Cast sentiment votes',
    description: 'Share your perspective on active proposals',
    href: '/governance/proposals',
    icon: 'MessageCircle',
    category: 'take-action',
    segments: ['citizen', 'drep', 'spo'],
  },
  {
    id: 'workspace-votes',
    section: 'workspace',
    label: 'Cast governance votes',
    description: 'Vote on proposals as a representative',
    href: '/workspace/votes',
    icon: 'Vote',
    category: 'take-action',
    segments: ['drep'],
  },
  {
    id: 'workspace-rationales',
    section: 'workspace',
    label: 'Write rationales',
    description: 'Explain your voting decisions to delegators',
    href: '/workspace',
    icon: 'PenLine',
    category: 'take-action',
    segments: ['drep'],
  },

  // Build identity
  {
    id: 'civic-identity',
    section: 'you',
    label: 'Your civic profile',
    description: 'See your governance identity, tier, and milestones',
    href: '/you',
    icon: 'Fingerprint',
    category: 'identity',
    segments: ['citizen', 'drep', 'spo'],
  },
  {
    id: 'share-toolkit',
    section: 'hub',
    label: 'Share your profile',
    description: 'Generate shareable images of your governance participation',
    href: '/you/public-profile',
    icon: 'Share2',
    category: 'identity',
    segments: ['citizen', 'drep', 'spo'],
  },

  // Learn more
  {
    id: 'getting-started',
    section: 'help',
    label: 'Getting started guide',
    description: 'New to governance? Start here for a quick overview',
    href: '/help',
    icon: 'GraduationCap',
    category: 'learn',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },
  {
    id: 'methodology',
    section: 'help',
    label: 'Scoring methodology',
    description: 'Full transparency on how scores and tiers are calculated',
    href: '/help/methodology',
    icon: 'Calculator',
    category: 'learn',
    segments: ['anonymous', 'citizen', 'drep', 'spo', 'cc'],
  },
];

/* ─── Helpers ────────────────────────────────────────── */

/** Get tours visible to a given segment */
export function getToursForSegment(segment: UserSegment): MiniTour[] {
  return TOURS.filter((t) => t.segments.includes(segment));
}

/** Get tours for a specific section + segment */
export function getSectionTours(section: SectionId, segment: UserSegment): MiniTour[] {
  return TOURS.filter((t) => t.section === section && t.segments.includes(segment));
}

/** Get features visible to a given segment */
export function getFeaturesForSegment(segment: UserSegment): DiscoveryFeature[] {
  return FEATURES.filter((f) => f.segments.includes(segment));
}

/** Get features grouped by JTBD category for a segment */
export function getFeaturesByCategory(segment: UserSegment) {
  const features = getFeaturesForSegment(segment);
  return JTBD_CATEGORIES.map((cat) => ({
    ...cat,
    features: features.filter((f) => f.category === cat.id),
  })).filter((cat) => cat.features.length > 0);
}

/** Get a tour by ID */
export function getTourById(tourId: string): MiniTour | undefined {
  return TOURS.find((t) => t.id === tourId);
}
