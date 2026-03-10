export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Governada — Settings',
  description: 'Preferences, display, and notification controls.',
};

/**
 * /you/settings — placeholder.
 * Will be populated with content migrated from /my-gov/profile.
 */
export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <p className="text-muted-foreground">Preferences and settings will appear here.</p>
    </div>
  );
}
