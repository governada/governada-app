/**
 * Focus Composer — Composable focus layers for simultaneous visual modes.
 *
 * Currently the system supports one FocusIntent at a time. This module
 * enables composing multiple layers (vote split + cluster highlight +
 * considering pulse) by merging them into a single intent.
 *
 * Migration: setSharedIntent(intent) continues to work as shorthand
 * for setSharedIntentLayer('default', intent) with priority 0.
 */

import type { FocusIntent } from './types';

export interface FocusLayer {
  /** Unique layer ID (e.g., 'primary', 'voteSplit', 'considering') */
  id: string;
  /** Higher priority wins conflicts (default layer = 0) */
  priority: number;
  /** The intent for this layer */
  intent: FocusIntent;
}

/**
 * Compose multiple focus layers into a single merged FocusIntent.
 *
 * Merge rules:
 * - focusedIds: union of all layers
 * - intensities: max per node across layers
 * - colorOverrides: highest-priority layer wins per node
 * - pulsingNodeIds: union across layers
 * - haloRadii: max per node across layers
 * - highlightedRegions: concat all
 * - Camera hints: highest-priority layer with camera hints wins
 * - Visual params (focusColor, atmosphere, etc.): highest-priority layer wins
 */
export function composeFocusLayers(layers: FocusLayer[]): FocusIntent {
  if (layers.length === 0) return { focusedIds: null };
  if (layers.length === 1) return layers[0].intent;

  // Sort by priority (highest first)
  const sorted = [...layers].sort((a, b) => b.priority - a.priority);
  const primary = sorted[0].intent;

  // Start with highest-priority layer as base
  const mergedFocusedIds = new Set<string>();
  const mergedIntensities = new Map<string, number>();
  const mergedColorOverrides = new Map<string, string>();
  const mergedPulsingNodeIds = new Set<string>();
  const mergedHaloRadii = new Map<string, number>();
  const mergedHighlightedRegions: string[] = [];

  for (const layer of sorted) {
    const intent = layer.intent;

    // Merge focusedIds (union)
    if (intent.focusedIds instanceof Set) {
      for (const id of intent.focusedIds) {
        mergedFocusedIds.add(id);
      }
    }

    // Merge intensities (max per node)
    if (intent.intensities) {
      for (const [id, intensity] of intent.intensities) {
        const existing = mergedIntensities.get(id) ?? 0;
        mergedIntensities.set(id, Math.max(existing, intensity));
      }
    }

    // Merge colorOverrides (higher priority wins per node — already sorted)
    if (intent.colorOverrides) {
      for (const [id, color] of intent.colorOverrides) {
        if (!mergedColorOverrides.has(id)) {
          mergedColorOverrides.set(id, color);
        }
      }
    }

    // Merge pulsingNodeIds (union)
    if (intent.pulsingNodeIds) {
      for (const id of intent.pulsingNodeIds) {
        mergedPulsingNodeIds.add(id);
      }
    }

    // Merge haloRadii (max per node)
    if (intent.haloRadii) {
      for (const [id, radius] of intent.haloRadii) {
        const existing = mergedHaloRadii.get(id) ?? 0;
        mergedHaloRadii.set(id, Math.max(existing, radius));
      }
    }

    // Merge highlightedRegions (concat)
    if (intent.highlightedRegions) {
      mergedHighlightedRegions.push(...intent.highlightedRegions);
    }
  }

  return {
    // Merged fields
    focusedIds: mergedFocusedIds.size > 0 ? mergedFocusedIds : primary.focusedIds,
    intensities: mergedIntensities.size > 0 ? mergedIntensities : primary.intensities,
    colorOverrides: mergedColorOverrides.size > 0 ? mergedColorOverrides : primary.colorOverrides,
    pulsingNodeIds: mergedPulsingNodeIds.size > 0 ? mergedPulsingNodeIds : undefined,
    haloRadii: mergedHaloRadii.size > 0 ? mergedHaloRadii : undefined,
    highlightedRegions: mergedHighlightedRegions.length > 0 ? mergedHighlightedRegions : undefined,

    // Single-value fields from highest priority
    dimStrength: primary.dimStrength,
    nodeTypeFilter: primary.nodeTypeFilter,
    intermediateIds: primary.intermediateIds,
    userNode: primary.userNode,
    cameraProximity: primary.cameraProximity,
    flyToFocus: primary.flyToFocus,
    approachAngle: primary.approachAngle,
    scanProgress: primary.scanProgress,
    activationDelays: primary.activationDelays,
    orbitSpeedOverride: primary.orbitSpeedOverride,
    forceActive: sorted.some((l) => l.intent.forceActive),

    // Visual params from highest priority
    focusColor: primary.focusColor,
    focusSizeBoost: primary.focusSizeBoost,
    unfocusedScale: primary.unfocusedScale,
    emissiveRange: primary.emissiveRange,
    atmosphereWarmColor: primary.atmosphereWarmColor,
    atmosphereTemperature: primary.atmosphereTemperature,
    bloomIntensity: primary.bloomIntensity,
    driftEnabled: sorted.some((l) => l.intent.driftEnabled),
    easingCurve: primary.easingCurve,
    transitionDuration: primary.transitionDuration,
    pulseFrequency: primary.pulseFrequency,
    activationDirection: primary.activationDirection,
    activationSourceNode: primary.activationSourceNode,
    convergenceTarget: primary.convergenceTarget,
  };
}
