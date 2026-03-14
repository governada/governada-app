'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface AsyncContentProps {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
  errorMessage?: string;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Thin wrapper for loading/error/empty states on async data sections.
 * Use inside identity page sections to avoid repeating the same pattern.
 */
export function AsyncContent({
  isLoading,
  isError,
  data,
  errorMessage = 'Unable to load this section.',
  onRetry,
  skeleton,
  children,
}: AsyncContentProps) {
  if (isLoading) {
    return (
      skeleton ?? (
        <div className="space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      )
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!data) return null;

  return <>{children}</>;
}
