/**
 * DRep Detail Page — Two-viewport progressive reveal.
 * VP1 ("The Story"): Hero, narrative, key facts, radar, CTA, treasury stance.
 * VP2 ("The Record"): Tabbed voting record, score analysis, trajectory, community.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
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
import { ScoreHistoryChart } from '@/components/ScoreHistoryChart';
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
import { MilestoneBadges } from '@/components/MilestoneBadges';
import { GovernancePhilosophyEditor } from '@/components/GovernancePhilosophyEditor';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { DRepTreasuryStance } from '@/components/DRepTreasuryStance';
import { DRepProfileHero } from '@/components/DRepProfileHero';
import { AlignmentTrajectory } from '@/components/AlignmentTrajectory';
import {
  extractAlignments,
  getIdentityColor,
  getDominantDimension,
  getPersonalityLabel,
} from '@/lib/drepIdentity';
import { getDRepTraitTags } from '@/lib/alignment';
import { generateDRepNarrative } from '@/lib/narratives';
import { NarrativeSummary } from '@/components/NarrativeSummary';
import { ActivitySideWidget } from '@/components/ActivitySideWidget';
import { SocialProofBadge } from '@/components/SocialProofBadge';
import {
  getDRepById,
  getVotesByDRepId,
  getProposalsByIds,
  getRationalesByVoteTxHashes,
  getScoreHistory,
  getDRepPercentile,
  getSocialLinkChecks,
  isDRepClaimed,
} from '@/lib/data';
import { createClient } from '@/lib/supabase';
import { BASE_URL } from '@/lib/constants';
import { getFeatureFlag } from '@/lib/featureFlags';
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
      title: 'DRep Not Found — DRepScore',
    };
  }

  const name = getDRepPrimaryName(drep);
  const title = `${name} — DRepScore ${drep.drepScore}/100`;
  const description = `Participation: ${drep.effectiveParticipation}% · Rationale: ${drep.rationaleRate}% · Reliability: ${drep.reliabilityScore}% · Profile: ${drep.profileCompleteness}%`;
  const ogImageUrl = `${BASE_URL}/api/og/drep/${encodeURIComponent(drepId)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${name} DRepScore card` }],
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

    const [cachedProposals, cachedRationales] = await Promise.all([
      getProposalsByIds(
        votes.map((v) => ({ txHash: v.proposal_tx_hash, index: v.proposal_index })),
      ),
      getRationalesByVoteTxHashes(votes.map((v) => v.vote_tx_hash)),
    ]);

    const voteRecords: VoteRecord[] = votes.map((vote, index) => {
      const cachedProposal = cachedProposals.get(`${vote.proposal_tx_hash}-${vote.proposal_index}`);
      const title = cachedProposal?.title || null;
      const abstract = cachedProposal?.abstract || null;
      const aiSummary = cachedProposal?.aiSummary ?? null;
      const rationaleRecord = cachedRationales.get(vote.vote_tx_hash) ?? null;
      const rationaleText = rationaleRecord?.rationaleText || null;
      const rationaleAiSummary = rationaleRecord?.rationaleAiSummary || null;

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

/* ─── Key Facts Strip ─── */
function KeyFact({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="flex flex-col items-center text-center min-w-[80px]">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold font-mono tabular-nums">{value}</span>
      {subtext && <span className="text-[10px] text-muted-foreground">{subtext}</span>}
    </div>
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
    linkChecks,
    isClaimed,
    spoAlignPct,
    showSocialProof,
    showActivityFeeds,
    showScoreHistory,
    showHeatmap,
    showFinancialImpact,
    showAuthoring,
    showComparePage,
    showNarratives,
    showSpoVotes,
  ] = await Promise.all([
    getScoreHistory(drep.drepId),
    getDRepPercentile(drep.drepScore),
    getSocialLinkChecks(drep.drepId),
    isDRepClaimed(drep.drepId),
    getSpoAlignment(drep.votes),
    getFeatureFlag('social_proof'),
    getFeatureFlag('activity_feeds'),
    getFeatureFlag('score_history'),
    getFeatureFlag('activity_heatmap'),
    getFeatureFlag('financial_impact'),
    getFeatureFlag('drep_authoring'),
    getFeatureFlag('compare_page'),
    getFeatureFlag('narrative_summaries'),
    getFeatureFlag('spo_cc_votes', false),
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
  const identityLabel = getPersonalityLabel(alignments);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <ProfileViewTracker drepId={drep.drepId} />
      <PageViewTracker event="drep_profile_viewed" properties={{ drep_id: drep.drepId }} />

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
        rank={null}
        delegatorCount={drep.delegatorCount}
        votingPowerFormatted={formatAda(drep.votingPower)}
        alignments={alignments}
        traitTags={traitTags}
        isActive={drep.isActive}
        matchScore={matchScore}
      >
        <InlineDelegationCTA drepId={drep.drepId} drepName={drepName} />
        {showComparePage && (
          <CompareButton currentDrepId={drep.drepId} currentDrepName={drepName} />
        )}
      </DRepProfileHero>

      {/* 2. Narrative summary */}
      {showNarratives && (
        <NarrativeSummary
          text={generateDRepNarrative({
            name: drepName,
            participationRate: drep.effectiveParticipation,
            rationaleRate: drep.rationaleRate,
            drepScore: drep.drepScore,
            rank: null,
            delegatorCount: drep.delegatorCount,
            votingPower: drep.votingPower,
            alignments,
            isActive: drep.isActive,
            totalVotes: drep.totalVotes,
            sizeTier: drep.sizeTier,
          })}
          accentColor={getIdentityColor(getDominantDimension(alignments)).hex}
        />
      )}

      {/* 3. Key Facts Strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 border-y border-border">
        <KeyFact
          label="Score"
          value={`${drep.drepScore}/100`}
          subtext={percentile > 0 ? `Top ${100 - percentile}%` : undefined}
        />
        <KeyFact label="Participation" value={`${drep.effectiveParticipation}%`} />
        <KeyFact label="Rationale" value={`${drep.rationaleRate}%`} />
        <KeyFact label="Alignment" value={identityLabel} />
        {showSpoVotes && spoAlignPct !== null && (
          <KeyFact label="SPO Alignment" value={`${spoAlignPct}%`} subtext="of the time" />
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
        {showSocialProof && <SocialProofBadge drepId={drep.drepId} variant="views" />}
      </div>

      {/* 5. Treasury Stance (compact in VP1) */}
      {showFinancialImpact && <DRepTreasuryStance drepId={drep.drepId} compact />}

      {/* 6. Activity feed */}
      {showActivityFeeds && <ActivitySideWidget drepId={drep.drepId} limit={5} />}

      {/* ════════════════════════════════════════════
          VP2 — "The Record" (below fold, tabbed)
          ════════════════════════════════════════════ */}

      <DRepProfileTabs
        votingRecordContent={
          <div className="space-y-6">
            <Suspense fallback={<DetailPageSkeleton />}>
              <VotingHistoryWithPrefs votes={drep.votes} />
            </Suspense>
          </div>
        }
        scoreAnalysisContent={
          <div className="space-y-6">
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
            {showScoreHistory && <ScoreHistoryChart history={scoreHistory} />}
            {showHeatmap && <ActivityHeatmap drepId={drep.drepId} />}
          </div>
        }
        trajectoryContent={
          <div className="space-y-6">
            <AlignmentTrajectory drepId={drep.drepId} />
          </div>
        }
        communityContent={
          <div className="space-y-6">
            {showFinancialImpact && <DRepTreasuryStance drepId={drep.drepId} />}
            {showAuthoring && <GovernancePhilosophyEditor drepId={drep.drepId} readOnly />}
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

      {/* Similar DReps — placeholder for future PCA-based nearest neighbor query */}
      <section className="border-t pt-8 mt-8">
        <h3 className="text-lg font-semibold mb-4">Similar DReps</h3>
        <p className="text-sm text-muted-foreground">
          Coming soon — DReps with similar governance alignment profiles.
        </p>
      </section>
    </div>
  );
}
