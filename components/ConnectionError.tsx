'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface ConnectionErrorProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ConnectionError({
  message = 'Having trouble connecting',
  onRetry,
  compact = false,
}: ConnectionErrorProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  if (compact) {
    return (
      <div
        className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm"
        role="alert"
      >
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-muted-foreground flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="text-primary hover:text-primary/80 text-xs font-medium"
            aria-label="Retry loading"
          >
            {retrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-xl"
      role="alert"
    >
      <div className="rounded-full p-4 mb-4 bg-amber-500/10">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{message}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Please check your connection and try again. If the problem persists, our servers may be
        experiencing high demand.
      </p>
      {onRetry && (
        <Button variant="outline" onClick={handleRetry} disabled={retrying} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying...' : 'Try Again'}
        </Button>
      )}
    </div>
  );
}
