import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ poolId: string }>;
}

export default async function PoolPage({ params }: PageProps) {
  const { poolId } = await params;
  redirect(`/g/pool/${poolId}`);
}
