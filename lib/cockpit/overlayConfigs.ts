/**
 * Overlay configurations — defines behavior for each of the 4 overlay tabs.
 *
 * Each overlay controls: globe node coloring, action rail filtering,
 * status strip metrics, and Seneca strip prompt context.
 */

import type { CockpitOverlay, OverlayConfig } from './types';

export const OVERLAY_CONFIGS: Record<CockpitOverlay, OverlayConfig> = {
  urgent: {
    label: 'Urgent',
    shortcutKey: '1',
    railFilter: ['urgent', 'high'],
    statusMetrics: [
      { label: 'Urgent', dataKey: 'urgentCount', colorClass: 'text-red-400' },
      { label: 'Temperature', dataKey: 'temperature', colorClass: 'text-amber-400' },
    ],
    senecaHint:
      'Focus on what needs immediate attention — expiring votes, delegation alerts, score changes.',
    icon: 'zap',
  },
  network: {
    label: 'Network',
    shortcutKey: '2',
    railFilter: null, // show all
    statusMetrics: [
      { label: 'Delegators', dataKey: 'delegatorCount', colorClass: 'text-compass-teal' },
      { label: 'Alignment', dataKey: 'alignmentHealth', colorClass: 'text-compass-violet' },
    ],
    senecaHint:
      'Focus on delegation relationships, alignment between governance bodies, and network dynamics.',
    icon: 'network',
  },
  proposals: {
    label: 'Proposals',
    shortcutKey: '3',
    railFilter: ['urgent', 'high', 'medium'],
    statusMetrics: [
      { label: 'Active', dataKey: 'activeProposals', colorClass: 'text-compass-teal' },
      { label: 'Expiring', dataKey: 'expiringCount', colorClass: 'text-amber-400' },
    ],
    senecaHint:
      'Focus on active governance proposals — their status, voting progress, and constitutional alignment.',
    icon: 'scroll-text',
  },
  ecosystem: {
    label: 'Ecosystem',
    shortcutKey: '4',
    railFilter: null, // show all
    statusMetrics: [
      { label: 'DReps', dataKey: 'activeDreps', colorClass: 'text-compass-teal' },
      { label: 'Health', dataKey: 'ghiScore', colorClass: 'text-emerald-400' },
    ],
    senecaHint:
      'Explore the full governance landscape — representatives, pools, committee members, and overall health.',
    icon: 'globe',
  },
};

/** Ordered array for rendering tabs */
export const OVERLAY_ORDER: CockpitOverlay[] = ['urgent', 'network', 'proposals', 'ecosystem'];

/** Map keyboard shortcut key to overlay */
export const SHORTCUT_TO_OVERLAY: Record<string, CockpitOverlay> = {
  '1': 'urgent',
  '2': 'network',
  '3': 'proposals',
  '4': 'ecosystem',
};
