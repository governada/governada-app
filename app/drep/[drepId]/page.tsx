/**
 * DRep Detail Page — Chapter-based progressive disclosure.
 *
 * Ch1 "The Story" (Hero): Name, score, personality, AI narrative (above fold).
 * Ch2 "Trust at a Glance" (TrustCard): Unified trust metrics, citizen sentiment.
 * Ch3 "The Record" (RecordSummaryCard): Treasury track record + delivery outcomes.
 * Ch4 "Trajectory" (TrajectoryCard): Score evolution + delegation momentum.
 * Ch5 "Detailed Analysis" (DRepDetailedAnalysis): Gated deep-dive — treasury stance,
 *      philosophy, endorsements, similar DReps, tabbed analysis.
 *
 * Anonymous: Ch1 + Ch2 (core only). Citizen+: All chapters. Governance: Ch5 expanded.
 */

import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
import { getProposalDisplayTitle } from '@/utils/display';
import { getDRepPrimaryName } from '@/utils/display';
import {
  formatAda,
  getSizeBadgeClass,
  applyRationaleCurve,
  getPillarStatus,
  getMissingProfileFields,
  getEasiestWin,
  getReliabilityHintFromStored,
} from '@/utils/scoring';
import { VoteRecord } from '@/types/drep';
import { VotingHistoryWithPrefs } from '@/components/VotingHistoryWithPrefs';
import { InlineDelegationCTA } from '@/components/InlineDelegationCTA';
const ScoreHistoryChart = nextDynamic(
  () => import('@/components/ScoreHistoryChart').then((m) => m.ScoreHistoryChart),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> },
);
const ScoreSimulator = nextDynamic(
  () => import('@/components/ScoreSimulator').then((m) => m.ScoreSimulator),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> },
);
import { ScoreCard } from '@/components/ScoreCard';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DetailPageSkeleton } from '@/components/LoadingSkeleton';
import { DRepDashboardWrapper } from '@/components/DRepDashboardWrapper';
import { CopyableAddress } from '@/components/CopyableAddress';
import { AboutSection } from '@/components/AboutSection';
import { SocialIconsLarge } from '@/components/SocialIconsLarge';
import { CompareButton } from '@/components/CompareButton';
import { ProfileViewTracker } from '@/components/ProfileViewTracker';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ProfileViewStats } from '@/components/ProfileViewStats';
const MilestoneBadges = nextDynamic(
  () => import('@/components/MilestoneBadges').then((m) => m.MilestoneBadges),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> },
);
import { GovernancePhilosophyEditor } from '@/components/GovernancePhilosophyEditor';
const SimilarDReps = nextDynamic(
  () => import('@/components/civica/profiles/SimilarDReps').then((m) => m.SimilarDReps),
  { loading: () => <div className="h-20 animate-pulse bg-muted rounded-lg" /> },
);
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { DRepTreasuryStance } from '@/components/DRepTreasuryStance';
import { DRepProfileHero } from '@/components/DRepProfileHero';
import { DRepDetailedAnalysis } from '@/components/drep/DRepDetailedAnalysis';
import { TrustCard } from '@/components/civica/profiles/TrustCard';
import { RecordSummaryCard } from '@/components/civica/profiles/RecordSummaryCard';
import { TrajectoryCard } from '@/components/civica/profiles/TrajectoryCard';
const CitizenEndorsements = nextDynamic(
  () => import('@/components/engagement/CitizenEndorsements').then((m) => m.CitizenEndorsements),
  { loading: () => <div className="h-20 animate-pulse bg-muted rounded-lg" /> },
);
const AlignmentTrajectory = nextDynamic(
  () => import('@/components/AlignmentTrajectory').then((m) => m.AlignmentTrajectory),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> },
);
const TierCelebrationManager = nextDynamic(() =>
  import('@/components/civica/shared/TierCelebrationManager').then((m) => m.TierCelebrationManager),
);
import {
  extractAlignments,
  getIdentityColor,
  getDominantDimension,
  getPersonalityLabelWithHysteresis,
} from '@/lib/drepIdentity';
import { computeTierProgress } from '@/lib/scoring/tiers';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { DRepProfileTabsV2 } from '@/components/civica/profiles/DRepProfileTabsV2';
const DRepStatementsTab = nextDynamic(
  () => import('@/components/civica/profiles/DRepStatementsTab').then((m) => m.DRepStatementsTab),
  { loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> },
);
import { getDRepTraitTags } from '@/lib/alignment';
import type { EnrichedDRep } from '@/lib/koios';
import { generateDRepNarrative } from '@/lib/narratives';
import { SocialProofBadge } from '@/components/SocialProofBadge';
import { WatchEntityButton } from '@/components/WatchEntityButton';
import { ScoreDeepDive } from '@/components/ScoreDeepDive';
import { DRepOutcomeSummary } from '@/components/civica/profiles/DRepOutcomeSummary';
import { ScoreAnalysisGate } from '@/components/civica/profiles/ScoreAnalysisGate';
import { getProposalOutcomesBatch } from '@/lib/proposalOutcomes';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getScoreHistory,
  getDRepPercentile,
  getDRepRank,
  getDRepDelegationTrend,
  getSocialLinkChecks,
  isDRepClaimed,
  getOpenProposalsForDRep,
  getEndorsementCount,
} from '@/lib/data';
import { createClient } from '@/lib/supabase';
import { BASE_URL } from '@/lib/constants';
import { Suspense } from 'react';
import { SegmentGate } from '@/components/shared/SegmentGate';

