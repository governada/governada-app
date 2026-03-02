import type { Metadata } from 'next';
import { FeatureFlagAdmin } from '@/components/admin/FeatureFlagAdmin';

export const metadata: Metadata = {
  title: 'Feature Flags — Admin',
};

export default function FlagsPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-sm text-muted-foreground">
          Toggle features on/off instantly. Changes take effect within 60 seconds (cache TTL).
        </p>
      </div>
      <FeatureFlagAdmin />
    </div>
  );
}
