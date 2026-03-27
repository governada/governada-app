import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ drepId: string }>;
}

export default async function DRepPage({ params }: PageProps) {
  const { drepId } = await params;
  redirect(`/g/drep/${drepId}`);
}
