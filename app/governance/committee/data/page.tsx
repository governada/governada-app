import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase';
import { getCCMembersFidelity } from '@/lib/data';
import { PageViewTracker } from '@/components/PageViewTracker';
import { Breadcrumb } from '@/components/shared/Breadcrumb';
import { CCDataExport } from '@/components/cc/CCDataExport';
import type { DataMember, CitationData } from '@/components/cc/CCDataExport';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Data & Methodology — Constitutional Committee — Governada',
  description:
    'Full scoring methodology, article citation analysis, and data export for CC member fidelity scores.',
};

export default async function DataPage() {
  const supabase = createClient();

  const [allMembers, { data: rationales }] = await Promise.all([
    getCCMembersFidelity(),
    supabase.from('cc_rationales').select('cc_hot_id, cited_articles'),
  ]);

  // Map to data export shape
  const members: DataMember[] = allMembers.map((m) => ({
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

  // Process citation data — each rationale row becomes a CitationData entry
  const citations: CitationData[] = (rationales ?? [])
    .filter((r) => r.cited_articles != null)
    .map((r) => ({
      ccHotId: r.cc_hot_id,
      citedArticles: (r.cited_articles as string[]) ?? [],
    }));

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6">
      <PageViewTracker event="cc_data_viewed" />
      <Breadcrumb
        items={[
          { label: 'Governance', href: '/' },
          { label: 'Committee', href: '/governance/committee' },
          { label: 'Data & Methodology' },
        ]}
      />
      <CCDataExport members={members} citations={citations} />
    </div>
  );
}
