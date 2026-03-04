import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function ProposalNotFound() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="flex flex-col items-center justify-center text-center space-y-6">
        <div className="rounded-full bg-destructive/10 p-6">
          <AlertCircle className="h-16 w-16 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Proposal Not Found</h1>
          <p className="text-muted-foreground max-w-md">
            This proposal doesn&apos;t exist or hasn&apos;t been synced yet. Data syncs every 30
            minutes.
          </p>
        </div>
        <Link href="/proposals">
          <Button>Browse Proposals</Button>
        </Link>
      </div>
    </div>
  );
}
