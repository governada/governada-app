import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export default async function CommitteeMemberLegacyRedirect({ params }: PageProps) {
  const { ccHotId } = await params;
  redirect(`/governance/committee/${ccHotId}`);
}
