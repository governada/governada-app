/**
 * Governance Tuner — maps user intent ("how closely do I follow governance?")
 * to concrete notification/digest configuration.
 *
 * Three depth levels:
 * - hands_off: "Alert me only if something is wrong" (~2 events)
 * - informed: "Keep me posted on major events" (~5 events, default for citizens)
 * - engaged: "Full visibility into governance. All events, all tools, maximum detail." (all events, default for DReps/SPOs/CC)
 */

import { EVENT_REGISTRY } from './notificationRegistry';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GovernanceDepth = 'hands_off' | 'informed' | 'engaged';

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

export const GOVERNANCE_DEPTHS: GovernanceDepth[] = ['hands_off', 'informed', 'engaged'];

/** Most critical "something is wrong" alerts — delegation health, governance crisis. */
const HANDS_OFF_EVENTS: string[] = [
  'drep-inactive',
  'treasury-health-alert',
  'epoch-summary-light',
];

/** Major governance updates — new proposals, DRep score changes, epoch summaries. */
const INFORMED_EVENTS: string[] = [
  ...HANDS_OFF_EVENTS,
  'critical-proposal-open',
  'drep-score-change',
  'governance-brief',
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
    description: "A quick health check. We'll surface only what needs your attention.",
    shortDescription: 'Peace of mind',
    iconName: 'BellOff',
    eventTypes: HANDS_OFF_EVENTS,
    digestFrequency: 'none',
    order: 0,
  },
  informed: {
    key: 'informed',
    label: 'Informed',
    description: 'A regular briefing on what matters. The essentials, clearly presented.',
    shortDescription: 'The essentials',
    iconName: 'Bell',
    eventTypes: INFORMED_EVENTS,
    digestFrequency: 'weekly',
    order: 1,
  },
  engaged: {
    key: 'engaged',
    label: 'Engaged',
    description: 'Full visibility into governance. All events, all tools, maximum detail.',
    shortDescription: 'Full command',
    iconName: 'BellRing',
    eventTypes: getAllUserFacingEventKeys(),
    digestFrequency: 'epoch',
    order: 2,
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
 * drep/spo/cc → engaged, citizen → informed, anonymous → hands_off.
 */
export function getDefaultDepthForSegment(segment: string): GovernanceDepth {
  switch (segment) {
    case 'drep':
    case 'spo':
    case 'cc':
      return 'engaged';
    case 'citizen':
      return 'informed';
    case 'anonymous':
    default:
      return 'hands_off';
  }
}

export function isValidDepth(value: string): value is GovernanceDepth {
  return GOVERNANCE_DEPTHS.includes(value as GovernanceDepth);
}
