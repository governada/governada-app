/**
 * GHI v2 Orchestrator — computes the Governance Health Index from 8 components.
 *
 * Replaces the old lib/ghi.ts computeGHI(). Re-exports types/constants for
 * backward compatibility so no consumer changes are needed.
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

import { GHI_COMPONENT_WEIGHTS } from '@/lib/scoring/calibration';

// ---------------------------------------------------------------------------
// Weight configuration
// ---------------------------------------------------------------------------

const BASE_WEIGHTS = GHI_COMPONENT_WEIGHTS;

type ComponentName = keyof typeof BASE_WEIGHTS;

/**
 * When Citizen Engagement is off, redistribute its 10% proportionally.
 */
function getWeights(citizenEngagementEnabled: boolean): Record<ComponentName, number> {
  if (citizenEngagementEnabled) {
    return { ...BASE_WEIGHTS };
  }

  const { 'Citizen Engagement': _, ...rest } = BASE_WEIGHTS;
  const totalRemaining = Object.values(rest).reduce((s, w) => s + w, 0);

  const redistributed: Record<string, number> = {};
  for (const [name, weight] of Object.entries(rest)) {
    redistributed[name] = weight / totalRemaining;
  }
  redistributed['Citizen Engagement'] = 0;

  return redistributed as Record<ComponentName, number>;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export interface GHIComputeResult extends GHIResult {
  edi?: EDIResult;
  meta?: {
    activeDrepCount?: number;
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
  const weights = getWeights(citizenEngagementEnabled);

  // Compute all components in parallel
  const [
    participation,
    spoParticipation,
    deliberation,
    effectiveness,
    ccFidelity,
    power,
    stability,
  ] = await Promise.all([
    computeDRepParticipation(input),
    computeSPOParticipation(input),
    computeDeliberationQuality(input),
    computeGovernanceEffectiveness(input),
    computeCCConstitutionalFidelity(input),
    computePowerDistribution(input),
    computeSystemStability(input),
  ]);

  // Citizen engagement: only compute if flag is on
  const engagement = citizenEngagementEnabled
    ? await computeCitizenEngagement({ ...input })
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
    },
  };
}
