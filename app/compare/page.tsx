import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
const CompareView = dynamic(() => import('@/components/CompareView').then(m => m.CompareView), { ssr: false, loading: () => <div className="h-32 animate-pulse bg-muted rounded-lg" /> });
import { PageViewTracker } from '@/components/PageViewTracker';

interface Props {
  searchParams: Promise<{ dreps?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  const ids = params.dreps?.split(',').filter(Boolean) || [];
  const title = ids.length >= 2 ? `Compare DReps | DRepScore` : 'DRep Comparison | DRepScore';
  return {
    title,
    description: 'Compare Cardano DReps side-by-side: scores, voting records, and value alignment.',
    openGraph: {
      title,
      description: 'Compare Cardano DReps side-by-side on DRepScore',
      type: 'website',
      ...(ids.length >= 2 && {
        images: [`/api/og/compare?dreps=${ids.join(',')}`],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      ...(ids.length >= 2 && {
        images: [`/api/og/compare?dreps=${ids.join(',')}`],
      }),
    },
  };
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialDrepIds = params.dreps?.split(',').filter(Boolean) || [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <PageViewTracker
        event="compare_page_viewed"
        properties={{ initial_count: initialDrepIds.length }}
      />
      <CompareView initialDrepIds={initialDrepIds} />
    </div>
  );
}
