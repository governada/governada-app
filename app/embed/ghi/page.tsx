import { EmbedGHI } from '@/components/EmbedGHI';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ theme?: string }>;
}

export default async function EmbedGHIPage({ searchParams }: Props) {
  const { theme } = await searchParams;
  const isDark = theme !== 'light';

  return (
    <div className={isDark ? 'dark' : ''}>
      <EmbedGHI theme={isDark ? 'dark' : 'light'} />
    </div>
  );
}
