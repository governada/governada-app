import type { Metadata } from 'next';
import { DeveloperPage } from '@/components/DeveloperPage';

export const metadata: Metadata = {
  title: 'Developers — DRepScore API',
  description: 'Build on governance intelligence. Interactive API explorer, embeddable widgets, and documentation for the DRepScore v1 API.',
  openGraph: {
    title: 'DRepScore Developer Platform',
    description: 'Build on governance intelligence. API explorer, embeddable widgets, and documentation.',
  },
};

export default function DevelopersPage() {
  return <DeveloperPage />;
}
