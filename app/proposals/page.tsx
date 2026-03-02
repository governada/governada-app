import { getAllProposalsWithVoteSummary } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { ProposalsPageClient } from '@/components/ProposalsPageClient';
import { ProposalsHero } from '@/components/ProposalsHero';
import { GovernanceSubNav } from '@/components/GovernanceSubNav';
import { PageViewTracker } from '@/components/PageViewTracker';
import { generateProposalsNarrative } from '@/lib/narratives';

export const revalidate = 900; // 15 min cache

export default async function ProposalsPage() {
  const proposals = await getAllProposalsWithVoteSummary();
  const currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));

  const openProposals = proposals.filter(
    p => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch
  );
  const expiringProposals = openProposals.filter(
    p => p.expirationEpoch != null && p.expirationEpoch <= currentEpoch + 2
  );
  const totalAdaAtStake = openProposals.reduce(
    (sum, p) => sum + (p.withdrawalAmount ? p.withdrawalAmount / 1_000_000 : 0), 0
  );
  const totalVotesCast = openProposals.reduce((sum, p) => sum + p.totalVotes, 0);

  const narrativeText = generateProposalsNarrative({
    openCount: openProposals.length,
    expiringCount: expiringProposals.length,
    totalAdaAtStake,
    totalVotesCast,
    currentEpoch,
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold">Governance Proposals</h1>
        <p className="text-muted-foreground">
          Track Cardano governance proposals, DRep votes, and treasury decisions in real time.
        </p>
      </div>
      <GovernanceSubNav />
      <ProposalsHero
        openCount={openProposals.length}
        expiringCount={expiringProposals.length}
        totalAdaAtStake={totalAdaAtStake}
        narrativeText={narrativeText}
      />
      <PageViewTracker event="proposals_page_viewed" />
      <ProposalsPageClient proposals={proposals} currentEpoch={currentEpoch} />
    </div>
  );
}
