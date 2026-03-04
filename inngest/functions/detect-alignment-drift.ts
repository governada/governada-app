/**
 * Alignment Drift Detection — Inngest function.
 * Triggers after DRep score sync or alignment sync completes.
 * For each user with a delegation, compares their governance profile
 * against their delegated DRep's alignment and records drift.
 */

import { inngest } from '@/lib/inngest';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  computeAlignmentDrift,
  type Alignment6D,
  ALIGNMENT_DIMENSIONS,
} from '@/lib/alignment/drift';
import { getFeatureFlag } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';

function alignmentDistance(a: Alignment6D, b: Alignment6D): number {
  let sum = 0;
  for (const dim of ALIGNMENT_DIMENSIONS) {
    const diff = (a[dim] ?? 50) - (b[dim] ?? 50);
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function distanceToMatchScore(distance: number): number {
  const maxDist = 245; // sqrt(6 * 100^2)
  return Math.max(0, Math.round((1 - distance / maxDist) * 100));
}

export const detectAlignmentDrift = inngest.createFunction(
  {
    id: 'detect-alignment-drift',
    retries: 2,
    concurrency: { limit: 1, scope: 'env', key: '"alignment-drift"' },
  },
  [{ event: 'drepscore/sync.scores.complete' }, { event: 'drepscore/sync.alignment.complete' }],
  async ({ step }) => {
    const enabled = await step.run('check-flag', async () => {
      return getFeatureFlag('alignment_drift', false);
    });

    if (!enabled) return { skipped: true, reason: 'feature flag disabled' };

    const result = await step.run('compute-drift', async () => {
      const supabase = getSupabaseAdmin();

      const { data: users } = await supabase
        .from('users')
        .select('wallet_address, claimed_drep_id')
        .not('claimed_drep_id', 'is', null);

      if (!users?.length) return { processed: 0, driftsDetected: 0 };

      const { data: profiles } = await supabase
        .from('user_governance_profiles')
        .select('wallet_address, alignment_scores')
        .in(
          'wallet_address',
          users.map((u) => u.wallet_address),
        );

      if (!profiles?.length) return { processed: 0, driftsDetected: 0 };

      const profileMap = new Map<string, Record<string, number>>();
      for (const p of profiles) {
        if (p.alignment_scores && typeof p.alignment_scores === 'object') {
          profileMap.set(p.wallet_address, p.alignment_scores as Record<string, number>);
        }
      }

      const drepIds = [
        ...new Set(users.filter((u) => u.claimed_drep_id).map((u) => u.claimed_drep_id!)),
      ];

      const { data: dreps } = await supabase
        .from('dreps')
        .select(
          'id, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .in('id', drepIds);

      const drepAlignmentMap = new Map<string, Alignment6D>();
      for (const d of dreps || []) {
        const align: Alignment6D = {
          treasury_conservative: d.alignment_treasury_conservative ?? 50,
          treasury_growth: d.alignment_treasury_growth ?? 50,
          decentralization: d.alignment_decentralization ?? 50,
          security: d.alignment_security ?? 50,
          innovation: d.alignment_innovation ?? 50,
          transparency: d.alignment_transparency ?? 50,
        };
        drepAlignmentMap.set(d.id, align);
      }

      const { data: statsRow } = await supabase
        .from('governance_stats')
        .select('current_epoch')
        .eq('id', 1)
        .single();
      const currentEpoch = statsRow?.current_epoch ?? null;

      // Load all active DReps with alignments for alternative matching
      const { data: allDreps } = await supabase
        .from('dreps')
        .select(
          'id, score, alignment_treasury_conservative, alignment_treasury_growth, alignment_decentralization, alignment_security, alignment_innovation, alignment_transparency',
        )
        .not('alignment_treasury_conservative', 'is', null)
        .gt('score', 0);

      const allDrepAlignments = (allDreps || []).map((d) => ({
        id: d.id as string,
        score: (d.score ?? 0) as number,
        alignment: {
          treasury_conservative: d.alignment_treasury_conservative ?? 50,
          treasury_growth: d.alignment_treasury_growth ?? 50,
          decentralization: d.alignment_decentralization ?? 50,
          security: d.alignment_security ?? 50,
          innovation: d.alignment_innovation ?? 50,
          transparency: d.alignment_transparency ?? 50,
        } as Alignment6D,
      }));

      let driftsDetected = 0;
      const driftRecords: Record<string, unknown>[] = [];

      for (const user of users) {
        const userAlignment = profileMap.get(user.wallet_address);
        if (!userAlignment) continue;

        const drepId = user.claimed_drep_id;
        if (!drepId) continue;

        const drepAlignment = drepAlignmentMap.get(drepId);
        if (!drepAlignment) continue;

        const citizenAlignment: Alignment6D = {
          treasury_conservative: 50,
          treasury_growth: 50,
          decentralization: 50,
          security: 50,
          innovation: 50,
          transparency: 50,
        };
        for (const dim of ALIGNMENT_DIMENSIONS) {
          citizenAlignment[dim] = userAlignment[dim] ?? 50;
        }

        const drift = computeAlignmentDrift(citizenAlignment, drepAlignment);

        if (drift.classification !== 'low') {
          driftsDetected++;

          // Find top 3 alternative DReps (excluding current) by alignment match
          const alternatives = allDrepAlignments
            .filter((d) => d.id !== drepId)
            .map((d) => ({
              drep_id: d.id,
              match_score: distanceToMatchScore(alignmentDistance(citizenAlignment, d.alignment)),
              governance_score: d.score,
            }))
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, 3);

          driftRecords.push({
            user_id: user.wallet_address,
            drep_id: drepId,
            drift_score: drift.driftScore,
            drift_classification: drift.classification,
            dimension_drifts: Object.fromEntries(
              drift.dimensionDrifts.map((d) => [d.dimension, d.delta]),
            ),
            alternative_dreps: alternatives,
            epoch_no: currentEpoch,
          });
        }
      }

      if (driftRecords.length > 0) {
        const { error } = await supabase.from('alignment_drift_records').insert(driftRecords);
        if (error) {
          logger.error('[detect-alignment-drift] Failed to insert drift records', { error });
        }
      }

      return { processed: users.length, driftsDetected };
    });

    if (result.driftsDetected > 0) {
      await step.sendEvent('drift-detected', {
        name: 'drepscore/alignment.drift-detected',
        data: { driftsDetected: result.driftsDetected },
      });
    }

    return result;
  },
);
