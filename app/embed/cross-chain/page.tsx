import { EmbedCrossChain } from '@/components/EmbedCrossChain';
import { getFeatureFlag } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedCrossChainPage({ searchParams }: Props) {
  const [{ theme }, enabled] = await Promise.all([
    searchParams,
    getFeatureFlag('cross_chain_embed'),
  ]);

  if (!enabled) {
    return <div style={{ padding: 16, fontSize: 12, color: '#888' }}>Widget unavailable</div>;
  }

  const isDark = theme !== 'light';

  return (
    <div className={isDark ? 'dark' : ''}>
      <EmbedCrossChain theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}
