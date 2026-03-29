import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ ccHotId: string }>;
}

export default async function CCMemberPage({ params }: PageProps) {
  const { ccHotId } = await params;
  redirect(`/committee/${ccHotId}`);
}
