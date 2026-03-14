import type { Metadata } from 'next';
import { CuratedVoteFlow } from '@/components/governada/match/CuratedVoteFlow';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vote on Proposals — Strengthen Your Match — Governada',
  description:
    'Vote on real Cardano governance proposals to refine your governance profile and strengthen your DRep/SPO match. Each vote improves your confidence score.',
};

export default function CuratedVotePage() {
  return <CuratedVoteFlow />;
}
