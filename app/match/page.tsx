import { Metadata } from 'next';
import { QuickMatch } from '@/components/QuickMatch';
import { PageViewTracker } from '@/components/PageViewTracker';

export const metadata: Metadata = {
  title: 'Quick Match — Find Your DRep in 30 Seconds | DRepScore',
  description:
    'Answer 3 questions about your governance values and find DReps who align with you. No wallet required.',
  openGraph: {
    title: 'Find Your DRep in 30 Seconds',
    description:
      'Answer 3 questions about your governance values and find DReps who align with you.',
  },
};

export default function MatchPage() {
  return (
    <main className="container max-w-4xl mx-auto px-4 py-12">
      <PageViewTracker event="quick_match_page_viewed" />

      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight">
          Find Your DRep in 30 Seconds
        </h1>
        <p className="text-muted-foreground mt-2">
          3 questions about your governance values. No wallet needed.
        </p>
      </div>

      <QuickMatch />
    </main>
  );
}
