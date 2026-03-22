/**
 * Scoring Calibration Analysis — read-only production data extraction.
 *
 * Extracts current score distributions for all DRep/SPO pillars and GHI
 * components, computes distribution statistics, and outputs JSON files
 * for review before making threshold changes.
 *
 * Run: npx tsx scripts/calibration-analysis.ts
 * Output: scripts/output/calibration-*.json
 */
import { config } from 'dotenv';
config({ path: require('path').resolve(process.cwd(), '.env.local') });

import * as fs from 'fs';
import * as path from 'path';
import { getSupabaseAdmin } from '../lib/supabase';
import {
  DREP_PILLAR_WEIGHTS,
  SPO_PILLAR_WEIGHTS,
  GHI_CALIBRATION,
  GHI_COMPONENT_WEIGHTS,
  TEMPORAL_DECAY,
  ENGAGEMENT_LAYER_WEIGHTS,
  DELIBERATION_WEIGHTS,
  RELIABILITY_WEIGHTS,
  IDENTITY_WEIGHTS,
  CLOSE_MARGIN,
  DISSENT_SUBSTANCE_MODIFIER,
  TIER_BOUNDARIES,
} from '../lib/scoring/calibration';
import { calibrate, type CalibrationCurve } from '../lib/ghi/calibration';

const OUTPUT_DIR = path.join(__dirname, 'output');

interface DistributionStats {
  count: number;
  mean: number;
  median: number;
  p10: number;
  p25: number;
  p75: number;
  p90: number;
  min: number;
  max: number;
  stdDev: number;
}

