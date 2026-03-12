/**
 * Error Banner Component
 * Displays error messages, particularly for Koios API issues
 */

import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBannerProps {
  message?: string;
  retryable?: boolean;
  onRetry?: () => void;
}

export function ErrorBanner({
  message = 'Unable to connect to Cardano network. Please try again later.',
  retryable = false,
  onRetry,
}: ErrorBannerProps) {
  return (
    <div
      className="w-full bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-destructive">Network Error</h3>
          <p className="text-sm text-destructive/90 mt-1">{message}</p>
          {retryable && onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-3 gap-2">
              <RefreshCcw className="h-3 w-3" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
