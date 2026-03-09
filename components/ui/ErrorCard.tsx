'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({
  message = 'Failed to load data. Please try again.',
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center space-y-3',
        className,
      )}
    >
      <AlertCircle className="h-5 w-5 text-destructive mx-auto" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </button>
      )}
    </div>
  );
}
