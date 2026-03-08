'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function EngageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Couldn&apos;t load community engagement</h2>
      <p className="text-muted-foreground max-w-md text-sm">
        We had trouble loading engagement data. This is usually temporary.
      </p>
      <div className="flex gap-3 mt-2">
        <Button onClick={reset} variant="default">
          <RotateCcw className="mr-1.5 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">
            <Home className="mr-1.5 h-4 w-4" />
            Go home
          </Link>
        </Button>
      </div>
    </div>
  );
}
