import type { Metadata } from 'next';
import { DeveloperPage } from '@/components/DeveloperPage';
import { getFeatureFlag } from '@/lib/featureFlags';

export const metadata: Metadata = {
  title: 'Developers — DRepScore API',
  description:
    'Build on governance intelligence. Interactive API explorer, embeddable widgets, and documentation for the DRepScore v1 API.',
  openGraph: {
    title: 'DRepScore Developer Platform',
    description:
      'Build on governance intelligence. API explorer, embeddable widgets, and documentation.',
  },
};

export default async function DevelopersPage() {
  const developerPlatformEnabled = await getFeatureFlag('developer_platform', false);

  if (!developerPlatformEnabled) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="rounded-lg border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Coming soon</h2>
          <p className="text-muted-foreground text-sm">
            The developer platform is under development.
          </p>
        </div>
      </div>
    );
  }

  return <DeveloperPage />;
}
