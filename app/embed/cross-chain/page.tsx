import { EmbedCrossChain } from '@/components/EmbedCrossChain';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedCrossChainPage({ searchParams }: Props) {
  const { theme } = await searchParams;
  const isDark = theme !== 'light';

  return (
    <div className={isDark ? 'dark' : ''}>
      <EmbedCrossChain theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}
