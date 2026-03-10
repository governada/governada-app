import { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { EpochTimeline } from '@/components/EpochTimeline';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Epoch Recaps | Governada',
  description: 'Browse the history of Cardano governance epoch by epoch',
};

export const dynamic = 'force-dynamic';

export default async function PulseHistoryPage() {
  const supabase = createClient();
  const { data: recaps } = await supabase
    .from('epoch_recaps')
    .select('*')
    .order('epoch', { ascending: false })
    .limit(20);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/governance/health"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Governance Health
      </Link>

      <h1 className="text-2xl font-bold mb-2">Epoch Recaps</h1>
      <p className="text-muted-foreground mb-8">
        Browse the history of Cardano governance, epoch by epoch.
      </p>

      <EpochTimeline initialRecaps={recaps ?? []} />
    </div>
  );
}
