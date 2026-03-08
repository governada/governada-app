/**
 * DRep Detail Page — Two-viewport progressive reveal.
 * VP1 ("The Story"): Hero, narrative, key facts, radar, CTA, treasury stance.
 * VP2 ("The Record"): Tabbed voting record, score analysis, trajectory, community.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
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
import { ScoreCard } from '@/components/ScoreCard';
import { DRepProfileTabs } from '@/components/DRepProfileTabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
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
import { DRepCitizenSignals } from '@/components/DRepCitizenSignals';
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
import { getFeatureFlag } from '@/lib/featureFlags';
import { TierThemeProvider } from '@/components/providers/TierThemeProvider';
import { DRepProfileTabsV2 } from '@/components/civica/profiles/DRepProfileTabsV2';
import { getDRepTraitTags } from '@/lib/alignment';
import { generateDRepNarrative } from '@/lib/narratives';
import { NarrativeSummary } from '@/components/NarrativeSummary';
import { ActivitySideWidget } from '@/components/ActivitySideWidget';
import { SocialProofBadge } from '@/components/SocialProofBadge';
import { ScoreDeepDive } from '@/components/ScoreDeepDive';
import { DRepOutcomeSummary } from '@/components/civica/profiles/DRepOutcomeSummary';
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
} from '@/lib/data';
import { createClient } from '@/lib/supabase';
import { BASE_URL } from '@/lib/constants';
import { Suspense } from 'react';

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
      title: 'DRep Not Found — Civica',
    };
  }

  const name = getDRepPrimaryName(drep);
  const title = `${name} — Civica ${drep.drepScore}/100`;
  const description = `Participation: ${drep.effectiveParticipation}% · Rationale: ${drep.rationaleRate}% · Reliability: ${drep.reliabilityScore}% · Profile: ${drep.profileCompleteness}%`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} Civica card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
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
      activeEpoch: (cachedDRep as any).activeEpoch ?? null,
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
    const proposalKeys = votes.map((v) => `${v.proposalTxHash}-${v.proposalIndex}`);
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

/* ─── Delegation Verdict ─── */
function DelegationVerdict({
  score,
  rank,
  participationRate,
  rationaleRate,
  totalVotes,
  isActive,
  delegatorCount,
  scoreMomentum,
}: {
  score: number;
  rank: number | null;
  participationRate: number;
  rationaleRate: number;
  totalVotes: number;
  isActive: boolean;
  delegatorCount: number;
  scoreMomentum: number | null;
}) {
  if (totalVotes === 0) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4">
        <p className="text-sm font-medium">This DRep hasn&apos;t voted on any proposals yet.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Check back after they participate in governance to see their track record.
        </p>
      </div>
    );
  }

  const headline = !isActive
    ? 'This DRep is currently inactive and not accepting new delegations.'
    : score >= 80
      ? 'A highly active and transparent representative with a strong governance track record.'
      : score >= 60
        ? 'A solid representative who participates regularly in governance.'
        : score >= 40
          ? 'A developing representative — participating but with room to improve.'
          : 'An early-stage representative. Limited activity so far.';

  const details: string[] = [];
  if (participationRate >= 80) details.push('votes on most proposals');
  else if (participationRate >= 50) details.push('votes on about half of proposals');
  else details.push('votes selectively');

  if (rationaleRate >= 80) details.push('almost always explains their reasoning');
  else if (rationaleRate >= 50) details.push('explains their reasoning about half the time');
  else if (rationaleRate > 0) details.push('rarely explains their reasoning');
  else details.push("hasn't provided vote rationales yet");

  if (scoreMomentum != null && scoreMomentum > 0.5) details.push('trending upward');
  else if (scoreMomentum != null && scoreMomentum < -0.5) details.push('score declining recently');

  const borderColor =
    score >= 70
      ? 'border-emerald-500/20 bg-emerald-500/5'
      : score >= 40
        ? 'border-primary/20 bg-primary/5'
        : 'border-amber-500/20 bg-amber-500/5';

  return (
    <div className={`rounded-xl border ${borderColor} px-5 py-4`}>
      <p className="text-sm font-medium">{headline}</p>
      <p className="text-xs text-muted-foreground mt-1 capitalize">{details.join(' · ')}</p>
    </div>
  );
}

