import type { Metadata } from 'next';
import { getCCMembersFidelity } from '@/lib/data';
import { PageViewTracker } from '@/components/PageViewTracker';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { CCComparisonView } from '@/components/cc/CCComparisonView';
import type { ComparisonMember } from '@/components/cc/CCComparisonView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compare CC Members — Constitutional Committee — Governada',
  description:
    'Side-by-side comparison of Constitutional Committee members on fidelity scores, participation, grounding, and reasoning quality.',
};

interface PageProps {
  searchParams: Promise<{ members?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { members: membersParam } = await searchParams;
  const allMembers = await getCCMembersFidelity();

  // Map to comparison shape
  const allComparisonMembers: ComparisonMember[] = allMembers.map((m) => ({
    ccHotId: m.ccHotId,
    authorName: m.authorName,
    fidelityScore: m.fidelityScore,
    fidelityGrade: m.fidelityGrade,
    participationScore: m.participationScore,
    constitutionalGroundingScore: m.constitutionalGroundingScore,
    reasoningQualityScore: m.reasoningQualityScore,
    rationaleProvisionRate: m.rationaleProvisionRate,
    votesCast: m.votesCast,
    eligibleProposals: m.eligibleProposals,
  }));

  // Parse selected member IDs from query param
  let selectedMembers: ComparisonMember[] = [];
  if (membersParam) {
    const ids = membersParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const memberMap = new Map(allComparisonMembers.map((m) => [m.ccHotId, m]));
    selectedMembers = ids
      .map((id) => memberMap.get(id))
      .filter((m): m is ComparisonMember => m != null)
      .slice(0, 4); // max 4
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
      <PageViewTracker
        event="cc_compare_viewed"
        properties={{ member_count: selectedMembers.length }}
      />
      <Breadcrumb
        items={[
          { label: 'Governance', href: '/' },
          { label: 'Committee', href: '/governance/committee' },
          { label: 'Compare' },
        ]}
      />
      <CCComparisonView members={selectedMembers} allMembers={allComparisonMembers} />
    </div>
  );
}
