/**
 * View As Registry — canonical source of truth for all user persona × state
 * combinations that affect UX in Governada.
 *
 * RULE: Every new user state that changes what a user sees MUST be added here.
 * See `.claude/rules/view-as-registry.md` for the enforcement rule.
 *
 * The admin "View as" menu in GovernadaHeader renders directly from this registry.
 * If it's not here, it's not testable. If it's not testable, it doesn't ship.
 */

import type { UserSegment } from '@/components/providers/SegmentProvider';
import type { EngagementLevel } from '@/lib/citizen/engagementLevel';
import type { CredibilityTier } from '@/lib/citizenCredibility';
import type { GovernanceLevel } from '@/lib/governanceLevels';
import type { GovernanceDepth } from '@/lib/governanceTuner';

// ---------------------------------------------------------------------------
// 1. Segment × Sub-state combos (the "who am I" dimension)
// ---------------------------------------------------------------------------

export interface SegmentPreset {
  id: string;
  label: string;
  description: string;
  segment: UserSegment;
  /** Override fields applied to SegmentOverride when selected */
  overrides: {
    drepId?: string | null;
    poolId?: string | null;
    delegatedDrep?: string | null;
    delegatedPool?: string | null;
  };
  /** If true, opens a picker dialog instead of applying immediately */
  requiresPicker?: 'drep' | 'spo' | 'cc';
  /** After the first picker completes, open a second picker for this type */
  secondaryPicker?: 'drep' | 'spo' | 'cc';
  /** Picker title/description overrides */
  pickerTitle?: string;
  pickerDescription?: string;
  /** Secondary picker title/description overrides */
  secondaryPickerTitle?: string;
  secondaryPickerDescription?: string;
}

export const SEGMENT_PRESETS: SegmentPreset[] = [
  // -- Citizen --
  {
    id: 'citizen-undelegated',
    label: 'Undelegated',
    description: 'Wallet connected, no delegation',
    segment: 'citizen',
    overrides: { delegatedDrep: null },
  },
  {
    id: 'citizen-delegated',
    label: 'Delegated to...',
    description: 'Pick a specific DRep to delegate to',
    segment: 'citizen',
    overrides: {},
    requiresPicker: 'drep',
    pickerTitle: 'Delegate to a DRep',
    pickerDescription: 'View the app as a citizen delegated to this DRep.',
  },
  {
    id: 'citizen-abstainer',
    label: 'Abstainer',
    description: 'Delegated to the always-abstain DRep',
    segment: 'citizen',
    overrides: { delegatedDrep: 'drep_always_abstain' },
  },
  {
    id: 'citizen-no-confidence',
    label: 'No Confidence',
    description: 'Delegated to the no-confidence DRep',
    segment: 'citizen',
    overrides: { delegatedDrep: 'drep_always_no_confidence' },
  },

  // -- DRep --
  {
    id: 'drep-unclaimed',
    label: 'Unclaimed',
    description: 'Has DRep credentials but no claimed profile',
    segment: 'drep',
    overrides: { drepId: null },
  },
  {
    id: 'drep-claimed',
    label: 'Claimed (pick DRep)...',
    description: 'View the app as a specific DRep',
    segment: 'drep',
    overrides: {},
    requiresPicker: 'drep',
    pickerTitle: 'Claim a DRep profile',
    pickerDescription: 'View the app as this DRep.',
  },

  // -- SPO --
  {
    id: 'spo-unclaimed',
    label: 'Unclaimed',
    description: 'Has pool operator status but no claimed profile',
    segment: 'spo',
    overrides: { poolId: null },
  },
  {
    id: 'spo-claimed',
    label: 'Claimed (pick SPO)...',
    description: 'View the app as a specific pool operator',
    segment: 'spo',
    overrides: {},
    requiresPicker: 'spo',
    pickerTitle: 'Claim an SPO profile',
    pickerDescription: 'View the app as this pool operator.',
  },

  // -- DRep + SPO (dual role) --
  {
    id: 'drep-spo-dual',
    label: 'DRep + SPO (dual role)...',
    description: 'User is both a DRep and an SPO — shows combined workspace',
    segment: 'drep',
    overrides: {},
    requiresPicker: 'drep',
    secondaryPicker: 'spo',
    pickerTitle: 'Step 1: Pick a DRep',
    pickerDescription: 'Select the DRep identity for the dual-role simulation.',
    secondaryPickerTitle: 'Step 2: Pick a Stake Pool',
    secondaryPickerDescription: 'Select the SPO identity for the dual-role simulation.',
  },

  // -- CC Member --
  {
    id: 'cc-unclaimed',
    label: 'Unclaimed',
    description: 'CC member status detected but no claimed profile',
    segment: 'cc',
    overrides: {},
  },
  {
    id: 'cc-claimed',
    label: 'Claimed (pick member)...',
    description: 'View the app as a specific committee member',
    segment: 'cc',
    overrides: {},
    requiresPicker: 'cc',
    pickerTitle: 'Claim a CC member profile',
    pickerDescription: 'View the app as this committee member.',
  },

  // -- Anonymous --
  {
    id: 'anonymous',
    label: 'Anonymous (no wallet)',
    description: 'Simulate an unauthenticated visitor',
    segment: 'anonymous',
    overrides: {},
  },
];

