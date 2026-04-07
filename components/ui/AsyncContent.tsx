'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/LocaleProvider';
import { formatLocaleTime } from '@/lib/i18n/format';

interface AsyncContentProps<T> {
  query: UseQueryResult<T>;
  skeleton: ReactNode;
  errorMessage?: string;
  children: (data: T) => ReactNode;
}

export function AsyncContent<T>({
  query,
  skeleton,
  errorMessage = "Couldn't load this content",
  children,
}: AsyncContentProps<T>) {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = query;
  const { locale } = useLocale();

  if (isLoading) return <>{skeleton}</>;

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">{errorMessage}</p>
        {dataUpdatedAt > 0 && (
          <p className="text-xs text-muted-foreground">
            Last updated {formatLocaleTime(dataUpdatedAt, locale)}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  return <>{children(data)}</>;
}
