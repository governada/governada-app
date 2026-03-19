'use client';

/**
 * SaveErrorBanner — persistent amber warning when auto-save fails.
 *
 * Shows below the toolbar / above the editor content when
 * `useSaveStatus().status === 'error'`. Includes:
 *  - "Changes not saved" message with a Retry button
 *  - One automatic retry after 3 seconds
 *  - Dismiss (X) button that resets status to idle
 *  - Auto-clears when status transitions back to 'saved'
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSaveStatus } from '@/lib/workspace/save-status';
import { AlertTriangle, X } from 'lucide-react';

interface SaveErrorBannerProps {
  /** Called when the user clicks Retry or the auto-retry fires */
  onRetry: () => void;
}

export function SaveErrorBanner({ onRetry }: SaveErrorBannerProps) {
  const status = useSaveStatus((s) => s.status);
  const setIdle = useSaveStatus((s) => s.setIdle);

  const autoRetried = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset the auto-retry flag when status leaves 'error'
  useEffect(() => {
    if (status !== 'error') {
      autoRetried.current = false;
    }
  }, [status]);

  // Auto-retry once after 3 seconds
  useEffect(() => {
    if (status === 'error' && !autoRetried.current) {
      timerRef.current = setTimeout(() => {
        autoRetried.current = true;
        onRetry();
      }, 3000);
    }

    return () => clearTimeout(timerRef.current);
  }, [status, onRetry]);

  const handleDismiss = useCallback(() => {
    clearTimeout(timerRef.current);
    setIdle();
  }, [setIdle]);

  if (status !== 'error') return null;

  return (
    <div className="flex items-center gap-2 rounded-md border bg-amber-500/10 border-amber-500/30 px-3 py-2 text-sm text-amber-400 animate-in fade-in slide-in-from-top-1 duration-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">Changes not saved</span>
      <button
        onClick={onRetry}
        className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors cursor-pointer"
      >
        Retry
      </button>
      <button
        onClick={handleDismiss}
        className="shrink-0 rounded p-0.5 hover:bg-amber-500/20 transition-colors cursor-pointer"
        aria-label="Dismiss save error"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
