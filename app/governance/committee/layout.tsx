import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Constitutional Committee — Governada',
  description:
    'Constitutional Committee transparency rankings. See how CC members vote, their rationale quality, and responsiveness on Cardano governance.',
  openGraph: {
    title: 'Constitutional Committee — Governada',
    description: 'Transparency Index rankings for Cardano Constitutional Committee members.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Constitutional Committee — Governada',
    description: "How transparent is Cardano's Constitutional Committee?",
  },
};

export default function CommitteeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
