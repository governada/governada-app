/**
 * Cockpit types — shared across all HUD components, stores, and hooks.
 */

import type { ActionItem, ActionPriority } from '@/lib/actionQueue';

// ---------------------------------------------------------------------------
// Overlay system
// ---------------------------------------------------------------------------

export type CockpitOverlay = 'urgent' | 'network' | 'proposals' | 'ecosystem';

/** Configuration for each overlay mode — drives globe coloring, rail filtering, status metrics, and Seneca strip */
export interface OverlayConfig {
  label: string;
  /** Keyboard shortcut key (1-4) */
  shortcutKey: string;
  /** Which action priorities to show in the rail (null = show all) */
  railFilter: ActionPriority[] | null;
  /** Status strip metrics to display */
  statusMetrics: OverlayMetric[];
  /** Seneca strip prompt hint for this overlay context */
  senecaHint: string;
  /** Icon name for the tab */
  icon: string;
}

export interface OverlayMetric {
  label: string;
  /** Key to look up in governance state data */
  dataKey: string;
  /** Color class for the metric value */
  colorClass: string;
}

// ---------------------------------------------------------------------------
// Action rail
// ---------------------------------------------------------------------------

/** Extended action item with globe node mapping */
export interface ActionRailItem extends ActionItem {
  /** The constellation node ID this action relates to (for globe panning) */
  globeNodeId?: string;
  /** Action button label */
  actionLabel: string;
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

export type BootPhase = 'pending' | 'cascade' | 'ready';

export interface BootSequenceStep {
  /** Component identifier */
  component: 'globe' | 'status-strip' | 'seneca-strip' | 'action-rail' | 'overlay-tabs';
  /** Delay from boot start in ms */
  delay: number;
  /** Duration of entrance animation in ms */
  duration: number;
}

export const BOOT_SEQUENCE: BootSequenceStep[] = [
  { component: 'globe', delay: 0, duration: 500 },
  { component: 'status-strip', delay: 500, duration: 400 },
  { component: 'seneca-strip', delay: 1000, duration: 400 },
  { component: 'action-rail', delay: 1500, duration: 600 },
  { component: 'overlay-tabs', delay: 2000, duration: 400 },
];

export const BOOT_TOTAL_MS = 2500;

// ---------------------------------------------------------------------------
// Density / contextual breathing
// ---------------------------------------------------------------------------

export type DensityLevel = 'calm' | 'normal' | 'heated';

/** Thresholds for density level based on governance activity */
export function computeDensityLevel(urgentCount: number, temperature: number): DensityLevel {
  if (urgentCount >= 5 || temperature >= 80) return 'heated';
  if (urgentCount >= 2 || temperature >= 50) return 'normal';
  return 'calm';
}

// ---------------------------------------------------------------------------
// Node enrichment (for globe visual encoding)
// ---------------------------------------------------------------------------

export interface NodeEnrichment {
  urgency: number; // 0-1, drives pulse rate and emissive
  isActionable: boolean;
}
