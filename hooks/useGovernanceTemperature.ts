'use client';

/**
 * useGovernanceTemperature — Maps governance temperature score to a CSS color
 * for the ambient governance tint on the constellation globe.
 *
 * Temperature ranges:
 * - Cool blue   (<30):  Quiet governance period. Calm, serene.
 * - Neutral     (30-60): Normal activity. Default appearance.
 * - Warm amber  (60-80): Active governance. Increased proposal volume.
 * - Urgent red  (>80):  Intense governance moment. Contested votes.
 *
 * Returns a CSS color value for the `--governance-tint` custom property,
 * applied as a subtle (10-15% opacity) overlay on the constellation container.
 *
 * TODO: Wire to governance temperature API when Phase 4 ships.
 *       Currently defaults to 'neutral' (temperature 50).
 */

export interface GovernanceTemperatureResult {
  /** Governance temperature score (0-100) */
  temperature: number;
  /** CSS color for the governance tint overlay */
  tintColor: string;
  /** Human-readable label for the current state */
  label: 'cool' | 'neutral' | 'warm' | 'urgent';
}

/**
 * Map temperature score to a CSS color and label.
 */
function temperatureToTint(temperature: number): {
  color: string;
  label: GovernanceTemperatureResult['label'];
} {
  if (temperature > 80) {
    // Urgent red — intense governance moment
    return { color: 'rgba(239, 68, 68, 0.12)', label: 'urgent' };
  }
  if (temperature > 60) {
    // Warm amber — active governance
    return { color: 'rgba(245, 158, 11, 0.10)', label: 'warm' };
  }
  if (temperature >= 30) {
    // Neutral — normal activity, transparent (no tint)
    return { color: 'rgba(148, 163, 184, 0.05)', label: 'neutral' };
  }
  // Cool blue — quiet governance period
  return { color: 'rgba(56, 189, 248, 0.10)', label: 'cool' };
}

/**
 * Returns the governance temperature color for ambient tinting.
 *
 * Currently returns a static 'neutral' state. Will be wired to the
 * governance temperature API when Phase 4 ships.
 */
export function useGovernanceTemperature(): GovernanceTemperatureResult {
  // TODO: Wire to governance temperature API when Phase 4 ships.
  // Default to neutral (temperature 50).
  const temperature = 50;
  const { color, label } = temperatureToTint(temperature);

  return {
    temperature,
    tintColor: color,
    label,
  };
}
