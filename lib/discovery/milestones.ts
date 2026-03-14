/**
 * Discovery milestones — lightweight client-side achievements
 * triggered as users explore the platform.
 *
 * These are lighter than CitizenMilestones (which are DB-persisted).
 * These are localStorage-only, fired once, and shown as small toasts.
 */

export interface DiscoveryMilestone {
  id: string;
  label: string;
  description: string;
  /** Lucide icon name */
  icon: string;
  /** Event name from the discovery event bus that triggers this milestone */
  triggerEvent: string;
}

export const DISCOVERY_MILESTONES: DiscoveryMilestone[] = [
  {
    id: 'first-proposal-view',
    label: 'Proposal Explorer',
    description: 'You viewed your first governance proposal',
    icon: 'FileText',
    triggerEvent: 'proposal_viewed',
  },
  {
    id: 'first-drep-view',
    label: 'Representative Researcher',
    description: 'You checked out a DRep profile',
    icon: 'Users',
    triggerEvent: 'drep_viewed',
  },
  {
    id: 'first-sentiment-vote',
    label: 'Voice Heard',
    description: 'You cast your first sentiment vote',
    icon: 'MessageCircle',
    triggerEvent: 'sentiment_voted',
  },
  {
    id: 'first-match-complete',
    label: 'Team Builder',
    description: 'You completed the governance matching quiz',
    icon: 'Compass',
    triggerEvent: 'match_completed',
  },
  {
    id: 'first-tour-completed',
    label: 'Guided Explorer',
    description: 'You completed your first guided tour',
    icon: 'Map',
    triggerEvent: 'tour_completed',
  },
  {
    id: 'three-sections-visited',
    label: 'Navigator',
    description: 'You have visited 3 different sections',
    icon: 'Navigation',
    triggerEvent: 'sections_3',
  },
];

/** Map from triggerEvent to milestone for fast lookup */
export const MILESTONE_BY_EVENT = new Map(DISCOVERY_MILESTONES.map((m) => [m.triggerEvent, m]));
