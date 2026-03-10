import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Support',
  description: 'Contact, feedback, and status for Governada.',
};

export default function SupportPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Support</h1>
      <p className="text-muted-foreground">Contact and feedback options will appear here.</p>
    </div>
  );
}
