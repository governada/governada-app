import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
  getCCFidelityHistory,
  getCCMembersFidelity,
  getCCProposalFidelityHistory,
} from '@/lib/data';
import { PageViewTracker } from '@/components/PageViewTracker';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { PinButton } from '@/components/shared/PinButton';
import { CCMemberProfileClient } from '@/components/cc/CCMemberProfileClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ccHotId } = await params;
  const supabase = createClient();
  const { data: member } = await supabase
    .from('cc_members')
    .select('author_name')
    .eq('cc_hot_id', ccHotId)
    .maybeSingle();

  const name = member?.author_name ?? `CC Member ${ccHotId.slice(0, 12)}...`;
  return {
    title: `${name} — Constitutional Committee — Governada`,
    description: `Constitutional fidelity score, voting record, and accountability metrics for ${name}.`,
  };
}

export default async function CCMemberProfilePage({ params }: PageProps) {
  const { ccHotId } = await params;
  const decodedId = decodeURIComponent(ccHotId);
  const supabase = createClient();

  const [
    { data: member },
    { data: votes },
    { data: rationales },
    { data: alignmentRows },
    fidelityHistory,
    proposalFidelityHistory,
    allMembers,
    { data: proposals },
  ] = await Promise.all([
    supabase.from('cc_members').select('*').eq('cc_hot_id', decodedId).maybeSingle(),
    supabase
      .from('cc_votes')
      .select('proposal_tx_hash, proposal_index, vote, block_time, epoch, meta_url')
      .eq('cc_hot_id', decodedId)
      .order('block_time', { ascending: false }),
    supabase
      .from('cc_rationales')
      .select(
        'proposal_tx_hash, proposal_index, summary, cited_articles, author_name, internal_vote',
      )
      .eq('cc_hot_id', decodedId),
    supabase
      .from('inter_body_alignment')
      .select(
        'proposal_tx_hash, proposal_index, drep_yes_pct, drep_no_pct, spo_yes_pct, spo_no_pct',
      ),
    getCCFidelityHistory(decodedId),
    getCCProposalFidelityHistory(decodedId),
    getCCMembersFidelity(),
    supabase.from('proposals').select('tx_hash, proposal_index, title, proposal_type'),
  ]);

  const safeVotes = votes ?? [];
  if (safeVotes.length === 0) notFound();

  // Build lookups
  const proposalMap = new Map<string, { title: string | null; type: string }>();
  for (const p of proposals ?? []) {
    proposalMap.set(`${p.tx_hash}:${p.proposal_index}`, {
      title: p.title,
      type: p.proposal_type,
    });
  }

  const rationaleMap = new Map<string, { summary: string | null; citedArticles: string[] }>();
  for (const r of rationales ?? []) {
    rationaleMap.set(`${r.proposal_tx_hash}:${r.proposal_index}`, {
      summary: r.summary,
      citedArticles: (r.cited_articles as string[]) ?? [],
    });
  }

  const alignmentLookup = new Map<string, { drepMajority: string; spoMajority: string }>();
  for (const row of alignmentRows ?? []) {
    const key = `${row.proposal_tx_hash}:${row.proposal_index}`;
    alignmentLookup.set(key, {
      drepMajority:
        row.drep_yes_pct > row.drep_no_pct
          ? 'Yes'
          : row.drep_no_pct > row.drep_yes_pct
            ? 'No'
            : 'Abstain',
      spoMajority:
        (row.spo_yes_pct ?? 0) > (row.spo_no_pct ?? 0)
          ? 'Yes'
          : (row.spo_no_pct ?? 0) > (row.spo_yes_pct ?? 0)
            ? 'No'
            : 'Abstain',
    });
  }

  // Compute stats
  const totalVotes = safeVotes.length;
  const yesCount = safeVotes.filter((v) => v.vote === 'Yes').length;
  const noCount = safeVotes.filter((v) => v.vote === 'No').length;
  const abstainCount = safeVotes.filter((v) => v.vote === 'Abstain').length;
  const withRationale = safeVotes.filter((v) => v.meta_url).length;

  let drepAgree = 0;
  let drepCompare = 0;
  let spoAgree = 0;
  let spoCompare = 0;
  for (const v of safeVotes) {
    const a = alignmentLookup.get(`${v.proposal_tx_hash}:${v.proposal_index}`);
    if (a) {
      if (a.drepMajority !== 'Abstain') {
        drepCompare++;
        if (v.vote === a.drepMajority) drepAgree++;
      }
      if (a.spoMajority !== 'Abstain') {
        spoCompare++;
        if (v.vote === a.spoMajority) spoAgree++;
      }
    }
  }

  const authorName = member?.author_name ?? rationales?.[0]?.author_name ?? null;
  const fidelityScore = member?.fidelity_score ?? null;

  // Peer rank
  const scoredMembers = allMembers.filter((m) => m.fidelityScore != null);
  const rank = scoredMembers.findIndex((m) => m.ccHotId === decodedId) + 1;
  const totalScored = scoredMembers.length;

  // Build enriched votes for the client
  const enrichedVotes = safeVotes.map((v) => {
    const pKey = `${v.proposal_tx_hash}:${v.proposal_index}`;
    const proposal = proposalMap.get(pKey);
    const rationale = rationaleMap.get(pKey);
    const alignment = alignmentLookup.get(pKey);
    return {
      proposalTxHash: v.proposal_tx_hash,
      proposalIndex: v.proposal_index,
      vote: v.vote as string,
      epoch: v.epoch as number,
      hasRationale: !!v.meta_url,
      proposalTitle: proposal?.title ?? null,
      proposalType: proposal?.type ?? 'Unknown',
      rationaleSummary: rationale?.summary ?? null,
      citedArticles: rationale?.citedArticles ?? [],
      drepMajority: alignment?.drepMajority ?? null,
      spoMajority: alignment?.spoMajority ?? null,
    };
  });

  // Pillar scores for the breakdown (3-pillar Constitutional Fidelity model)
  const pillarScores = member
    ? {
        participation: member.participation_score,
        constitutionalGrounding: member.constitutional_grounding_score,
        reasoningQuality: member.rationale_quality_score,
      }
    : null;

  // Derive authorization epoch from earliest vote if not stored on the member
  const authorizationEpoch: number | null =
    (member as Record<string, unknown>)?.authorization_epoch != null
      ? Number((member as Record<string, unknown>).authorization_epoch)
      : safeVotes.length > 0
        ? Math.min(...safeVotes.map((v) => v.epoch as number))
        : null;

  const profileData = {
    ccHotId: decodedId,
    authorName,
    fidelityScore,
    fidelityGrade: member?.fidelity_grade ?? null,
    status: member?.status ?? null,
    expirationEpoch: member?.expiration_epoch ?? null,
    authorizationEpoch,
    rank: rank > 0 ? rank : null,
    totalScored,
    totalVotes,
    yesCount,
    noCount,
    abstainCount,
    withRationale,
    votesCast: member?.votes_cast ?? totalVotes,
    eligibleProposals: member?.eligible_proposals ?? null,
    rationaleProvisionRate: member?.rationale_provision_rate ?? null,
    constitutionalGroundingScore: member?.constitutional_grounding_score ?? null,
    drepAgree,
    drepCompare,
    spoAgree,
    spoCompare,
    pillarScores,
    enrichedVotes,
    fidelityHistory,
    proposalFidelityHistory,
  };

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
      <PageViewTracker event="cc_member_profile_viewed" properties={{ cc_hot_id: decodedId }} />
      <div className="flex items-center justify-between">
        <Breadcrumb
          items={[
            { label: 'Governance', href: '/' },
            { label: 'Committee', href: '/governance/committee' },
            { label: authorName ?? `CC ${decodedId.slice(0, 12)}\u2026` },
          ]}
        />
        <PinButton
          type="cc"
          id={decodedId}
          label={authorName ?? `CC ${decodedId.slice(0, 12)}\u2026`}
        />
      </div>
      <CCMemberProfileClient data={profileData} />
    </div>
  );
}
