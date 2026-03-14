/**
 * Alert System — creates typed notifications for governance events.
 *
 * Used by Inngest functions to wire real governance events into
 * the notification pipeline (inbox + channels).
 */

import {
  notifyUser,
  notifySegment,
  type SegmentQuery,
  type NotificationEvent,
  type EventType,
} from '@/lib/notifications';
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://governada.io';

export type AlertType =
  | 'drep_voted'
  | 'coverage_changed'
  | 'score_shifted'
  | 'milestone_earned'
  | 'epoch_summary'
  | 'engagement_outcome';

interface AlertConfig {
  eventType: EventType;
  title: string;
  body: string;
  url?: string;
}

const ALERT_BUILDERS: Record<AlertType, (data: Record<string, unknown>) => AlertConfig> = {
  drep_voted: (data) => ({
    eventType: 'drep-voted',
    title: `Your DRep voted ${data.vote as string} on a proposal`,
    body: (data.proposalTitle as string) || 'A governance proposal',
    url: data.proposalUrl as string | undefined,
  }),

  coverage_changed: (data) => {
    const delta = data.delta as number;
    const direction = delta > 0 ? 'increased' : 'decreased';
    return {
      eventType: 'drep-score-change',
      title: `Your DRep's coverage ${direction}`,
      body: `Participation rate is now ${data.newRate as number}%. ${delta > 0 ? 'Good governance in action.' : 'Your DRep may be less active.'}`,
      url: data.drepUrl as string | undefined,
    };
  },

  score_shifted: (data) => {
    const oldTier = data.oldTier as string;
    const newTier = data.newTier as string;
    return {
      eventType: 'tier-change',
      title: `Tier change: ${oldTier} → ${newTier}`,
      body: `Score is now ${data.newScore as number}/100.`,
      url: data.url as string | undefined,
    };
  },

  milestone_earned: (data) => ({
    eventType: 'citizen-level-up',
    title: `Achievement unlocked: ${data.label as string}`,
    body: (data.description as string) || 'You reached a new governance milestone.',
    url: `${BASE_URL}/you`,
  }),

  epoch_summary: (data) => ({
    eventType: 'governance-brief',
    title: `Epoch ${data.epoch as number} Summary`,
    body: `${data.proposalsDecided as number} proposals decided, ${data.drepVotes as number} DRep votes cast.`,
    url: `${BASE_URL}/`,
  }),

  engagement_outcome: (data) => {
    const outcome = data.outcome as string;
    const sentiment = data.sentiment as string;
    const sentimentLabel =
      sentiment === 'support' ? 'supported' : sentiment === 'oppose' ? 'opposed' : 'weighed in on';
    return {
      eventType: 'engagement-outcome',
      title: `Proposal you ${sentimentLabel} was ${outcome}`,
      body: (data.proposalTitle as string) || 'A governance proposal',
      url: data.proposalUrl as string | undefined,
    };
  },
};

/**
 * Create an alert notification for a specific user.
 * Persists to inbox and routes through enabled channels.
 */
export async function createAlert(
  userId: string,
  type: AlertType,
  data: Record<string, unknown>,
): Promise<void> {
  const builder = ALERT_BUILDERS[type];
  if (!builder) {
    logger.warn('[alerts] Unknown alert type', { type });
    return;
  }

  const config = builder(data);

  const event: NotificationEvent = {
    eventType: config.eventType,
    title: config.title,
    body: config.body,
    url: config.url,
    metadata: data,
  };

  await notifyUser(userId, event);
}

/**
 * Create an alert for all users delegated to a specific DRep.
 */
export async function createAlertForDelegators(
  drepId: string,
  type: AlertType,
  data: Record<string, unknown>,
): Promise<number> {
  const builder = ALERT_BUILDERS[type];
  if (!builder) {
    logger.warn('[alerts] Unknown alert type', { type });
    return 0;
  }

  const config = builder(data);
  const segment: SegmentQuery = { type: 'delegated-to', drepId };

  const event: NotificationEvent = {
    eventType: config.eventType,
    title: config.title,
    body: config.body,
    url: config.url,
    metadata: data,
  };

  return notifySegment(segment, event);
}
