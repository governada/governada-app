import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ txHash: string; index: string }>;
}

export default async function ProposalPage({ params }: PageProps) {
  const { txHash, index } = await params;
  redirect(`/g/proposal/${txHash}/${index}`);
}
