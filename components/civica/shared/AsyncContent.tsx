import { Skeleton } from '@/components/ui/skeleton';

interface AsyncContentProps {
  isLoading: boolean;
  isError: boolean;
  data: unknown;
  errorMessage?: string;
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
    return <p className="text-sm text-muted-foreground text-center py-4">{errorMessage}</p>;
  }

  if (!data) return null;

  return <>{children}</>;
}
