/**
 * Inngest Function: generate-state-of-governance
 *
 * Runs on epoch boundaries (approximately every 5 days, Sunday 20:00 UTC)
 * to generate the State of Governance report — the canonical weekly artifact.
 *
 * Also generates a community intelligence report into the `governance_reports`
 * table (feature-flagged: state_of_governance_report).
 */

import { inngest } from '@/lib/inngest';
import { generateAndStoreReport } from '@/lib/stateOfGovernance';
import { getSupabaseAdmin } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  getCitizenMandate,
  computeSentimentDivergence,
  computeGovernanceTemperature,
} from '@/lib/communityIntelligence';

export const generateStateOfGovernance = inngest.createFunction(
  {
    id: 'generate-state-of-governance',
    name: 'Generate State of Governance Report',
    retries: 2,
  },
  { cron: '0 20 * * 0' },
  async ({ step }) => {
    // Step 1: Generate the existing canonical report
    const result = await step.run('generate-report', async () => {
      return generateAndStoreReport();
    });

    logger.info('[StateOfGovernance] Report generated', {
      epoch: result.epoch,
      stored: result.stored,
    });

    // Step 2: Generate community intelligence report (feature-flagged display,
    // but always collect the data so it's ready when enabled)
    const communityResult = await step.run('generate-community-report', async () => {
      const epoch = result.epoch;
      const supabase = getSupabaseAdmin();

      // Gather community intelligence data
      const [mandate, divergence, temperature] = await Promise.all([
        getCitizenMandate(epoch).catch(() => null),
        computeSentimentDivergence(epoch).catch(() => null),
        computeGovernanceTemperature(epoch).catch(() => null),
      ]);

      // Gather proposal outcomes for the epoch
      const { data: proposals } = await supabase
        .from('proposals')
        .select('title, proposal_type, ratified_epoch, enacted_epoch, dropped_epoch, expired_epoch')
        .or(
          `ratified_epoch.eq.${epoch},enacted_epoch.eq.${epoch},dropped_epoch.eq.${epoch},expired_epoch.eq.${epoch}`,
        );

      const proposalOutcomes = (proposals ?? []).map((p) => ({
        title: p.title || 'Untitled',
        type: p.proposal_type,
        outcome: p.enacted_epoch
          ? 'enacted'
          : p.ratified_epoch
            ? 'ratified'
            : p.dropped_epoch
              ? 'dropped'
              : 'expired',
      }));

      // DRep participation
      const { data: dreps } = await supabase.from('dreps').select('info').not('info', 'is', null);
      const activeDreps = (dreps ?? []).filter(
        (d) => (d.info as Record<string, unknown> | null)?.isActive,
      );
      const participationRate =
        dreps && dreps.length > 0 ? Math.round((activeDreps.length / dreps.length) * 100) : 0;

      // Citizen engagement counts
      const [sentimentCount, priorityCount, assemblyCount] = await Promise.all([
        supabase.from('citizen_sentiment').select('id', { count: 'exact', head: true }),
        supabase
          .from('citizen_priority_signals')
          .select('id', { count: 'exact', head: true })
          .eq('epoch', epoch),
        supabase.from('citizen_assembly_responses').select('id', { count: 'exact', head: true }),
      ]);

      // Treasury
      const { data: govStats } = await supabase
        .from('governance_stats')
        .select('treasury_balance_lovelace')
        .eq('id', 1)
        .single();

      const treasuryBalance = govStats?.treasury_balance_lovelace
        ? `${(Number(govStats.treasury_balance_lovelace) / 1_000_000_000_000).toFixed(2)}B`
        : 'N/A';

      const reportData = {
        proposals_decided: proposalOutcomes.length,
        proposal_outcomes: proposalOutcomes,
        drep_participation: {
          active: activeDreps.length,
          total: dreps?.length ?? 0,
          rate: participationRate,
        },
        citizen_engagement: {
          sentiment_votes: sentimentCount.count ?? 0,
          priority_votes: priorityCount.count ?? 0,
          assembly_responses: assemblyCount.count ?? 0,
          total:
            (sentimentCount.count ?? 0) + (priorityCount.count ?? 0) + (assemblyCount.count ?? 0),
        },
        divergence_highlights: divergence
          ? divergence.proposals.slice(0, 5).map((p) => ({
              proposalTitle: p.proposalTitle || `${p.proposalTxHash.slice(0, 8)}...`,
              divergenceScore: p.divergenceScore,
            }))
          : [],
        treasury: {
          balance: treasuryBalance,
          withdrawals: proposalOutcomes.filter(
            (p) => p.type === 'TreasuryWithdrawals' && p.outcome === 'enacted',
          ).length,
        },
        temperature: temperature?.temperature ?? null,
        temperature_band: temperature?.band ?? null,
        mandate_top3: mandate
          ? mandate.priorities.slice(0, 3).map((p) => ({
              priority: p.label,
              score: p.weightedScore,
            }))
          : [],
      };

      // Build a simple narrative from the data
      const narrativeParts: string[] = [];
      narrativeParts.push(
        `Epoch ${epoch} saw ${proposalOutcomes.length} proposal${proposalOutcomes.length !== 1 ? 's' : ''} reach a decision.`,
      );
      if (participationRate > 0) {
        narrativeParts.push(
          `DRep participation rate stood at ${participationRate}% (${activeDreps.length} of ${dreps?.length ?? 0}).`,
        );
      }
      const totalEngagement = reportData.citizen_engagement.total;
      if (totalEngagement > 0) {
        narrativeParts.push(
          `Citizens contributed ${totalEngagement} engagement signal${totalEngagement !== 1 ? 's' : ''}.`,
        );
      }
      if (divergence && divergence.aggregateDivergence > 0) {
        const divPct = Math.round(divergence.aggregateDivergence * 100);
        narrativeParts.push(`The average citizen-DRep sentiment divergence was ${divPct}%.`);
      }
      if (temperature) {
        narrativeParts.push(
          `Governance temperature: ${temperature.temperature}/100 (${temperature.band}).`,
        );
      }

      const narrative = narrativeParts.join(' ');

      // Store in governance_reports table
      const { error } = await supabase.from('governance_reports').upsert(
        {
          epoch,
          report_data: reportData,
          narrative,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'epoch' },
      );

      if (error) {
        logger.error('[StateOfGovernance] Community report store error', {
          error: error.message,
        });
        return { stored: false };
      }

      return { stored: true, epoch };
    });

    return { ...result, community: communityResult };
  },
);
