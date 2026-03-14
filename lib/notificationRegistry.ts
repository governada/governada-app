/**
 * Notification Event Registry — single source of truth for all event types.
 * Drives backend routing AND frontend preferences UI.
 *
 * To add a new notification:
 *   1. Add an EventDefinition entry here
 *   2. Write the trigger code (notifyUser/notifySegment/broadcastEvent)
 *   3. Optionally add a custom channel renderer in channelRenderers.ts
 *   That's it — preferences UI auto-renders, routing works automatically.
 */

export type Channel = 'push' | 'email' | 'discord' | 'telegram';
export type EventCategory = 'drep' | 'holder' | 'ecosystem' | 'digest' | 'spo' | 'citizen';
export type Urgency = 'realtime' | 'batched' | 'scheduled';
export type Audience = 'drep' | 'holder' | 'all' | 'spo' | 'citizen';

export interface EventDefinition {
  key: string;
  category: EventCategory;
  audience: Audience;
  urgency: Urgency;
  label: string;
  description: string;
  defaultChannels: Channel[];
  channels: Channel[];
}

export const EVENT_REGISTRY: EventDefinition[] = [
  // ── DRep Notifications ────────────────────────────────────────────────────
  {
    key: 'score-change',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Score Changes',
    description: 'When your Governada Score changes by 3+ points',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'delegation-change',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Delegation Changes',
    description: 'When you gain or lose delegators',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'delegator-growth',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Delegator Growth',
    description: 'Positive delegator milestones',
    defaultChannels: ['push'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'rank-change',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Rank Changes',
    description: 'When your ranking among DReps changes',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'pending-proposals',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Pending Proposals',
    description: 'Open proposals awaiting your vote',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'urgent-deadline',
    category: 'drep',
    audience: 'drep',
    urgency: 'realtime',
    label: 'Urgent Deadlines',
    description: 'Proposals expiring within 2 epochs',
    defaultChannels: ['push', 'email', 'discord', 'telegram'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'proposal-deadline',
    category: 'drep',
    audience: 'drep',
    urgency: 'realtime',
    label: 'Proposal Deadlines',
    description: 'Per-proposal voting deadline reminders',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'score-opportunity',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Score Opportunities',
    description: "When you're close to the top 10",
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'near-milestone',
    category: 'drep',
    audience: 'drep',
    urgency: 'realtime',
    label: 'Milestones & Achievements',
    description: 'When you unlock a new achievement',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'rationale-reminder',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Rationale Reminders',
    description: "When you voted but haven't provided rationale yet",
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'delegator-sentiment-diverge',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Delegator Sentiment Divergence',
    description: 'When your delegators disagree with your votes',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'competitive-threat',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Competitive Threats',
    description: 'When a nearby DRep is closing the gap',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'accountability-result',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Accountability Results',
    description: 'When a proposal you approved gets rated',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'profile-view-spike',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Profile View Spikes',
    description: "When there's unusual traffic to your profile",
    defaultChannels: ['push'],
    channels: ['push', 'email'],
  },

  // ── Holder Notifications ──────────────────────────────────────────────────
  {
    key: 'drep-voted',
    category: 'holder',
    audience: 'holder',
    urgency: 'batched',
    label: 'DRep Voted',
    description: 'When your DRep votes on a proposal',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'drep-score-change',
    category: 'holder',
    audience: 'holder',
    urgency: 'batched',
    label: 'DRep Score Change',
    description: "When your DRep's score changes significantly",
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'drep-missed-vote',
    category: 'holder',
    audience: 'holder',
    urgency: 'realtime',
    label: 'DRep Missed Vote',
    description: 'When your DRep misses an expiring proposal',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'drep-inactive',
    category: 'holder',
    audience: 'holder',
    urgency: 'realtime',
    label: 'DRep Inactive',
    description: 'When your DRep becomes inactive',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'representation-drop',
    category: 'holder',
    audience: 'holder',
    urgency: 'batched',
    label: 'Representation Drop',
    description: 'When your representation score drops below threshold',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'better-match-found',
    category: 'holder',
    audience: 'holder',
    urgency: 'batched',
    label: 'Better Match Found',
    description: 'When a DRep with higher match rate is discovered',
    defaultChannels: ['email'],
    channels: ['push', 'email'],
  },
  {
    key: 'citizen-level-up',
    category: 'holder',
    audience: 'holder',
    urgency: 'realtime',
    label: 'Governance Level Up',
    description: 'When your governance citizenship level increases',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'delegation-anniversary',
    category: 'holder',
    audience: 'holder',
    urgency: 'scheduled',
    label: 'Delegation Anniversaries',
    description: 'Milestone durations with your DRep',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email'],
  },
  {
    key: 'poll-deadline',
    category: 'holder',
    audience: 'holder',
    urgency: 'realtime',
    label: 'Poll Deadlines',
    description: "Proposals expiring that you haven't polled on",
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'watchlist-alert',
    category: 'holder',
    audience: 'holder',
    urgency: 'batched',
    label: 'Watchlist Alerts',
    description: 'When a watched DRep has a significant event',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },

  // ── Ecosystem / Broadcast ─────────────────────────────────────────────────
  {
    key: 'critical-proposal-open',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'realtime',
    label: 'Critical Proposals',
    description: 'When a new critical governance proposal opens',
    defaultChannels: ['push', 'email', 'discord', 'telegram'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'treasury-health-alert',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'realtime',
    label: 'Treasury Health Alerts',
    description: 'When treasury balance drops significantly',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'treasury-proposal-new',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'realtime',
    label: 'Treasury Proposals',
    description: 'When a new significant treasury proposal is submitted',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'treasury-accountability-open',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'batched',
    label: 'Accountability Polls',
    description: 'When a treasury accountability poll opens',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },
  {
    key: 'governance-pattern-alert',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'batched',
    label: 'Governance Patterns',
    description: 'When a novel governance pattern is detected',
    defaultChannels: ['email'],
    channels: ['push', 'email'],
  },
  {
    key: 'platform-announcement',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'scheduled',
    label: 'Platform Announcements',
    description: 'Product updates and maintenance notices',
    defaultChannels: ['email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },

  // ── Engagement Outcomes ──────────────────────────────────────────────────
  {
    key: 'engagement-outcome',
    category: 'citizen',
    audience: 'holder',
    urgency: 'batched',
    label: 'Proposal Outcome Follow-ups',
    description: 'When a proposal you voted on reaches a decision',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },

  // ── Digest ────────────────────────────────────────────────────────────────
  {
    key: 'governance-brief',
    category: 'digest',
    audience: 'all',
    urgency: 'scheduled',
    label: 'Weekly Governance Brief',
    description: 'AI-personalized weekly summary of your governance activity',
    defaultChannels: ['email', 'push'],
    channels: ['email', 'push', 'telegram'],
  },

  // ── Tier Notifications (Phase A) ────────────────────────────────────────────
  {
    key: 'tier-change',
    category: 'drep',
    audience: 'all',
    urgency: 'realtime',
    label: 'Tier Changes',
    description: 'When your governance tier changes (e.g., Silver → Gold)',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },

  // ── SPO Notifications (Phase A) ───────────────────────────────────────────
  {
    key: 'spo-tier-change',
    category: 'spo',
    audience: 'spo',
    urgency: 'realtime',
    label: 'SPO Tier Changes',
    description: 'When your pool governance tier changes',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord'],
  },
  {
    key: 'spo-inactivity',
    category: 'citizen',
    audience: 'holder',
    urgency: 'batched',
    label: 'Pool Governance Inactivity',
    description: 'When your staked pool goes inactive in governance',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email'],
  },
  {
    key: 'competitive-movement',
    category: 'spo',
    audience: 'spo',
    urgency: 'batched',
    label: 'Competitive Movement',
    description: 'When a nearby pool passes you in governance score',
    defaultChannels: ['push'],
    channels: ['push', 'email', 'discord'],
  },
  {
    key: 'delegation-milestone',
    category: 'drep',
    audience: 'all',
    urgency: 'realtime',
    label: 'Delegation Milestones',
    description: 'When you reach delegation count milestones (100, 500, 1000)',
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email', 'discord', 'telegram'],
  },

  // ── Alignment Drift (Phase A) ─────────────────────────────────────────────
  {
    key: 'alignment-drift',
    category: 'citizen',
    audience: 'holder',
    urgency: 'batched',
    label: 'Alignment Drift',
    description: "When your DRep's voting alignment drifts from your values",
    defaultChannels: ['push', 'email'],
    channels: ['push', 'email'],
  },

  // ── System (not user-visible in preferences) ──────────────────────────────
  {
    key: 'profile-view',
    category: 'drep',
    audience: 'drep',
    urgency: 'batched',
    label: 'Profile Views',
    description: 'Profile view notifications',
    defaultChannels: [],
    channels: ['push'],
  },
  {
    key: 'api-health-alert',
    category: 'ecosystem',
    audience: 'all',
    urgency: 'realtime',
    label: 'API Health',
    description: 'System health alerts',
    defaultChannels: ['discord'],
    channels: ['discord'],
  },
];

// ── Registry Lookup Helpers ───────────────────────────────────────────────────

export function getEventDefinition(key: string): EventDefinition | undefined {
  return EVENT_REGISTRY.find((e) => e.key === key);
}

export function getEventsForAudience(audience: Audience): EventDefinition[] {
  return EVENT_REGISTRY.filter((e) => e.audience === audience || e.audience === 'all');
}

export function getEventsByCategory(category: EventCategory): EventDefinition[] {
  return EVENT_REGISTRY.filter((e) => e.category === category);
}

/** Events suitable for user-facing preferences UI (excludes system-only events) */
export function getUserFacingEvents(isDRep: boolean): EventDefinition[] {
  return EVENT_REGISTRY.filter((e) => {
    if (e.key === 'profile-view' || e.key === 'api-health-alert') return false;
    if (e.audience === 'drep' && !isDRep) return false;
    return true;
  });
}

/** All valid event keys for type checking */
export type EventKey = (typeof EVENT_REGISTRY)[number]['key'];

/** Get the urgency color class for Discord embeds */
export function getEventColor(key: string): number {
  const def = getEventDefinition(key);
  if (!def) return 0x3b82f6;
  switch (def.urgency) {
    case 'realtime':
      return 0xff4444;
    case 'batched':
      return 0x22c55e;
    case 'scheduled':
      return 0x3b82f6;
  }
}
