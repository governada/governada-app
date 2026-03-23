import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { syncProposals } from '@/inngest/functions/sync-proposals';
import { syncDreps } from '@/inngest/functions/sync-dreps';
import { syncVotes } from '@/inngest/functions/sync-votes';
import { syncSecondary } from '@/inngest/functions/sync-secondary';
import { syncSlow } from '@/inngest/functions/sync-slow';
import { syncTreasurySnapshot } from '@/inngest/functions/sync-treasury-snapshot';
import { syncGovernanceBenchmarks } from '@/inngest/functions/sync-governance-benchmarks';
import { syncFreshnessGuard } from '@/inngest/functions/sync-freshness-guard';
import { snapshotGhi } from '@/inngest/functions/snapshot-ghi';
import { alertIntegrity } from '@/inngest/functions/alert-integrity';
import { alertInbox } from '@/inngest/functions/alert-inbox';
import { alertApiHealth } from '@/inngest/functions/alert-api-health';
import { checkNotifications } from '@/inngest/functions/check-notifications';
import { checkAccountabilityPolls } from '@/inngest/functions/check-accountability-polls';
import { generateEpochSummary } from '@/inngest/functions/generate-epoch-summary';
import { generateGovernanceBrief } from '@/inngest/functions/generate-governance-brief';
import { generateStateOfGovernance } from '@/inngest/functions/generate-state-of-governance';
import { syncAlignment } from '@/inngest/functions/sync-alignment';
import { syncDrepScores } from '@/inngest/functions/sync-drep-scores';
import { syncSpoAndCcVotes } from '@/inngest/functions/sync-spo-cc-votes';
import { syncSpoScores } from '@/inngest/functions/sync-spo-scores';
import { checkSnapshotCompleteness } from '@/inngest/functions/check-snapshot-completeness';
import { cleanupRevokedSessions } from '@/inngest/functions/cleanup-revoked-sessions';
import { detectAlignmentDrift } from '@/inngest/functions/detect-alignment-drift';
import { precomputeCitizenSummaries } from '@/inngest/functions/precompute-citizen-summaries';
import { generateGovernanceWrapped } from '@/inngest/functions/generate-governance-wrapped';
import { generateWeeklyDigest } from '@/inngest/functions/generate-weekly-digest';
import { notifyEpochRecap } from '@/inngest/functions/notify-epoch-recap';
import { syncDataMoat } from '@/inngest/functions/sync-data-moat';
import { syncCatalyst } from '@/inngest/functions/sync-catalyst';
import { syncCcRationales } from '@/inngest/functions/sync-cc-rationales';
import { generateCitizenBriefings } from '@/inngest/functions/generate-citizen-briefings';
import { generateDrepEpochUpdates } from '@/inngest/functions/generate-drep-epoch-updates';
import { precomputeEngagementSignals } from '@/inngest/functions/precompute-engagement-signals';
import { generateCitizenAssembly } from '@/inngest/functions/generate-citizen-assembly';
import { trackProposalOutcomes } from '@/inngest/functions/track-proposal-outcomes';
import { computeCommunityIntelligence } from '@/inngest/functions/compute-community-intelligence';
import { notifyEngagementOutcomes } from '@/inngest/functions/notify-engagement-outcomes';
import { snapshotCitizenRings } from '@/inngest/functions/snapshot-citizen-rings';
import {
  generateProposalBriefOnDemand,
  generateProposalBriefsBatch,
} from '@/inngest/functions/generate-proposal-briefs';
import { computeCcRelations } from '@/inngest/functions/compute-cc-relations';
import { analyzeCcRationales } from '@/inngest/functions/analyze-cc-rationales';
import { generateCcBriefing } from '@/inngest/functions/generate-cc-briefing';
import { clusterPerspectives } from '@/inngest/functions/cluster-perspectives';
import { consolidateFeedbackFn } from '@/inngest/functions/consolidate-feedback';
import { generateEmbeddings as generateEmbeddingsFn } from '@/inngest/functions/generate-embeddings';
import { generateUserEmbedding } from '@/inngest/functions/generate-user-embedding';
import { computeAiQuality } from '@/inngest/functions/compute-ai-quality';
import { detectGamingSignals } from '@/inngest/functions/detect-gaming-signals';
import { extractMatchingTopics } from '@/inngest/functions/extract-matching-topics';
import { scoreProposers } from '@/inngest/functions/score-proposers';
import { scoreAiQuality } from '@/inngest/functions/score-ai-quality';
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    syncProposals,
    syncDreps,
    syncVotes,
    syncSecondary,
    syncSlow,
    syncTreasurySnapshot,
    syncGovernanceBenchmarks,
    syncFreshnessGuard,
    snapshotGhi,
    alertIntegrity,
    alertInbox,
    alertApiHealth,
    checkNotifications,
    checkAccountabilityPolls,
    generateEpochSummary,
    generateGovernanceBrief,
    generateStateOfGovernance,
    syncAlignment,
    syncDrepScores,
    syncSpoAndCcVotes,
    syncSpoScores,
    checkSnapshotCompleteness,
    cleanupRevokedSessions,
    detectAlignmentDrift,
    precomputeCitizenSummaries,
    generateGovernanceWrapped,
    generateWeeklyDigest,
    notifyEpochRecap,
    syncDataMoat,
    syncCatalyst,
    syncCcRationales,
    generateCitizenBriefings,
    generateDrepEpochUpdates,
    precomputeEngagementSignals,
    generateCitizenAssembly,
    trackProposalOutcomes,
    computeCommunityIntelligence,
    notifyEngagementOutcomes,
    snapshotCitizenRings,
    generateProposalBriefOnDemand,
    generateProposalBriefsBatch,
    computeCcRelations,
    analyzeCcRationales,
    generateCcBriefing,
    clusterPerspectives,
    consolidateFeedbackFn,
    generateEmbeddingsFn,
    generateUserEmbedding,
    computeAiQuality,
    detectGamingSignals,
    extractMatchingTopics,
    scoreProposers,
    scoreAiQuality,
  ],
});
