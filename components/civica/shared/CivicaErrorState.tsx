import { Clock, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type ErrorVariant = 'data-lag' | 'not-found';

interface CivicaErrorStateProps {
  variant: ErrorVariant;
  entityType?: 'DRep' | 'proposal' | 'pool';
  lastKnownEpoch?: number;
  backHref?: string;
}

export function CivicaErrorState({
  variant,
  entityType = 'DRep',
  lastKnownEpoch,
  backHref = '/governance',
}: CivicaErrorStateProps) {
  if (variant === 'data-lag') {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="py-8 text-center space-y-3">
          <Clock className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="font-medium">Governance data is syncing</p>
          <p className="text-sm text-muted-foreground">
            {lastKnownEpoch
              ? `Here's what we know as of Epoch ${lastKnownEpoch}. Full data available shortly.`
              : 'Data syncs approximately every 10 minutes. Please check back shortly.'}
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Syncing
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-16 text-center space-y-4">
        <Search className="h-8 w-8 text-muted-foreground mx-auto" />
        <div className="space-y-1">
          <p className="font-medium">This {entityType} isn&apos;t in our index yet</p>
          <p className="text-sm text-muted-foreground">Data syncs every ~10 minutes.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href={backHref}>Check back soon</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