function computeStats(values: number[]): DistributionStats {
  if (values.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      p10: 0,
      p25: 0,
      p75: 0,
      p90: 0,
      min: 0,
      max: 0,
      stdDev: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;

  return {
    count: n,
    mean: round(mean),
    median: round(sorted[Math.floor(n / 2)]),
    p10: round(sorted[Math.floor(n * 0.1)]),
    p25: round(sorted[Math.floor(n * 0.25)]),
    p75: round(sorted[Math.floor(n * 0.75)]),
    p90: round(sorted[Math.floor(n * 0.9)]),
    min: round(sorted[0]),
    max: round(sorted[n - 1]),
    stdDev: round(Math.sqrt(variance)),
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function analyzeCalibrationCurve(rawValues: number[], curve: CalibrationCurve) {
  const calibrated = rawValues.map((v) => calibrate(v, curve));
  return {
    rawDistribution: computeStats(rawValues),
    calibratedDistribution: computeStats(calibrated),
    curve,
    analysis: {
      belowFloor: rawValues.filter((v) => v < curve.floor).length,
      belowFloorPct: round(
        (rawValues.filter((v) => v < curve.floor).length / rawValues.length) * 100,
      ),
      inFairRange: rawValues.filter((v) => v >= curve.floor && v < curve.targetLow).length,
      inGoodRange: rawValues.filter((v) => v >= curve.targetLow && v < curve.targetHigh).length,
      inStrongRange: rawValues.filter((v) => v >= curve.targetHigh && v <= curve.ceiling).length,
      aboveCeiling: rawValues.filter((v) => v > curve.ceiling).length,
      aboveCeilingPct: round(
        (rawValues.filter((v) => v > curve.ceiling).length / rawValues.length) * 100,
      ),
    },
  };
}

interface WeightScheme {
  name: string;
  weights: Record<string, number>;
}

function sensitivityAnalysis(
  drepScores: Map<string, Record<string, number>>,
  baseWeights: Record<string, number>,
): object {
  const pillarKeys = Object.keys(baseWeights);

  const schemes: WeightScheme[] = [
    { name: 'current', weights: { ...baseWeights } },
    {
      name: 'equal',
      weights: Object.fromEntries(pillarKeys.map((k) => [k, 1 / pillarKeys.length])),
    },
    {
      name: 'engagement-heavy',
      weights: {
        engagementQuality: 0.5,
        effectiveParticipation: 0.2,
        reliability: 0.2,
        governanceIdentity: 0.1,
      },
    },
    {
      name: 'reliability-heavy',
      weights: {
        engagementQuality: 0.25,
        effectiveParticipation: 0.25,
        reliability: 0.4,
        governanceIdentity: 0.1,
      },
    },
    {
      name: 'participation-heavy',
      weights: {
        engagementQuality: 0.2,
        effectiveParticipation: 0.45,
        reliability: 0.2,
        governanceIdentity: 0.15,
      },
    },
  ];

  // Compute rankings for each scheme
  const rankings = new Map<string, Map<string, number>>();
  for (const scheme of schemes) {
    const composites = new Map<string, number>();
    for (const [drepId, pillars] of drepScores) {
      let score = 0;
      for (const key of pillarKeys) {
        score += (pillars[key] ?? 0) * (scheme.weights[key] ?? 0);
      }
      composites.set(drepId, Math.round(score));
    }

    // Rank by composite score
    const sorted = [...composites.entries()].sort((a, b) => b[1] - a[1]);
    const rankMap = new Map<string, number>();
    sorted.forEach(([id], idx) => rankMap.set(id, idx + 1));
    rankings.set(scheme.name, rankMap);
  }

  // Find DReps with large rank changes
  const baseRanks = rankings.get('current')!;
  const volatileDreps: object[] = [];

  for (const [drepId, baseRank] of baseRanks) {
    const changes: Record<string, number> = {};
    let maxChange = 0;
    for (const scheme of schemes) {
      if (scheme.name === 'current') continue;
      const rank = rankings.get(scheme.name)!.get(drepId) ?? 0;
      const change = rank - baseRank;
      changes[scheme.name] = change;
      maxChange = Math.max(maxChange, Math.abs(change));
    }
    if (maxChange > 20) {
      volatileDreps.push({ drepId, baseRank, rankChanges: changes, maxAbsChange: maxChange });
    }
  }

  return {
    schemes: schemes.map((s) => ({ name: s.name, weights: s.weights })),
    volatileDreps: volatileDreps.sort(
      (a, b) =>
        (b as { maxAbsChange: number }).maxAbsChange - (a as { maxAbsChange: number }).maxAbsChange,
    ),
    totalDreps: drepScores.size,
    volatileCount: volatileDreps.length,
  };
}

async function main() {
  const supabase = getSupabaseAdmin();
  console.log('Connecting to Supabase...');

  // -------------------------------------------------------------------------
  // 1. DRep Score Distributions
  // -------------------------------------------------------------------------
  console.log('\n=== DRep Score Distributions ===');

  const { data: dreps } = await supabase
    .from('dreps')
    .select(
      'id, composite_score, engagement_quality, effective_participation, reliability, governance_identity, info',
    )
    .not('info->isActive', 'is', null);

  const activeDreps = (dreps ?? []).filter(
    (d) => (d.info as Record<string, unknown> | null)?.isActive,
  );
  console.log(`Active DReps: ${activeDreps.length}`);

  const drepPillarScores = new Map<string, Record<string, number>>();
  for (const d of activeDreps) {
    drepPillarScores.set(d.id, {
      engagementQuality: (d.engagement_quality as number) ?? 0,
      effectiveParticipation: (d.effective_participation as number) ?? 0,
      reliability: (d.reliability as number) ?? 0,
      governanceIdentity: (d.governance_identity as number) ?? 0,
    });
  }

  const drepDistributions = {
    composite: computeStats(activeDreps.map((d) => (d.composite_score as number) ?? 0)),
    engagementQuality: computeStats(activeDreps.map((d) => (d.engagement_quality as number) ?? 0)),
    effectiveParticipation: computeStats(
      activeDreps.map((d) => (d.effective_participation as number) ?? 0),
    ),
    reliability: computeStats(activeDreps.map((d) => (d.reliability as number) ?? 0)),
    governanceIdentity: computeStats(
      activeDreps.map((d) => (d.governance_identity as number) ?? 0),
    ),
  };

  // Tier distribution
  const tierDist: Record<string, number> = {};
  for (const tier of TIER_BOUNDARIES) {
    tierDist[tier.name] = activeDreps.filter((d) => {
      const s = (d.composite_score as number) ?? 0;
      return s >= tier.min && s <= tier.max;
    }).length;
  }

  const drepResult = {
    activeDrepCount: activeDreps.length,
    pillarWeights: DREP_PILLAR_WEIGHTS,
    distributions: drepDistributions,
    tierDistribution: tierDist,
    weightSensitivity: sensitivityAnalysis(drepPillarScores, { ...DREP_PILLAR_WEIGHTS }),
  };

  writeOutput('calibration-drep-scores.json', drepResult);

  // -------------------------------------------------------------------------
  // 2. SPO Score Distributions
  // -------------------------------------------------------------------------
  console.log('\n=== SPO Score Distributions ===');

  const { data: pools } = await supabase
    .from('pools')
    .select(
      'pool_id, governance_score, participation_score, deliberation_score, reliability_score, governance_identity_score, confidence_score',
    )
    .not('governance_score', 'is', null);

  const activePools = pools ?? [];
  console.log(`SPOs with scores: ${activePools.length}`);

  const spoResult = {
    poolCount: activePools.length,
    pillarWeights: SPO_PILLAR_WEIGHTS,
    distributions: {
      composite: computeStats(activePools.map((p) => (p.governance_score as number) ?? 0)),
      participation: computeStats(activePools.map((p) => (p.participation_score as number) ?? 0)),
      deliberation: computeStats(activePools.map((p) => (p.deliberation_score as number) ?? 0)),
      reliability: computeStats(activePools.map((p) => (p.reliability_score as number) ?? 0)),
      governanceIdentity: computeStats(
        activePools.map((p) => (p.governance_identity_score as number) ?? 0),
      ),
      confidence: computeStats(activePools.map((p) => (p.confidence_score as number) ?? 0)),
    },
  };

  writeOutput('calibration-spo-scores.json', spoResult);

  // -------------------------------------------------------------------------
  // 3. GHI Calibration Curve Analysis
  // -------------------------------------------------------------------------
  console.log('\n=== GHI Calibration Analysis ===');

  const { data: ghiSnaps } = await supabase
    .from('ghi_snapshots')
    .select('epoch_no, score, components')
    .order('epoch_no', { ascending: false })
    .limit(10);

  interface GHIComponentSnapshot {
    name: string;
    value: number;
    weight: number;
    detail?: Record<string, number>;
  }

  const ghiResult: Record<string, unknown> = {
    componentWeights: GHI_COMPONENT_WEIGHTS,
    calibrationCurves: GHI_CALIBRATION,
    recentSnapshots: (ghiSnaps ?? []).map((s) => ({
      epoch: s.epoch_no,
      score: s.score,
      components: s.components,
    })),
  };

  // If we have component-level data, analyze each curve
  if (ghiSnaps?.length) {
    const latestComps = ghiSnaps[0].components as GHIComponentSnapshot[] | null;
    if (Array.isArray(latestComps)) {
      console.log(`Latest GHI components: ${latestComps.length}`);
      for (const comp of latestComps) {
        console.log(`  ${comp.name}: ${comp.value} (weight: ${comp.weight})`);
      }
    }
  }

  // Analyze each calibration curve with available data
  const curveAnalysis: Record<string, unknown> = {};
  const componentMapping: [string, keyof typeof GHI_CALIBRATION][] = [
    ['DRep Participation', 'drepParticipation'],
    ['Citizen Engagement', 'citizenEngagement'],
    ['Deliberation Quality', 'deliberationQuality'],
    ['Governance Effectiveness', 'governanceEffectiveness'],
    ['Power Distribution', 'powerDistribution'],
    ['System Stability', 'systemStability'],
  ];

  // Use DRep participation rates as proxy for calibration analysis
  const participationRates = activeDreps
    .map((d) => (d.effective_participation as number) ?? 0)
    .filter((v) => v > 0);

  if (participationRates.length > 0) {
    curveAnalysis['drepParticipation'] = analyzeCalibrationCurve(
      participationRates,
      GHI_CALIBRATION.drepParticipation,
    );
  }

  ghiResult.curveAnalysis = curveAnalysis;
  ghiResult.componentMapping = componentMapping;

  writeOutput('calibration-ghi.json', ghiResult);

  // -------------------------------------------------------------------------
  // 4. Current Config Summary
  // -------------------------------------------------------------------------
  console.log('\n=== Config Summary ===');

  const configSummary = {
    timestamp: new Date().toISOString(),
    temporalDecay: TEMPORAL_DECAY,
    drepPillarWeights: DREP_PILLAR_WEIGHTS,
    spoPillarWeights: SPO_PILLAR_WEIGHTS,
    engagementLayers: ENGAGEMENT_LAYER_WEIGHTS,
    deliberationWeights: DELIBERATION_WEIGHTS,
    reliabilityWeights: RELIABILITY_WEIGHTS,
    identityWeights: IDENTITY_WEIGHTS,
    closeMargin: CLOSE_MARGIN,
    dissentSubstanceModifier: DISSENT_SUBSTANCE_MODIFIER,
    tierBoundaries: TIER_BOUNDARIES,
    ghiCalibration: GHI_CALIBRATION,
    ghiComponentWeights: GHI_COMPONENT_WEIGHTS,
  };

  writeOutput('calibration-config.json', configSummary);

  console.log('\n=== Done ===');
  console.log(`Output files written to ${OUTPUT_DIR}/`);
}

function writeOutput(filename: string, data: unknown) {
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`  -> ${filename}`);
}

main().catch(console.error);
