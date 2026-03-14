import { NextResponse } from 'next/server';
import { withRouteHandler } from '@/lib/api/withRouteHandler';
import { getProposalBrief, computeRationaleHash, isBriefStale } from '@/lib/proposalBrief';
import { getVotesByProposal } from '@/lib/data';
import { inngest } from '@/lib/inngest';

export const dynamic = 'force-dynamic';

export const GET = withRouteHandler(async (request) => {
  const { searchParams } = request.nextUrl;
  const txHash = searchParams.get('txHash');
  const index = searchParams.get('index');

  if (!txHash || !index) {
    return NextResponse.json({ error: 'Missing txHash or index' }, { status: 400 });
  }

  const proposalIndex = parseInt(index, 10);
  if (isNaN(proposalIndex)) {
    return NextResponse.json({ error: 'Invalid index' }, { status: 400 });
  }

  // Fetch existing brief
  const brief = await getProposalBrief(txHash, proposalIndex);

  if (!brief) {
    // Check if there are enough rationales to generate
    const votes = await getVotesByProposal(txHash, proposalIndex);
    const withRationale = votes.filter((v) => v.rationaleAiSummary || v.rationaleText);

    if (withRationale.length < 3) {
      return NextResponse.json(
        { brief: null, reason: 'insufficient_rationales', rationaleCount: withRationale.length },
        {
          status: 200,
          headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
        },
      );
    }

    // Trigger generation
    await inngest.send({
      name: 'governada/proposal.brief.generate',
      data: { txHash, proposalIndex },
    });

    return NextResponse.json(
      { brief: null, reason: 'generating' },
      {
        status: 200,
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      },
    );
  }

  // Check staleness
  const votes = await getVotesByProposal(txHash, proposalIndex);
  const currentRationales = votes.filter((v) => v.rationaleAiSummary || v.rationaleText);
  const currentHash = computeRationaleHash(
    currentRationales.map((v) => ({
      drepId: v.drepId,
      drepName: v.drepName,
      vote: v.vote,
      rationaleText: v.rationaleText,
      rationaleAiSummary: v.rationaleAiSummary,
    })),
  );

  let isStale = false;
  if (brief.rationaleHash && isBriefStale(brief, currentHash)) {
    isStale = true;
    // Trigger background regeneration
    await inngest.send({
      name: 'governada/proposal.brief.generate',
      data: { txHash, proposalIndex },
    });
  }

  return NextResponse.json(
    {
      brief: {
        id: brief.id,
        content: brief.content,
        convictionScore: brief.convictionScore,
        polarizationScore: brief.polarizationScore,
        rationaleCount: brief.rationaleCount,
        helpfulCount: brief.helpfulCount,
        notHelpfulCount: brief.notHelpfulCount,
        updatedAt: brief.updatedAt,
        isStale,
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
    },
  );
});
