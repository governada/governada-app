/**
 * GHI v2 Orchestrator — computes the Governance Health Index from up to 10 components.
 *
 * Re-exports types/constants for backward compatibility so no consumer changes are needed.
 */

import { createClient } from '@/lib/supabase';
import { getFeatureFlag } from '@/lib/featureFlags';
import { calibrate, CALIBRATION } from './calibration';
import {
  computeDRepParticipation,
  computeSPOParticipation,
  computeCitizenEngagement,
  computeDeliberationQuality,
  computeGovernanceEffectiveness,
  computeCCConstitutionalFidelity,
  computePowerDistribution,
  computeSystemStability,
  computeTreasuryHealth,
  computeGovernanceOutcomes,
  type ComponentInput,
} from './components';
import type { EDIResult } from './ediMetrics';

// Re-export band types/constants from the original module for backward compatibility
export {
  type GHIBand,
  type GHIComponent,
  type GHIResult,
  GHI_BAND_COLORS,
  GHI_BAND_LABELS,
  getBand,
} from './types';
import type { GHIComponent, GHIResult } from './types';
import { getBand } from './types';

import { GHI_COMPONENT_WEIGHTS, CALIBRATION_VERSION } from '@/lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

const BASE_WEIGHTS = GHI_COMPONENT_WEIGHTS;

type ComponentName = keyof typeof BASE_WEIGHTS;

/** Names of components controlled by feature flags. */
const FLAGGED_COMPONENTS: readonly ComponentName[] = [
  'Citizen Engagement',
  'Governance Outcomes',
] as const;

/**
 * Compute effective GHI component weights.
 *
 * When flagged components are disabled, their weights are redistributed
 * proportionally across the remaining enabled components so the total
 * always sums to 1.0.
 *
 * This redistribution is proportional (each component keeps its relative share),
 * not arbitrary. The GHI API response includes actual weights used so consumers
 * can verify what model is active.
 */
function getWeights(enabledFlags: Record<string, boolean>): Record<ComponentName, number> {
  const disabled = FLAGGED_COMPONENTS.filter((name) => !enabledFlags[name]);
  if (disabled.length === 0) return { ...BASE_WEIGHTS };

  const disabledSet = new Set(disabled);
  const enabledEntries = Object.entries(BASE_WEIGHTS).filter(
    ([name]) => !disabledSet.has(name as ComponentName),
  );
  const totalRemaining = enabledEntries.reduce((s, [, w]) => s + w, 0);

  const redistributed: Record<string, number> = {};
  for (const [name, weight] of enabledEntries) {
    redistributed[name] = weight / totalRemaining;
  }
  for (const name of disabled) {
    redistributed[name] = 0;
  }

  return redistributed as Record<ComponentName, number>;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export interface GHIComputeResult extends GHIResult {
  edi?: EDIResult;
  meta?: {
    activeDrepCount?: number;
    /** Calibration version used for this computation */
    calibrationVersion?: string;
    /** Whether Citizen Engagement component is active */
    citizenEngagementEnabled?: boolean;
    /** Whether Governance Outcomes component is active */
    governanceOutcomesEnabled?: boolean;
  };
}

export async function computeGHI(): Promise<GHIComputeResult> {
  const supabase = createClient();

  // Get current epoch
  const { data: stats } = await supabase
    .from('governance_stats')
    .select('current_epoch')
    .eq('id', 1)
    .single();
  const currentEpoch = stats?.current_epoch ?? 0;

  const input: ComponentInput = { supabase, currentEpoch };

  const citizenEngagementEnabled = await getFeatureFlag('ghi_citizen_engagement', false);
  const governanceOutcomesEnabled = await getFeatureFlag('ghi_governance_outcomes', false);

  const enabledFlags: Record<string, boolean> = {
    'Citizen Engagement': citizenEngagementEnabled,
    'Governance Outcomes': governanceOutcomesEnabled,
  };
  const weights = getWeights(enabledFlags);

  // Compute all always-on components in parallel
  const [
    participation,
    spoParticipation,
    deliberation,
    effectiveness,
    ccFidelity,
    power,
    stability,
    treasuryHealth,
  ] = await Promise.all([
    computeDRepParticipation(input),
    computeSPOParticipation(input),
    computeDeliberationQuality(input),
    computeGovernanceEffectiveness(input),
    computeCCConstitutionalFidelity(input),
    computePowerDistribution(input),
    computeSystemStability(input),
    computeTreasuryHealth(input),
  ]);

  // Flagged components: only compute if enabled
  const engagement = citizenEngagementEnabled
    ? await computeCitizenEngagement({ ...input })
    : { raw: 0, detail: { skipped: true } };

  const outcomes = governanceOutcomesEnabled
    ? await computeGovernanceOutcomes(input)
    : { raw: 0, detail: { skipped: true } };

  // Apply calibration curves
  const calibrated = {
    'DRep Participation': calibrate(participation.raw, CALIBRATION.drepParticipation),
    'SPO Participation': calibrate(spoParticipation.raw, CALIBRATION.spoParticipation),
    'Citizen Engagement': citizenEngagementEnabled
      ? calibrate(engagement.raw, CALIBRATION.citizenEngagement)
      : 0,
    'Deliberation Quality': calibrate(deliberation.raw, CALIBRATION.deliberationQuality),
    'Governance Effectiveness': calibrate(effectiveness.raw, CALIBRATION.governanceEffectiveness),
    'CC Constitutional Fidelity': calibrate(ccFidelity.raw, CALIBRATION.ccConstitutionalFidelity),
    'Power Distribution': calibrate(power.raw, CALIBRATION.powerDistribution),
    'System Stability': calibrate(stability.raw, CALIBRATION.systemStability),
    'Treasury Health': calibrate(treasuryHealth.raw, CALIBRATION.treasuryHealth),
    'Governance Outcomes': governanceOutcomesEnabled
      ? calibrate(outcomes.raw, CALIBRATION.governanceOutcomes)
      : 0,
  };

  const components: GHIComponent[] = Object.entries(calibrated).map(([name, value]) => {
    const weight = weights[name as ComponentName];
    return {
      name,
      value: Math.round(value),
      weight,
      contribution: Math.round(value * weight),
    };
  });

  const score = Math.min(
    100,
    Math.max(
      0,
      components.reduce((s, c) => s + c.contribution, 0),
    ),
  );

  return {
    score,
    band: getBand(score),
    components,
    edi: power.edi,
    meta: {
      activeDrepCount: power.detail?.activeDrepCount,
      calibrationVersion: CALIBRATION_VERSION.version,
      citizenEngagementEnabled,
      governanceOutcomesEnabled,
    },
  };
}
