import { EmbedGHI } from '@/components/EmbedGHI';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedGHIPage({ searchParams }: Props) {
  const { theme } = await searchParams;
  const isDark = theme !== 'light';

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

  return (
    <div className={isDark ? 'dark' : ''}>
      <EmbedGHI theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}
