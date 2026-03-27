/**
 * /g/proposal/[txHash]/[index] — Globe focused on a proposal.
 * SSR renders semantic content for crawlers; visual experience is the globe.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProposalByKey, getVotesByProposal } from '@/lib/data';
import { getProposalStatus } from '@/utils/proposalPriority';
import { BASE_URL } from '@/lib/constants';

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
    : 'Governance proposal details, votes, and analysis on Governada.';

  return {
    title: `${title} — Constellation — Governada`,
    description,
    openGraph: {
      title: `${title} — Governada`,
      description,
      type: 'article',
      images: [`${BASE_URL}/api/og/drep/${encodeURIComponent(txHash)}`],
    },
    alternates: {
      canonical: `${BASE_URL}/g/proposal/${txHash}/${indexStr}`,
    },
  };
}

export default async function GlobeProposalPage({ params }: PageProps) {
  const { txHash, index: indexStr } = await params;
  const proposalIndex = parseInt(indexStr, 10);
  if (isNaN(proposalIndex)) notFound();

  const [proposal, votes] = await Promise.all([
    getProposalByKey(txHash, proposalIndex),
    getVotesByProposal(txHash, proposalIndex),
  ]);

  if (!proposal) notFound();

  const status = getProposalStatus(proposal);
  const yesVotes = votes.filter((v) => v.vote === 'Yes').length;
  const noVotes = votes.filter((v) => v.vote === 'No').length;
  const abstainVotes = votes.filter((v) => v.vote === 'Abstain').length;

  return (
    <article itemScope itemType="https://schema.org/GovernmentService">
      <h1 itemProp="name">{proposal.title || `Proposal ${txHash.slice(0, 12)}`}</h1>
      <p itemProp="description">{proposal.abstract}</p>
      <dl>
        <dt>Status</dt>
        <dd>{status}</dd>
        <dt>Type</dt>
        <dd>{proposal.proposalType}</dd>
        <dt>Votes</dt>
        <dd>
          Yes: {yesVotes}, No: {noVotes}, Abstain: {abstainVotes}
        </dd>
        <dt>Total voters</dt>
        <dd>{votes.length}</dd>
      </dl>
      <a href={`/proposal/${txHash}/${proposalIndex}`}>View full proposal details</a>
    </article>
  );
}
