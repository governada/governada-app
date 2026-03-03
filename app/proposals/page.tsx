import { getAllProposalsWithVoteSummary } from '@/lib/data';
import { blockTimeToEpoch } from '@/lib/koios';
import { ProposalsPageClient } from '@/components/ProposalsPageClient';
import { ProposalsHero } from '@/components/ProposalsHero';

import { PageViewTracker } from '@/components/PageViewTracker';
import { generateProposalsNarrative } from '@/lib/narratives';

const SHELLEY_GENESIS_TIMESTAMP = 1596491091;
const EPOCH_LENGTH_SECONDS = 432000;
const SHELLEY_BASE_EPOCH = 209;

function computeEpochProgress(now: number): number {
  const secondsIntoEpoch = (now - SHELLEY_GENESIS_TIMESTAMP) % EPOCH_LENGTH_SECONDS;
  return secondsIntoEpoch / EPOCH_LENGTH_SECONDS;
}

function generateCrossBodyInsight(
  proposals: Awaited<ReturnType<typeof getAllProposalsWithVoteSummary>>,
): string | null {
  const withTriBody = proposals.filter(
    (p) =>
      p.triBody &&
      (p.triBody.spo.yes + p.triBody.spo.no + p.triBody.spo.abstain > 0 ||
        p.triBody.cc.yes + p.triBody.cc.no + p.triBody.cc.abstain > 0),
  );
  if (withTriBody.length === 0) return null;

  let agreed = 0;
  let diverged = 0;
  for (const p of withTriBody) {
    const tb = p.triBody!;
    const drepMajority =
      tb.drep.yes >= tb.drep.no && tb.drep.yes >= tb.drep.abstain
        ? 'Yes'
        : tb.drep.no >= tb.drep.abstain
          ? 'No'
          : 'Abstain';
    const spoTotal = tb.spo.yes + tb.spo.no + tb.spo.abstain;
    if (spoTotal > 0) {
      const spoMajority =
        tb.spo.yes >= tb.spo.no && tb.spo.yes >= tb.spo.abstain
          ? 'Yes'
          : tb.spo.no >= tb.spo.abstain
            ? 'No'
            : 'Abstain';
      if (drepMajority === spoMajority) agreed++;
      else diverged++;
    }
  }

  if (agreed + diverged === 0) return null;
  const rate = Math.round((agreed / (agreed + diverged)) * 100);
  if (rate >= 80)
    return `DReps and SPOs agree on ${rate}% of proposals — strong tri-body alignment this epoch.`;
  if (rate >= 50)
    return `DReps and SPOs align on ${rate}% of proposals — moderate consensus across governance bodies.`;
  return `DReps and SPOs diverge on ${100 - rate}% of proposals — governance bodies are debating different priorities.`;
}

export const dynamic = 'force-dynamic';

export default async function ProposalsPage() {
  let proposals = await getAllProposalsWithVoteSummary();
  let currentEpoch: number;

  try {
    currentEpoch = blockTimeToEpoch(Math.floor(Date.now() / 1000));
  } catch {
    currentEpoch = 0;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const epochProgress = computeEpochProgress(nowSec);

  const openProposals = proposals.filter(
    (p) => !p.ratifiedEpoch && !p.enactedEpoch && !p.droppedEpoch && !p.expiredEpoch,
  );
  const expiringProposals = openProposals.filter(
    (p) => p.expirationEpoch != null && p.expirationEpoch <= currentEpoch + 2,
  );
  const totalAdaAtStake = openProposals.reduce(
    (sum, p) => sum + (p.withdrawalAmount ? p.withdrawalAmount / 1_000_000 : 0),
    0,
  );
  const totalVotesCast = openProposals.reduce((sum, p) => sum + p.totalVotes, 0);

  let narrativeText: string | null = null;
  try {
    narrativeText = generateProposalsNarrative({
      openCount: openProposals.length,
      expiringCount: expiringProposals.length,
      totalAdaAtStake,
      totalVotesCast,
      currentEpoch,
    });
  } catch {
    narrativeText = null;
  }

  const crossBodyInsight = generateCrossBodyInsight(openProposals);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-2 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Governance Proposals</h1>
        <p className="text-muted-foreground">
          Track Cardano governance proposals, DRep votes, and treasury decisions in real time.
        </p>
      </div>
      <ProposalsHero
        openCount={openProposals.length}
        expiringCount={expiringProposals.length}
        totalAdaAtStake={totalAdaAtStake}
        narrativeText={narrativeText}
        epochProgress={epochProgress}
        currentEpoch={currentEpoch}
        crossBodyInsight={crossBodyInsight}
      />
      <PageViewTracker event="proposals_page_viewed" />
      <ProposalsPageClient proposals={proposals} currentEpoch={currentEpoch} />
    </div>
  );
}
