/**
 * Governance Tuner — maps user intent ("how closely do I follow governance?")
 * to concrete notification/digest configuration.
 *
 * Four depth levels:
 * - hands_off: "Alert me only if something is wrong" (~2 events)
 * - informed: "Keep me posted on major events" (~5 events, default for citizens)
 * - engaged: "I want to participate actively" (~12 events, default for SPOs)
 * - deep: "Full visibility into everything" (all events, default for DReps)
 */

import { EVENT_REGISTRY } from './notificationRegistry';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GovernanceDepth = 'hands_off' | 'informed' | 'engaged' | 'deep';

export interface TunerLevel {
  key: GovernanceDepth;
  label: string;
  description: string;
  shortDescription: string;
  iconName: string;
  eventTypes: string[];
  digestFrequency: string;
  order: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const GOVERNANCE_DEPTHS: GovernanceDepth[] = ['hands_off', 'informed', 'engaged', 'deep'];

/** Most critical "something is wrong" alerts — delegation health, governance crisis. */
const HANDS_OFF_EVENTS: string[] = ['drep-inactive', 'treasury-health-alert'];

/** Major governance updates — new proposals, DRep score changes, epoch summaries. */
const INFORMED_EVENTS: string[] = [
  ...HANDS_OFF_EVENTS,
  'critical-proposal-open',
  'drep-score-change',
  'governance-brief',
];

/** Active participation — alignment, tiers, votes, milestones, proposal outcomes. */
const ENGAGED_EVENTS: string[] = [
  ...INFORMED_EVENTS,
  'alignment-drift',
  'tier-change',
  'drep-voted',
  'treasury-proposal-new',
  'delegation-milestone',
  'engagement-outcome',
  'representation-drop',
  'poll-deadline',
  'better-match-found',
];

/** All user-facing events (excludes system-only events like profile-view, api-health-alert). */
function getAllUserFacingEventKeys(): string[] {
  return EVENT_REGISTRY.filter((e) => e.key !== 'profile-view' && e.key !== 'api-health-alert').map(
    (e) => e.key,
  );
}

export const TUNER_LEVELS: Record<GovernanceDepth, TunerLevel> = {
  hands_off: {
    key: 'hands_off',
    label: 'Hands-Off',
    description:
      "You'll only hear from us if something needs your attention — like your delegation becoming inactive or a critical governance event.",
    shortDescription: "Alerts only when something's wrong",
    iconName: 'BellOff',
    eventTypes: HANDS_OFF_EVENTS,
    digestFrequency: 'none',
    order: 0,
  },
  informed: {
    key: 'informed',
    label: 'Informed',
    description:
      "Stay in the loop on major governance activity — new proposals, your DRep's score changes, and epoch summaries.",
    shortDescription: 'Major governance updates',
    iconName: 'Bell',
    eventTypes: INFORMED_EVENTS,
    digestFrequency: 'weekly',
    order: 1,
  },
  engaged: {
    key: 'engaged',
    label: 'Engaged',
    description:
      'Actively participate in governance decisions. Get notified about alignment drift, delegation milestones, and how your DRep voted on proposals you care about.',
    shortDescription: 'Active governance participation',
    iconName: 'BellRing',
    eventTypes: ENGAGED_EVENTS,
    digestFrequency: 'epoch',
    order: 2,
  },
  deep: {
    key: 'deep',
    label: 'Deep',
    description:
      'Full visibility into everything happening in Cardano governance. Every event, individually configurable.',
    shortDescription: 'Full visibility, full control',
    iconName: 'BellPlus',
    eventTypes: getAllUserFacingEventKeys(),
    digestFrequency: 'epoch',
    order: 3,
  },
};

// ── Functions ─────────────────────────────────────────────────────────────────

export function getTunerLevel(depth: GovernanceDepth): TunerLevel {
  return TUNER_LEVELS[depth];
}

export function getTunerEvents(depth: GovernanceDepth): string[] {
  return TUNER_LEVELS[depth].eventTypes;
}

export function getTunerDigestFrequency(depth: GovernanceDepth): string {
  return TUNER_LEVELS[depth].digestFrequency;
}

/**
 * Default governance depth for a user segment.
 * citizen → informed, drep → deep, spo → engaged, cc → engaged, anonymous → informed.
 */
export function getDefaultDepthForSegment(segment: string): GovernanceDepth {
  switch (segment) {
    case 'drep':
      return 'deep';
    case 'spo':
    case 'cc':
      return 'engaged';
    case 'citizen':
    case 'anonymous':
    default:
      return 'informed';
  }
}

export function isValidDepth(value: string): value is GovernanceDepth {
  return GOVERNANCE_DEPTHS.includes(value as GovernanceDepth);
}
