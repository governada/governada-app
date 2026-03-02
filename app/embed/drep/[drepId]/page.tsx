import { getDRepById } from '@/lib/data';
import { EmbedDRepCard } from '@/components/EmbedDRepCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ drepId: string }>;
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedDRepPage({ params, searchParams }: Props) {
  const { drepId } = await params;
  const { theme } = await searchParams;
  const isDark = theme !== 'light';
  const decodedId = decodeURIComponent(drepId);

  const drep = await getDRepById(decodedId);

  if (!drep) {
    return (
      <div className={`flex items-center justify-center p-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        DRep not found
      </div>
    );
  }

  return (
    <div className={isDark ? 'dark' : ''}>
      <EmbedDRepCard drep={drep} theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}
