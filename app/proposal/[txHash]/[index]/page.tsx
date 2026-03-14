import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProposalByKey, getVotesByProposal, getVotePowerByEpoch } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { getTreasuryBalance, getNclUtilization } from '@/lib/treasury';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProposalDescription } from '@/components/ProposalDescription';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { getProposalStatus } from '@/utils/proposalPriority';
import { ProposalOutcomeSection } from '@/components/ProposalOutcomeSection';
import { ProposalVoterTabs } from '@/components/ProposalVoterTabs';
import { SimilarProposals } from '@/components/SimilarProposals';
import { PageViewTracker } from '@/components/PageViewTracker';
import { VoteAdoptionCurve } from '@/components/governada/charts/VoteAdoptionCurve';
import { ProposalDimensionTags } from '@/components/governada/proposals/ProposalDimensionTags';
import { ProposalLifecycleTimeline } from '@/components/governada/proposals/ProposalLifecycleTimeline';
import { ImpactTags } from '@/components/engagement/ImpactTags';
import { EngagementSummary } from '@/components/engagement/EngagementSummary';
import { ConcernFlagBanner } from '@/components/engagement/ConcernFlagBanner';
import { ProposalHeroV2 } from '@/components/governada/proposals/ProposalHeroV2';
import { WatchEntityButton } from '@/components/WatchEntityButton';
import { IntelligenceBriefing } from '@/components/governada/proposals/IntelligenceBriefing';
import { DebateSection } from '@/components/governada/proposals/DebateSection';
import { ProposalActionZone } from '@/components/governada/proposals/ProposalActionZone';
import { ProposalDepthGate } from '@/components/governada/proposals/ProposalDepthGate';
import { ProposalDepthSection } from '@/components/governada/proposals/ProposalDepthSection';
import { getFeatureFlag } from '@/lib/featureFlags';
import { getProposalBrief } from '@/lib/proposalBrief';
import { computeConvictionPulseData } from '@/lib/convictionPulse';
import { CompactHeader } from '@/components/governada/proposals/CompactHeader';
import { ConvictionPulseViz } from '@/components/governada/proposals/ConvictionPulseViz';
import { InlineActionNudge } from '@/components/governada/proposals/InlineActionNudge';
import { LivingBrief } from '@/components/governada/proposals/LivingBrief';
import { SourceMaterial } from '@/components/governada/proposals/SourceMaterial';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ txHash: string; index: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);
  const proposal = isNaN(proposalIndex) ? null : await getProposalByKey(txHash, proposalIndex);
  const title = proposal?.title || `Proposal ${txHash.slice(0, 12)}...`;
  const description = proposal?.abstract
    ? proposal.abstract.slice(0, 160)
    : `Governance proposal details, votes, and analysis on Governada.`;
  return {
    title: `${title} — Governada`,
    description,
    openGraph: {
      title: `${title} — Governada`,
      description,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} — Governada`,
      description,
    },
  };
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);

  if (isNaN(proposalIndex)) notFound();

  const [proposal, votes, treasury, nclUtilization, votePowerByEpoch] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
    getTreasuryBalance(),
    getNclUtilization(),
    getVotePowerByEpoch(txHash, proposalIndex),
  ]);

  if (!proposal) notFound();

  // Living Brief feature flag
  const livingBriefEnabled = await getFeatureFlag('living_brief', false);

  // Fetch brief data if enabled (non-blocking, defaults to null)
  const brief = livingBriefEnabled
    ? await getProposalBrief(txHash, proposalIndex).catch(() => null)
    : null;

  // eslint-disable-next-line react-hooks/purity -- server component: Date.now() is fine during SSR
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  const status = getProposalStatus(proposal);
  const isOpen = status === 'open';

  // Aggregate votes by epoch for adoption curve
  const votesByEpoch = new Map<number, { yes: number; no: number; abstain: number }>();
  for (const v of votes) {
    const epoch = v.blockTime ? blockTimeToEpoch(v.blockTime) : null;
    if (epoch == null) continue;
    const bucket = votesByEpoch.get(epoch) ?? { yes: 0, no: 0, abstain: 0 };
    if (v.vote === 'Yes') bucket.yes++;
    else if (v.vote === 'No') bucket.no++;
    else bucket.abstain++;
    votesByEpoch.set(epoch, bucket);
  }
  const adoptionData = [...votesByEpoch.entries()]
    .sort(([a], [b]) => a - b)
    .map(([epoch, counts]) => ({
      epoch,
      yesCount: counts.yes,
      noCount: counts.no,
      abstainCount: counts.abstain,
    }));

  // Build rationale entries for debate section
  const rationaleEntries = votes
    .filter((v) => v.rationaleAiSummary || v.rationaleText)
    .map((v) => ({
      drepId: v.drepId,
      drepName: v.drepName,
      vote: v.vote,
      rationaleText: v.rationaleText,
      rationaleAiSummary: v.rationaleAiSummary,
      hashVerified: v.hashVerified,
    }));

  const title = proposal.title || `Proposal ${txHash.slice(0, 12)}...`;

  // Compute conviction pulse data for the new layout
  const pulseData = livingBriefEnabled
    ? computeConvictionPulseData(
        votes.map((v) => ({
          drepId: v.drepId,
          drepName: v.drepName,
          vote: v.vote,
          votingPowerLovelace: null, // Not available in vote detail
          hasRationale: !!(v.rationaleAiSummary || v.rationaleText),
        })),
        null, // citizen sentiment loaded client-side
      )
    : null;

  // JSON-LD structured data for governance proposal
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: proposal.abstract || `Cardano governance proposal`,
    url: `https://governada.io/proposal/${encodeURIComponent(txHash)}/${proposalIndex}`,
    publisher: {
      '@type': 'Organization',
      name: 'Governada',
      url: 'https://governada.io',
    },
    about: {
      '@type': 'Thing',
      name: 'Cardano Governance',
    },
  };

  return livingBriefEnabled ? (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageViewTracker
        event="proposal_detail_viewed"
        properties={{ tx_hash: txHash, index: proposalIndex }}
        discoveryEvent="proposal_viewed"
      />

      <div className="flex items-center justify-between gap-2">
        <Breadcrumb
          items={[
            { label: 'Governance', href: '/' },
            { label: 'Proposals', href: '/governance/proposals' },
            { label: title },
          ]}
        />
        <WatchEntityButton entityType="proposal" entityId={`${txHash}:${proposalIndex}`} />
      </div>

      {/* Zone 1: Compact Header */}
      <CompactHeader
        title={title}
        proposalType={proposal.proposalType}
        status={status}
        expirationEpoch={proposal.expirationEpoch}
        currentEpoch={currentEpoch}
        withdrawalAmount={proposal.withdrawalAmount}
        blockTime={proposal.blockTime}
      />

      {/* Zone 2: Conviction Pulse */}
      {pulseData && pulseData.totalVoters > 0 && <ConvictionPulseViz data={pulseData} />}

      {/* Zone 3: Action Nudge */}
      <ProposalDepthSection section="actionZone">
        <InlineActionNudge
          txHash={txHash}
          proposalIndex={proposalIndex}
          title={title}
          isOpen={isOpen}
          proposalType={proposal.proposalType}
        />
      </ProposalDepthSection>

      {/* Zone 4: Living Brief */}
      <ProposalDepthSection section="intelligenceBriefing">
        <LivingBrief
          brief={brief?.content ?? null}
          briefId={brief?.id ?? null}
          rationaleCount={brief?.rationaleCount ?? rationaleEntries.length}
          rationales={rationaleEntries}
          aiSummary={proposal.aiSummary}
          txHash={txHash}
          proposalIndex={proposalIndex}
        />
      </ProposalDepthSection>

      {/* Zone 5: Source Material (collapsed accordion) */}
      <ProposalDepthSection section="debate">
        <SourceMaterial
          rationales={rationaleEntries}
          proposalTitle={title}
          txHash={txHash}
          proposalIndex={proposalIndex}
          adoptionData={adoptionData}
          votePowerByEpoch={votePowerByEpoch}
          votes={votes}
          status={status}
          proposalType={proposal.proposalType}
          abstract={proposal.abstract}
          proposedEpoch={proposal.proposedEpoch}
          expirationEpoch={proposal.expirationEpoch}
          ratifiedEpoch={proposal.ratifiedEpoch}
          enactedEpoch={proposal.enactedEpoch}
          droppedEpoch={proposal.droppedEpoch}
          expiredEpoch={proposal.expiredEpoch}
          currentEpoch={currentEpoch}
        />
      </ProposalDepthSection>

      {/* Outcome Section */}
      <ProposalDepthSection section="outcomeSection">
        {!isOpen && (
          <ProposalOutcomeSection
            proposal={{
              txHash,
              proposalIndex,
              title,
              proposalType: proposal.proposalType,
              withdrawalAmount: proposal.withdrawalAmount,
              outcome: status as 'ratified' | 'enacted' | 'dropped' | 'expired',
            }}
            votes={votes.map((v) => ({ drepId: v.drepId, vote: v.vote }))}
            majorityVote={
              proposal.yesCount >= proposal.noCount && proposal.yesCount >= proposal.abstainCount
                ? 'Yes'
                : proposal.noCount >= proposal.abstainCount
                  ? 'No'
                  : 'Abstain'
            }
          />
        )}
        {(status === 'enacted' || status === 'ratified') && (
          <ImpactTags txHash={txHash} proposalIndex={proposalIndex} />
        )}
      </ProposalDepthSection>
    </div>
  ) : (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageViewTracker
        event="proposal_detail_viewed"
        properties={{ tx_hash: txHash, index: proposalIndex }}
        discoveryEvent="proposal_viewed"
      />

      <div className="flex items-center justify-between gap-2">
        <Breadcrumb
          items={[
            { label: 'Governance', href: '/' },
            { label: 'Proposals', href: '/governance/proposals' },
            { label: title },
          ]}
        />
        <WatchEntityButton entityType="proposal" entityId={`${txHash}:${proposalIndex}`} />
      </div>

      {/* Zone 1: Hero — type-specific gradient, verdict strip, prominent title */}
      <ProposalHeroV2
        txHash={txHash}
        proposalIndex={proposalIndex}
        title={title}
        proposalType={proposal.proposalType}
        status={status}
        withdrawalAmount={proposal.withdrawalAmount}
        treasuryBalanceAda={treasury?.balanceAda ?? null}
        treasuryTier={proposal.treasuryTier}
        proposedEpoch={proposal.proposedEpoch}
        expirationEpoch={proposal.expirationEpoch}
        ratifiedEpoch={proposal.ratifiedEpoch}
        enactedEpoch={proposal.enactedEpoch}
        droppedEpoch={proposal.droppedEpoch}
        expiredEpoch={proposal.expiredEpoch}
        currentEpoch={currentEpoch}
        triBody={proposal.triBody ?? null}
        blockTime={proposal.blockTime}
        nclUtilization={nclUtilization}
        yesCount={proposal.yesCount}
        noCount={proposal.noCount}
        abstainCount={proposal.abstainCount}
        totalVotes={proposal.totalVotes}
      />

      {/* Zone 2: Primary Action — persona-branching (DRep/SPO vote flow vs citizen engagement) */}
      <ProposalDepthSection section="actionZone">
        <ProposalActionZone
          txHash={txHash}
          proposalIndex={proposalIndex}
          title={title}
          isOpen={isOpen}
          proposalAbstract={proposal.abstract}
          proposalType={proposal.proposalType}
          aiSummary={proposal.aiSummary}
        />
      </ProposalDepthSection>

      {/* Zone 3: Intelligence Briefing — AI summary + constitutional + params */}
      <ProposalDepthSection section="intelligenceBriefing">
        <IntelligenceBriefing
          txHash={txHash}
          proposalIndex={proposalIndex}
          aiSummary={proposal.aiSummary}
          proposalType={proposal.proposalType}
          paramChanges={proposal.paramChanges}
        />
      </ProposalDepthSection>

      {/* Zone 4: The Debate — elevated for prominence, social sharing per rationale */}
      <ProposalDepthSection section="debate">
        <DebateSection
          rationales={rationaleEntries}
          proposalTitle={title}
          txHash={txHash}
          proposalIndex={proposalIndex}
        />
      </ProposalDepthSection>

      {/* Zone 5: Community Signals — read-only engagement, concerns, dimension tags */}
      <ProposalDepthSection section="communitySignals">
        <div className="space-y-4">
          <EngagementSummary txHash={txHash} proposalIndex={proposalIndex} />
          <ConcernFlagBanner
            txHash={txHash}
            proposalIndex={proposalIndex}
            outcome={
              proposal.ratifiedEpoch != null
                ? 'ratified'
                : proposal.droppedEpoch != null
                  ? 'dropped'
                  : proposal.expiredEpoch != null
                    ? 'expired'
                    : null
            }
          />
          <ProposalDimensionTags relevantPrefs={proposal.relevantPrefs} />
        </div>
      </ProposalDepthSection>

      {/* Zone 6: Lifecycle timeline */}
      <ProposalDepthSection section="lifecycle">
        <ProposalLifecycleTimeline
          proposedEpoch={proposal.proposedEpoch}
          expirationEpoch={proposal.expirationEpoch}
          ratifiedEpoch={proposal.ratifiedEpoch}
          enactedEpoch={proposal.enactedEpoch}
          droppedEpoch={proposal.droppedEpoch}
          expiredEpoch={proposal.expiredEpoch}
          currentEpoch={currentEpoch}
        />
      </ProposalDepthSection>

      {/* Deep dive sections — gated for anonymous, depth-gated per section */}
      <ProposalDepthGate
        message="Unlock vote analytics, voter details, and similar proposals"
        surface="deep-dive"
      >
        <div className="space-y-6 sm:space-y-8">
          <ProposalDepthSection section="adoptionCurve">
            {adoptionData.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vote Adoption</CardTitle>
                </CardHeader>
                <CardContent>
                  <VoteAdoptionCurve votes={adoptionData} powerByEpoch={votePowerByEpoch} />
                </CardContent>
              </Card>
            )}
          </ProposalDepthSection>

          <ProposalDepthSection section="voterTabs">
            <ProposalVoterTabs
              votes={votes}
              txHash={txHash}
              proposalIndex={proposalIndex}
              status={status}
              proposalType={proposal.proposalType}
            />
          </ProposalDepthSection>

          <ProposalDepthSection section="description">
            <ProposalDescription aiSummary={null} abstract={proposal.abstract} />
          </ProposalDepthSection>

          <ProposalDepthSection section="similarProposals">
            <SimilarProposals txHash={txHash} proposalIndex={proposalIndex} />
          </ProposalDepthSection>
        </div>
      </ProposalDepthGate>

      <ProposalDepthSection section="outcomeSection">
        {!isOpen && (
          <ProposalOutcomeSection
            proposal={{
              txHash,
              proposalIndex,
              title,
              proposalType: proposal.proposalType,
              withdrawalAmount: proposal.withdrawalAmount,
              outcome: status as 'ratified' | 'enacted' | 'dropped' | 'expired',
            }}
            votes={votes.map((v) => ({ drepId: v.drepId, vote: v.vote }))}
            majorityVote={
              proposal.yesCount >= proposal.noCount && proposal.yesCount >= proposal.abstainCount
                ? 'Yes'
                : proposal.noCount >= proposal.abstainCount
                  ? 'No'
                  : 'Abstain'
            }
          />
        )}

        {(status === 'enacted' || status === 'ratified') && (
          <ImpactTags txHash={txHash} proposalIndex={proposalIndex} />
        )}
      </ProposalDepthSection>
    </div>
  );
}