/* ─── Key Facts Strip ─── */
function KeyFact({
  label,
  value,
  subtext,
  tooltip,
}: {
  label: string;
  value: string;
  subtext?: string;
  tooltip?: string;
}) {
  const content = (
    <div className="flex flex-col items-center text-center min-w-[80px]">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold font-mono tabular-nums">{value}</span>
      {subtext && <span className="text-[10px] text-muted-foreground">{subtext}</span>}
    </div>
  );

  if (!tooltip) return content;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{content}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs max-w-[200px]">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default async function DRepDetailPage({ params, searchParams }: DRepDetailPageProps) {
  const { drepId } = await params;
  const { match } = await searchParams;
  const drep = await getDRepData(drepId);

  if (!drep) {
    notFound();
  }

  const matchScore = match ? parseInt(match, 10) : null;

  const [
    scoreHistory,
    percentile,
    rank,
    delegationTrend,
    linkChecks,
    isClaimed,
    spoAlignPct,
    drepCommunicationEnabled,
  ] = await Promise.all([
    getScoreHistory(drep.drepId),
    getDRepPercentile(drep.drepScore),
    getDRepRank(drep.drepId),
    getDRepDelegationTrend(drep.drepId),
    getSocialLinkChecks(drep.drepId),
    isDRepClaimed(drep.drepId),
    getSpoAlignment(drep.votes),
    getFeatureFlag('drep_communication', false),
  ]);

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
  const traitTags = getDRepTraitTags(drep as any);

  // Use hysteresis-aware label when civica is enabled (last_personality_label is null for
  // all DReps currently — hysteresis kicks in once the sync pipeline starts persisting labels)
  const lastPersonalityLabel = (drep as any).lastPersonalityLabel ?? null;
  const identityLabel = getPersonalityLabelWithHysteresis(alignments, lastPersonalityLabel);

  // Tier progress with recommended action (for Civica score analysis)
  const tierProgress = computeTierProgress(drep.drepScore, {
    engagementQuality: drep.engagementQuality,
    effectiveParticipation: drep.effectiveParticipationV3,
    reliability: drep.reliabilityV3,
    governanceIdentity: drep.governanceIdentity,
  });

  // Phase B: Statements tab placeholder (scaffold for when drep_communication flag is on)
  const statementsContent = drepCommunicationEnabled ? (
    <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
      <p className="text-sm font-medium text-foreground">Statements coming soon</p>
      <p className="text-xs text-muted-foreground">
        Position statements and governance philosophy from this DRep will appear here.
      </p>
    </div>
  ) : undefined;

  const profileContent = (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <ProfileViewTracker drepId={drep.drepId} />
      <PageViewTracker event="drep_profile_viewed" properties={{ drep_id: drep.drepId }} />
      <TierCelebrationManager
        entityType="drep"
        entityId={drep.drepId}
        entityName={drepName}
        enabled
        ogImageUrl={`/api/og/wrapped/drep/${encodeURIComponent(drep.drepId)}`}
        shareUrl={`https://drepscore.io/drep/${encodeURIComponent(drep.drepId)}`}
      />

      <Link href="/">
        <Button variant="ghost" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to DReps
        </Button>
      </Link>

      {/* ════════════════════════════════════════════
          VP1 — "The Story" (above fold)
          ════════════════════════════════════════════ */}

      {/* 1. Hero */}
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
      >
        <InlineDelegationCTA drepId={drep.drepId} drepName={drepName} />
        <CompareButton currentDrepId={drep.drepId} currentDrepName={drepName} />
      </DRepProfileHero>

      {/* 2. Narrative summary */}
      <NarrativeSummary
        text={generateDRepNarrative({
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
        accentColor={getIdentityColor(getDominantDimension(alignments)).hex}
      />

      {/* 3. Tier Progress + Momentum */}
      {tierProgress.pointsToNext != null && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {tierProgress.pointsToNext} pts to{' '}
              <span className="text-primary font-bold">{tierProgress.nextTier}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              {tierProgress.percentWithinTier}% through {tierProgress.currentTier}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {drep.scoreMomentum != null && drep.scoreMomentum !== 0 && (
              <span
                className={`text-xs font-medium tabular-nums ${drep.scoreMomentum > 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {drep.scoreMomentum > 0 ? '+' : ''}
                {drep.scoreMomentum.toFixed(1)} pts/day
              </span>
            )}
            <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${tierProgress.percentWithinTier}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3b. Delegation Verdict */}
      <DelegationVerdict
        score={drep.drepScore}
        rank={rank}
        participationRate={drep.effectiveParticipation}
        rationaleRate={drep.rationaleRate}
        totalVotes={drep.totalVotes}
        isActive={drep.isActive}
        delegatorCount={drep.delegatorCount}
        scoreMomentum={drep.scoreMomentum}
      />

      {/* 3c. Citizen Sentiment Signal */}
      <DRepCitizenSignals drepId={drep.drepId} />

      {/* 3d. Citizen Endorsements (social proof alongside algorithmic score) */}
      <CitizenEndorsements entityType="drep" entityId={drep.drepId} />

      {/* 4. Key Facts Strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 border-y border-border">
        <KeyFact
          label="Governance Score"
          value={`${drep.drepScore}/100`}
          subtext={percentile > 0 ? `Top ${100 - percentile}%` : undefined}
          tooltip="Overall quality score based on participation, rationale, reliability, and profile completeness"
        />
        <KeyFact
          label="Votes Cast"
          value={`${drep.effectiveParticipation}%`}
          tooltip="How often this DRep votes on proposals, adjusted for voting pattern diversity"
        />
        <KeyFact
          label="Explains Votes"
          value={`${drep.rationaleRate}%`}
          tooltip="How often this DRep provides written reasoning for their votes"
        />
        <KeyFact
          label="Governance Style"
          value={identityLabel}
          tooltip="Dominant governance philosophy based on voting patterns across 6 dimensions"
        />
        {spoAlignPct !== null && (
          <KeyFact
            label="Agrees with SPOs"
            value={`${spoAlignPct}%`}
            subtext="of the time"
            tooltip="How often this DRep votes the same way as the SPO majority"
          />
        )}
        {drep.totalVotes > 0 && (
          <div className="flex flex-col items-center text-center min-w-[100px]">
            <span className="text-xs text-muted-foreground">Voting Pattern</span>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-border">
                {drep.yesVotes > 0 && (
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(drep.yesVotes / drep.totalVotes) * 100}%` }}
                  />
                )}
                {drep.noVotes > 0 && (
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${(drep.noVotes / drep.totalVotes) * 100}%` }}
                  />
                )}
                {drep.abstainVotes > 0 && (
                  <div
                    className="h-full bg-muted-foreground/40"
                    style={{ width: `${(drep.abstainVotes / drep.totalVotes) * 100}%` }}
                  />
                )}
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {drep.yesVotes}Y {drep.noVotes}N {drep.abstainVotes}A
            </span>
          </div>
        )}
      </div>

      {/* 4. Identity metadata row */}
      <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
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

      {/* 5. Delegation Power Trend */}
      {delegationTrend.length >= 2 && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Delegation Trend
            </span>
            <span className="text-xs text-muted-foreground">{delegationTrend.length} epochs</span>
          </div>
          <div className="flex items-end gap-[2px] h-10">
            {(() => {
              const counts = delegationTrend.map((d) => d.delegatorCount);
              const maxCount = Math.max(...counts, 1);
              return delegationTrend.map((d, i) => (
                <div
                  key={d.epoch}
                  className="flex-1 bg-primary/60 rounded-t-sm min-w-[3px]"
                  style={{ height: `${Math.max(4, (d.delegatorCount / maxCount) * 100)}%` }}
                  title={`Epoch ${d.epoch}: ${d.delegatorCount.toLocaleString()} delegators, ${d.votingPowerAda.toLocaleString()} ADA`}
                />
              ));
            })()}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
            <span>E{delegationTrend[0].epoch}</span>
            <span>
              {delegationTrend[delegationTrend.length - 1].delegatorCount.toLocaleString()}{' '}
              delegators &middot;{' '}
              {(delegationTrend[delegationTrend.length - 1].votingPowerAda / 1_000_000).toFixed(1)}M
              ADA
            </span>
            <span>E{delegationTrend[delegationTrend.length - 1].epoch}</span>
          </div>
        </div>
      )}

      {/* 6. Treasury Stance (compact in VP1) */}
      <DRepTreasuryStance drepId={drep.drepId} compact />

      {/* 7. Activity feed */}
      <ActivitySideWidget drepId={drep.drepId} limit={5} />

      {/* 8. Similar DReps */}
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
          <div className="space-y-6">
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
            <ScoreHistoryChart history={scoreHistory} />
            <ActivityHeatmap drepId={drep.drepId} />
          </div>
        }
        trajectoryContent={
          <div className="space-y-6">
            <AlignmentTrajectory drepId={drep.drepId} />
          </div>
        }
        communityContent={
          <div className="space-y-6">
            <DRepTreasuryStance drepId={drep.drepId} />
            <GovernancePhilosophyEditor drepId={drep.drepId} readOnly />
            <AboutSection
              description={drep.description}
              bio={drep.metadata?.bio}
              email={drep.metadata?.email}
              references={
                drep.metadata?.references as Array<{ uri: string; label?: string }> | undefined
              }
            />
            <Suspense fallback={null}>
              <DRepDashboardWrapper
                drepId={drep.drepId}
                drepName={drepName}
                isClaimed={isClaimed}
              />
            </Suspense>
          </div>
        }
      />
    </div>
  );

  return <TierThemeProvider score={drep.drepScore}>{profileContent}</TierThemeProvider>;
}