interface DRepDetailPageProps {
  params: Promise<{ drepId: string }>;
  searchParams: Promise<{ match?: string }>;
}

export async function generateMetadata({ params }: DRepDetailPageProps): Promise<Metadata> {
  const { drepId } = await params;
  const decodedId = decodeURIComponent(drepId);
  const drep = await getDRepById(decodedId);

  if (!drep) {
    return {
      title: 'DRep Not Found — Governada',
    };
  }

  const name = getDRepPrimaryName(drep);
  const title = `${name} — Governada ${drep.drepScore}/100`;
  const description = `Participation: ${drep.effectiveParticipation}% · Rationale: ${drep.rationaleRate}% · Reliability: ${drep.reliabilityScore}% · Profile: ${drep.profileCompleteness}%`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} Governada card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

/** Average AI rationale quality score across all scored votes */
function computeAvgRationaleQuality(votes: { rationale_quality: number | null }[]): number | null {
  const scored = votes.filter((v) => v.rationale_quality !== null && v.rationale_quality > 0);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, v) => acc + v.rationale_quality!, 0);
  return Math.round(sum / scored.length);
}

async function getDRepData(drepId: string) {
  const isDev = process.env.NODE_ENV === 'development';

  try {
    const decodedId = decodeURIComponent(drepId);

    if (isDev) {
      console.log(`[DRepProfile] Loading DRep: ${decodedId}`);
    }

    const [cachedDRep, votes] = await Promise.all([
      getDRepById(decodedId),
      getVotesByDRepId(decodedId),
    ]);

    if (!cachedDRep) {
      if (isDev) {
        console.warn(`[DRepProfile] DRep not found in Supabase: ${decodedId}`);
      }
      return null;
    }

    if (isDev) {
      console.log(`[DRepProfile] Found ${votes.length} votes for DRep ${decodedId}`);
    }

    const proposalKeys = votes.map((v) => ({
      txHash: v.proposal_tx_hash,
      index: v.proposal_index,
    }));
    const [cachedProposals, cachedRationales, outcomeMap] = await Promise.all([
      getProposalsByIds(proposalKeys),
      getRationalesByVoteTxHashes(votes.map((v) => v.vote_tx_hash)),
      getProposalOutcomesBatch(
        proposalKeys.map((k) => ({ txHash: k.txHash, proposalIndex: k.index })),
      ),
    ]);

    const voteRecords: VoteRecord[] = votes.map((vote, index) => {
      const cachedProposal = cachedProposals.get(`${vote.proposal_tx_hash}-${vote.proposal_index}`);
      const title = cachedProposal?.title || null;
      const abstract = cachedProposal?.abstract || null;
      const aiSummary = cachedProposal?.aiSummary ?? null;
      const rationaleRecord = cachedRationales.get(vote.vote_tx_hash) ?? null;
      const rationaleText = rationaleRecord?.rationaleText || null;
      const rationaleAiSummary = rationaleRecord?.rationaleAiSummary || null;

      const outcomeKey = `${vote.proposal_tx_hash}-${vote.proposal_index}`;
      const outcome = outcomeMap.get(outcomeKey);

      return {
        id: `${vote.vote_tx_hash}-${index}`,
        proposalTxHash: vote.proposal_tx_hash,
        proposalIndex: vote.proposal_index,
        voteTxHash: vote.vote_tx_hash,
        date: new Date(vote.block_time * 1000),
        vote: vote.vote,
        title: getProposalDisplayTitle(title, vote.proposal_tx_hash, vote.proposal_index),
        abstract,
        aiSummary,
        hasRationale: vote.meta_url !== null || rationaleText !== null,
        rationaleUrl: vote.meta_url,
        rationaleText,
        rationaleAiSummary,
        voteType: 'Governance' as const,
        proposalType: cachedProposal?.proposalType || null,
        treasuryTier: cachedProposal?.treasuryTier || null,
        withdrawalAmount: cachedProposal?.withdrawalAmount || null,
        relevantPrefs: cachedProposal?.relevantPrefs || [],
        proposalOutcome: outcome
          ? { deliveryStatus: outcome.deliveryStatus, deliveryScore: outcome.deliveryScore }
          : undefined,
      };
    });

    return {
      drepId: cachedDRep.drepId,
      drepHash: cachedDRep.drepHash,
      handle: cachedDRep.handle,
      name: cachedDRep.name,
      ticker: cachedDRep.ticker,
      description: cachedDRep.description,
      votingPower: cachedDRep.votingPower,
      delegatorCount: cachedDRep.delegatorCount,
      sizeTier: cachedDRep.sizeTier,
      drepScore: cachedDRep.drepScore,
      isActive: cachedDRep.isActive,
      participationRate: cachedDRep.participationRate,
      rationaleRate: cachedDRep.rationaleRate,
      effectiveParticipation: cachedDRep.effectiveParticipation,
      deliberationModifier: cachedDRep.deliberationModifier,
      reliabilityScore: cachedDRep.reliabilityScore,
      reliabilityStreak: cachedDRep.reliabilityStreak,
      reliabilityRecency: cachedDRep.reliabilityRecency,
      reliabilityLongestGap: cachedDRep.reliabilityLongestGap,
      reliabilityTenure: cachedDRep.reliabilityTenure,
      profileCompleteness: cachedDRep.profileCompleteness,
      anchorUrl: cachedDRep.anchorUrl,
      metadata: cachedDRep.metadata,
      metadataHashVerified: cachedDRep.metadataHashVerified ?? null,
      votes: voteRecords,
      activeEpoch: (cachedDRep as unknown as Record<string, unknown>).activeEpoch ?? null,
      alignmentTreasuryConservative: cachedDRep.alignmentTreasuryConservative ?? null,
      alignmentTreasuryGrowth: cachedDRep.alignmentTreasuryGrowth ?? null,
      alignmentDecentralization: cachedDRep.alignmentDecentralization ?? null,
      alignmentSecurity: cachedDRep.alignmentSecurity ?? null,
      alignmentInnovation: cachedDRep.alignmentInnovation ?? null,
      alignmentTransparency: cachedDRep.alignmentTransparency ?? null,
      totalVotes: cachedDRep.totalVotes,
      yesVotes: cachedDRep.yesVotes,
      noVotes: cachedDRep.noVotes,
      abstainVotes: cachedDRep.abstainVotes,
      epochVoteCounts: cachedDRep.epochVoteCounts,
      votingPowerLovelace: cachedDRep.votingPowerLovelace,
      engagementQuality: cachedDRep.engagementQuality ?? null,
      engagementQualityRaw: cachedDRep.engagementQualityRaw ?? null,
      effectiveParticipationV3: cachedDRep.effectiveParticipationV3 ?? null,
      effectiveParticipationV3Raw: cachedDRep.effectiveParticipationV3Raw ?? null,
      reliabilityV3: cachedDRep.reliabilityV3 ?? null,
      reliabilityV3Raw: cachedDRep.reliabilityV3Raw ?? null,
      governanceIdentity: cachedDRep.governanceIdentity ?? null,
      governanceIdentityRaw: cachedDRep.governanceIdentityRaw ?? null,
      scoreMomentum: cachedDRep.scoreMomentum ?? null,
      rationaleQualityAvg: computeAvgRationaleQuality(votes),
    };
  } catch (error) {
    console.error('[DRepProfile] Error loading DRep data:', error);
    return null;
  }
}

