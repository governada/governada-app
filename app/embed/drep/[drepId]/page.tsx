import { getDRepById } from '@/lib/data';
import { EmbedDRepCard } from '@/components/EmbedDRepCard';
import { getFeatureFlag } from '@/lib/featureFlags';

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

  const embedEnabled = await getFeatureFlag('embeddable_widgets', false);
  if (!embedEnabled) {
    return (
      <div
        className={`flex items-center justify-center p-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
      >
        Widget unavailable
      </div>
    );
  }

  const drep = await getDRepById(decodedId);

  if (!drep) {
    return (
      <div
        className={`flex items-center justify-center p-6 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
      >
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