/** Group presets by segment for menu rendering */
export function getPresetsBySegment(): Map<UserSegment, SegmentPreset[]> {
  const map = new Map<UserSegment, SegmentPreset[]>();
  for (const preset of SEGMENT_PRESETS) {
    const list = map.get(preset.segment) ?? [];
    list.push(preset);
    map.set(preset.segment, list);
  }
  return map;
}

// ---------------------------------------------------------------------------
// 2. Cross-cutting dimensions (the "what's my status" layer)
// ---------------------------------------------------------------------------

export interface DimensionValue<T extends string = string> {
  key: T;
  label: string;
  description: string;
}

export interface CrossCuttingDimension<T extends string = string> {
  id: string;
  label: string;
  description: string;
  /** Which segments this dimension applies to. Empty = all. */
  appliesTo: UserSegment[];
  values: DimensionValue<T>[];
  /** Default value (what "reset" reverts to — null means "use real computed value") */
  defaultValue: null;
}

export const ENGAGEMENT_LEVEL_DIMENSION: CrossCuttingDimension<EngagementLevel> = {
  id: 'engagementLevel',
  label: 'Engagement Level',
  description: 'Citizen recognition tier: how active they are in governance',
  appliesTo: ['citizen'],
  values: [
    { key: 'Registered', label: 'Registered', description: 'Connected wallet, baseline' },
    { key: 'Informed', label: 'Informed', description: 'Delegated + reads epoch recaps' },
    { key: 'Engaged', label: 'Engaged', description: 'Polls + 3-day visit streak' },
    { key: 'Champion', label: 'Champion', description: 'Shares + 7-day visit streak' },
  ],
  defaultValue: null,
};

export const CREDIBILITY_TIER_DIMENSION: CrossCuttingDimension<CredibilityTier> = {
  id: 'credibilityTier',
  label: 'Credibility Tier',
  description: 'Signal weight tier based on participation history',
  appliesTo: ['citizen'],
  values: [
    { key: 'standard', label: 'Standard', description: 'Weight 0.1–0.49' },
    { key: 'enhanced', label: 'Enhanced', description: 'Weight 0.5–0.79' },
    { key: 'full', label: 'Full', description: 'Weight 0.8–1.0' },
  ],
  defaultValue: null,
};

export const GOVERNANCE_LEVEL_DIMENSION: CrossCuttingDimension<GovernanceLevel> = {
  id: 'governanceLevel',
  label: 'Governance Level',
  description: 'Participation milestone badge',
  appliesTo: ['citizen'],
  values: [
    { key: 'observer', label: 'Observer', description: '0+ polls, watching' },
    { key: 'voter', label: 'Voter', description: '3+ poll votes' },
    { key: 'guardian', label: 'Guardian', description: '10+ polls, 3+ epochs, delegated' },
    { key: 'champion', label: 'Champion', description: '25+ polls, 10+ epochs' },
  ],
  defaultValue: null,
};

export const GOVERNANCE_DEPTH_DIMENSION: CrossCuttingDimension<GovernanceDepth> = {
  id: 'governanceDepth',
  label: 'Governance Depth',
  description: 'How closely the user follows governance — controls notification/digest intensity',
  appliesTo: [],
  values: [
    { key: 'hands_off', label: 'Hands-Off', description: 'Alerts only when something is wrong' },
    { key: 'informed', label: 'Informed', description: 'Major governance updates' },
    { key: 'engaged', label: 'Engaged', description: 'Active governance participation' },
    { key: 'deep', label: 'Deep', description: 'Full visibility, full control' },
  ],
  defaultValue: null,
};

/**
 * All cross-cutting dimensions. Add new dimensions here when they are created.
 * The View As menu iterates this array to render dimension override controls.
 */
export const CROSS_CUTTING_DIMENSIONS = [
  ENGAGEMENT_LEVEL_DIMENSION,
  CREDIBILITY_TIER_DIMENSION,
  GOVERNANCE_LEVEL_DIMENSION,
  GOVERNANCE_DEPTH_DIMENSION,
] as const;

// ---------------------------------------------------------------------------
// 3. Combined override type (used by SegmentProvider)
// ---------------------------------------------------------------------------

export interface DimensionOverrides {
  engagementLevel?: EngagementLevel | null;
  credibilityTier?: CredibilityTier | null;
  governanceLevel?: GovernanceLevel | null;
  governanceDepth?: GovernanceDepth | null;
}

// ---------------------------------------------------------------------------
// 4. Segment display metadata (labels + icons for menu rendering)
// ---------------------------------------------------------------------------

export const SEGMENT_MENU_GROUPS: {
  segment: UserSegment;
  label: string;
  icon: string;
}[] = [
  { segment: 'citizen', label: 'Citizen', icon: 'User' },
  { segment: 'drep', label: 'DRep', icon: 'Users' },
  { segment: 'spo', label: 'SPO', icon: 'ShieldCheck' },
  { segment: 'cc', label: 'CC Member', icon: 'Scale' },
  // Anonymous is rendered separately (not a sub-menu)
];