/**
 * Compute how often this DRep's vote matched the SPO majority.
 * Uses the inter_body_alignment cache for proposals this DRep voted on.
 */
async function getSpoAlignment(votes: VoteRecord[]): Promise<number | null> {
  if (votes.length === 0) return null;

  try {
    const supabase = createClient();
    const txHashes = [...new Set(votes.map((v) => v.proposalTxHash))];

    const { data: alignmentRows } = await supabase
      .from('inter_body_alignment')
      .select('proposal_tx_hash, proposal_index, spo_yes_pct, spo_no_pct')
      .in('proposal_tx_hash', txHashes);

    if (!alignmentRows || alignmentRows.length === 0) return null;

    const spoMap = new Map<string, 'Yes' | 'No' | 'Abstain'>();
    for (const row of alignmentRows) {
      const key = `${row.proposal_tx_hash}-${row.proposal_index}`;
      if (row.spo_yes_pct > row.spo_no_pct && row.spo_yes_pct > 0) {
        spoMap.set(key, 'Yes');
      } else if (row.spo_no_pct > row.spo_yes_pct && row.spo_no_pct > 0) {
        spoMap.set(key, 'No');
      } else if (row.spo_yes_pct === 0 && row.spo_no_pct === 0) {
        continue; // no SPO votes
      } else {
        spoMap.set(key, 'Abstain');
      }
    }

    if (spoMap.size === 0) return null;

    let matches = 0;
    let compared = 0;
    for (const v of votes) {
      const key = `${v.proposalTxHash}-${v.proposalIndex}`;
      const spoMajority = spoMap.get(key);
      if (!spoMajority) continue;
      compared++;
      if (v.vote === spoMajority) matches++;
    }

    if (compared === 0) return null;
    return Math.round((matches / compared) * 100);
  } catch {
    return null;
  }
}

export default async function DRepDetailPage({ params, searchParams }: DRepDetailPageProps) {
  const { drepId } = await params;
  const { match } = await searchParams;
  const drep = await getDRepData(drepId);

  if (!drep) {
    notFound();
  }

  const matchScore = match ? parseInt(match, 10) : null;

  let scoreHistory: Awaited<ReturnType<typeof getScoreHistory>> = [];
  let percentile = 0;
  let rank: number | null = 0;
  let delegationTrend: Awaited<ReturnType<typeof getDRepDelegationTrend>> = [];
  let linkChecks: Awaited<ReturnType<typeof getSocialLinkChecks>> = [];
  let isClaimed = false;
  let spoAlignPct: number | null = null;
  let openProposals: Awaited<ReturnType<typeof getOpenProposalsForDRep>> = [];
  let endorsementCount = 0;

  try {
    [
      scoreHistory,
      percentile,
      rank,
      delegationTrend,
      linkChecks,
      isClaimed,
      spoAlignPct,
      openProposals,
      endorsementCount,
    ] = await Promise.all([
      getScoreHistory(drep.drepId),
      getDRepPercentile(drep.drepScore),
      getDRepRank(drep.drepId),
      getDRepDelegationTrend(drep.drepId),
      getSocialLinkChecks(drep.drepId),
      isDRepClaimed(drep.drepId),
      getSpoAlignment(drep.votes),
      getOpenProposalsForDRep(drep.drepId),
      getEndorsementCount('drep', drep.drepId),
    ]);
  } catch (err) {
    console.error('[DRepProfile] Secondary data fetch failed, using defaults:', err);
  }

  const pendingProposalCount = openProposals.length;

  // Check if viewer is authenticated (hide certain elements for anonymous visitors)
  let isViewerAuthenticated = false;
  try {
    const cookieStore = await cookies();
    isViewerAuthenticated = !!cookieStore.get('drepscore_session')?.value;
  } catch {}

  const brokenLinks = new Set(linkChecks.filter((c) => c.status === 'broken').map((c) => c.uri));

  const adjustedRationale = applyRationaleCurve(drep.rationaleRate);
  const pillars = [
    {
      value: drep.effectiveParticipation,
      label: 'Effective Participation',
      weight: '30%',
      maxPoints: 30,
    },
    { value: adjustedRationale, label: 'Rationale Rate', weight: '35%', maxPoints: 35 },
    { value: drep.reliabilityScore, label: 'Reliability', weight: '20%', maxPoints: 20 },
    {
      value: drep.profileCompleteness,
      label: 'Profile Completeness',
      weight: '15%',
      maxPoints: 15,
    },
  ];
  const pillarStatuses = pillars.map((p) => getPillarStatus(p.value));
  const quickWin = getEasiestWin(pillars);

  const missingFields = getMissingProfileFields(drep.metadata);
  const participationHint =
    drep.deliberationModifier < 1.0
      ? `Discounted ${Math.round((1 - drep.deliberationModifier) * 100)}% for uniform voting pattern`
      : `Voted on ${drep.votes.length} proposals`;

  const bindingVotes = drep.votes.filter((v) => v.proposalType !== 'InfoAction');
  const rationaleCount = bindingVotes.filter((v) => v.hasRationale).length;
  const rationaleHint = `Provided reasoning on ${rationaleCount} of ${bindingVotes.length} binding votes`;

  const reliabilityHint = getReliabilityHintFromStored(
    drep.reliabilityStreak,
    drep.reliabilityRecency,
  );
  const brokenLinkCount = brokenLinks.size;
  const profileHintParts: string[] = [];
  if (missingFields.length > 0) profileHintParts.push(`Missing: ${missingFields.join(', ')}`);
  if (brokenLinkCount > 0)
    profileHintParts.push(`${brokenLinkCount} broken link${brokenLinkCount > 1 ? 's' : ''}`);
  const profileHint =
    profileHintParts.length > 0 ? profileHintParts.join('. ') : 'All profile fields completed';

  const alignments = extractAlignments(drep);
  const drepName = getDRepPrimaryName(drep);
  const traitTags = getDRepTraitTags(drep as unknown as EnrichedDRep);

  // Use hysteresis-aware label when civica is enabled (last_personality_label is null for
  // all DReps currently — hysteresis kicks in once the sync pipeline starts persisting labels)
  const lastPersonalityLabel =
    ((drep as unknown as Record<string, unknown>).lastPersonalityLabel as string | null) ?? null;
  const identityLabel = getPersonalityLabelWithHysteresis(alignments, lastPersonalityLabel);

  // Tier progress with recommended action (for Governada score analysis)
  const tierProgress = computeTierProgress(drep.drepScore, {
    engagementQuality: drep.engagementQuality,
    effectiveParticipation: drep.effectiveParticipationV3,
    reliability: drep.reliabilityV3,
    governanceIdentity: drep.governanceIdentity,
  });

  // Phase B: Statements tab — shows vote explanations, positions, epoch updates, and Q&A
  // For DRep owners, also shows a "Write Statement" button
  const statementsContent = <DRepStatementsTab drepId={drep.drepId} />;

  // JSON-LD structured data for DRep profile
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: drepName,
    url: `https://governada.io/drep/${encodeURIComponent(drep.drepId)}`,
    description: drep.description || `Cardano DRep with governance score ${drep.drepScore}/100`,
    image: `${BASE_URL}/api/og/drep/${encodeURIComponent(drep.drepId)}`,
    jobTitle: 'Delegated Representative (DRep)',
    memberOf: {
      '@type': 'Organization',
      name: 'Cardano Governance',
    },
  };

  const profileContent = (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProfileViewTracker drepId={drep.drepId} />
      <PageViewTracker
        event="drep_profile_viewed"
        properties={{ drep_id: drep.drepId }}
        discoveryEvent="drep_viewed"
      />
      <TierCelebrationManager
        entityType="drep"
        entityId={drep.drepId}
        entityName={drepName}
        enabled
        ogImageUrl={`/api/og/wrapped/drep/${encodeURIComponent(drep.drepId)}`}
        shareUrl={`https://governada.io/drep/${encodeURIComponent(drep.drepId)}`}
      />

      <Breadcrumb
        items={[
          { label: 'Governance', href: '/' },
          { label: 'Representatives', href: '/' },
          { label: drepName },
        ]}
      />

      {/* ════════════════════════════════════════════
          VP1 — "The Story" (above fold)
          ════════════════════════════════════════════ */}

      {/* ── Chapter 1: The Story (Hero) ── */}
      <DRepProfileHero
        name={drepName}
        score={drep.drepScore}
        rank={rank}
        delegatorCount={drep.delegatorCount}
        votingPowerFormatted={formatAda(drep.votingPower)}
        alignments={alignments}
        traitTags={traitTags}
        isActive={drep.isActive}
        matchScore={matchScore}
        narrative={generateDRepNarrative({
          name: drepName,
          participationRate: drep.effectiveParticipation,
          rationaleRate: drep.rationaleRate,
          drepScore: drep.drepScore,
          rank,
          delegatorCount: drep.delegatorCount,
          votingPower: drep.votingPower,
          alignments,
          isActive: drep.isActive,
          totalVotes: drep.totalVotes,
          sizeTier: drep.sizeTier,
        })}
        narrativeAccentColor={getIdentityColor(getDominantDimension(alignments)).hex}
      >
        <InlineDelegationCTA drepId={drep.drepId} drepName={drepName} />
        <CompareButton currentDrepId={drep.drepId} currentDrepName={drepName} />
        <WatchEntityButton entityType="drep" entityId={drep.drepId} />
      </DRepProfileHero>

      {/* 3. Tier Progress + Momentum — governance participants only */}
      {isViewerAuthenticated && tierProgress.pointsToNext != null && (
        <SegmentGate show={['drep', 'spo', 'cc']}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-border/50 bg-card/70 backdrop-blur-md px-4 sm:px-5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium whitespace-nowrap">
                {tierProgress.pointsToNext} pts to{' '}
                <span className="text-primary font-bold">{tierProgress.nextTier}</span>
              </span>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {tierProgress.percentWithinTier}% through {tierProgress.currentTier}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {drep.scoreMomentum != null && drep.scoreMomentum !== 0 && (
                <span
                  className={`text-xs font-medium tabular-nums whitespace-nowrap ${drep.scoreMomentum > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {drep.scoreMomentum > 0 ? '+' : ''}
                  {drep.scoreMomentum.toFixed(1)} pts/day
                </span>
              )}
              <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${tierProgress.percentWithinTier}%` }}
                />
              </div>
            </div>
          </div>
        </SegmentGate>
      )}

      {/* ── Chapter 2: Trust at a Glance ── */}
      <TrustCard
        score={drep.drepScore}
        percentile={percentile}
        identityLabel={identityLabel}
        participationRate={drep.effectiveParticipation}
        rationaleRate={drep.rationaleRate}
        spoAlignPct={spoAlignPct}
        endorsementCount={endorsementCount}
        totalVotes={drep.totalVotes}
        yesVotes={drep.yesVotes}
        noVotes={drep.noVotes}
        abstainVotes={drep.abstainVotes}
        drepId={drep.drepId}
      />

      {/* 5. Identity metadata row — governance participants only */}
      <SegmentGate show={['drep', 'spo', 'cc']}>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-sm text-muted-foreground overflow-hidden">
          {drep.ticker && (
            <Badge variant="outline" className="text-sm px-2 py-0.5">
              {drep.ticker.toUpperCase()}
            </Badge>
          )}
          {drep.handle && (
            <a
              href={`https://cardanoscan.io/token/${drep.handle.replace('$', '')}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Badge
                variant="secondary"
                className="text-sm px-2 py-0.5 font-mono hover:bg-primary/10 transition-colors"
              >
                {drep.handle}
              </Badge>
            </a>
          )}
          <Badge variant={drep.isActive ? 'default' : 'secondary'}>
            {drep.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant="outline" className={getSizeBadgeClass(drep.sizeTier)}>
            {drep.sizeTier}
          </Badge>
          {drep.metadataHashVerified === true && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Metadata verified against on-chain hash</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {drep.metadataHashVerified === false && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Metadata doesn&apos;t match on-chain hash</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <SocialIconsLarge metadata={drep.metadata} brokenLinks={brokenLinks} />
          <CopyableAddress address={drep.drepId} className="text-xs" />
          <ProfileViewStats drepId={drep.drepId} />
          <SocialProofBadge drepId={drep.drepId} variant="views" />
        </div>
      </SegmentGate>

      {/* ── Chapter 3: The Record — hidden for anonymous ── */}
      <SegmentGate hide={['anonymous']}>
        <RecordSummaryCard
          drepId={drep.drepId}
          totalVotes={drep.totalVotes}
          participationRate={drep.effectiveParticipation}
          rationaleRate={drep.rationaleRate}
        />
      </SegmentGate>

      {/* ── Chapter 4: Trajectory — hidden for anonymous ── */}
      <SegmentGate hide={['anonymous']}>
        <TrajectoryCard
          scoreHistory={scoreHistory}
          delegationTrend={delegationTrend}
          currentScore={drep.drepScore}
          scoreMomentum={drep.scoreMomentum}
          delegatorCount={drep.delegatorCount}
          votingPowerFormatted={formatAda(drep.votingPower)}
        />
      </SegmentGate>

      {/* ── Citizen Endorsements — visible to all (social proof) ── */}
      <CitizenEndorsements entityType="drep" entityId={drep.drepId} />

      {/* About — visible to all (helps delegation decisions) */}
      <AboutSection
        description={drep.description}
        bio={drep.metadata?.bio}
        email={drep.metadata?.email}
        references={drep.metadata?.references as Array<{ uri: string; label?: string }> | undefined}
      />

      {/* 7. Dashboard wrapper — hidden for anonymous (claim prompt confuses non-DReps) */}
      <SegmentGate hide={['anonymous']}>
        <Suspense fallback={null}>
          <DRepDashboardWrapper drepId={drep.drepId} drepName={drepName} isClaimed={isClaimed} />
        </Suspense>
      </SegmentGate>

      {/* ════════════════════════════════════════════
          Detailed Analysis — gated for citizens/anonymous.
          DReps, SPOs, and CC members see everything expanded.
          Citizens see a "Show detailed analysis" toggle.
          ════════════════════════════════════════════ */}
      <DRepDetailedAnalysis>
        {/* Treasury Stance — moved from VP1, too specialized for citizens */}
        <DRepTreasuryStance drepId={drep.drepId} compact />

        {/* Governance Philosophy — deep content for governance participants */}
        <GovernancePhilosophyEditor drepId={drep.drepId} readOnly />

        {/* Citizen Endorsements — interactive version for detailed analysis */}
        <CitizenEndorsements entityType="drep" entityId={drep.drepId} />

        {/* Similar DReps */}
        <SimilarDReps drepId={drep.drepId} />

        {/* ════════════════════════════════════════════
            VP2 — "The Record" (below fold, tabbed)
            ════════════════════════════════════════════ */}

        <DRepProfileTabsV2
          drepId={drep.drepId}
          statementsContent={statementsContent}
          votingRecordContent={
            <div className="space-y-6">
              <DRepOutcomeSummary drepId={drep.drepId} />
              <Suspense fallback={<DetailPageSkeleton />}>
                <VotingHistoryWithPrefs votes={drep.votes} />
              </Suspense>
            </div>
          }
          scoreAnalysisContent={
            <ScoreAnalysisGate
              drepId={drep.drepId}
              isClaimed={isClaimed}
              ownerContent={
                <>
                  {tierProgress.recommendedAction && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                          Recommended Action
                        </p>
                        <p className="text-sm font-medium">{tierProgress.recommendedAction}</p>
                      </div>
                      {tierProgress.pointsToNext != null && (
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-bold font-display tabular-nums text-primary">
                            +{tierProgress.pointsToNext}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            pts to {tierProgress.nextTier}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <ScoreSimulator drepId={drep.drepId} pendingCount={pendingProposalCount} />
                  <ScoreDeepDive
                    score={drep.drepScore}
                    engagementQuality={drep.engagementQuality}
                    engagementQualityRaw={drep.engagementQualityRaw}
                    effectiveParticipation={drep.effectiveParticipationV3}
                    effectiveParticipationRaw={drep.effectiveParticipationV3Raw}
                    reliability={drep.reliabilityV3}
                    reliabilityRaw={drep.reliabilityV3Raw}
                    governanceIdentity={drep.governanceIdentity}
                    governanceIdentityRaw={drep.governanceIdentityRaw}
                    scoreMomentum={drep.scoreMomentum}
                    rationaleRate={drep.rationaleRate}
                    rationaleQualityAvg={drep.rationaleQualityAvg}
                    deliberationModifier={drep.deliberationModifier}
                    reliabilityStreak={drep.reliabilityStreak}
                    reliabilityRecency={drep.reliabilityRecency}
                    reliabilityLongestGap={drep.reliabilityLongestGap}
                    reliabilityTenure={drep.reliabilityTenure}
                    profileCompleteness={drep.profileCompleteness}
                    delegatorCount={drep.delegatorCount}
                  />
                  <ScoreCard
                    drep={drep}
                    adjustedRationale={adjustedRationale}
                    pillars={pillars}
                    pillarStatuses={pillarStatuses}
                    quickWin={quickWin}
                    percentile={percentile}
                    participationHint={participationHint}
                    rationaleHint={rationaleHint}
                    reliabilityHint={reliabilityHint}
                    profileHint={profileHint}
                  />
                  <MilestoneBadges drepId={drep.drepId} compact />
                </>
              }
              publicContent={
                <>
                  <ScoreHistoryChart history={scoreHistory} />
                  <ActivityHeatmap drepId={drep.drepId} />
                </>
              }
            />
          }
          trajectoryContent={
            <div className="space-y-6">
              <AlignmentTrajectory drepId={drep.drepId} />
            </div>
          }
        />
      </DRepDetailedAnalysis>
    </div>
  );

  return <TierThemeProvider score={drep.drepScore}>{profileContent}</TierThemeProvider>;
}
