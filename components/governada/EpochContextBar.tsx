'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'governada_epoch_bar_dismissed';

/**
 * Persistent epoch context strip — gives temporal grounding.
 * Shows: Epoch N · Day D of 5 · persona-specific context
 *
 * Hidden on mobile for hands_off depth (too noisy for passive users).
 * Dismissible per session.
 */
export function EpochContextBar({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const { segment } = useSegment();
  const { depth } = useGovernanceDepth();
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true; // SSR: hide to prevent flash
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  });

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (dismissed) return null;

  // Hidden on mobile at hands_off depth
  const isHandsOff = depth === 'hands_off';

  // Build persona-specific context snippet
  const contextSnippet = (() => {
    if (activeProposalCount === null) return null;

    switch (segment) {
      case 'anonymous':
      case 'citizen':
      case 'drep':
      case 'spo':
      case 'cc':
      default:
        return `${activeProposalCount} ${t('proposals')}`;
    }
  })();

  return (
    <div
      className={cn(
        'sticky top-14 z-30 border-b border-border/30 bg-background/80 backdrop-blur-sm transition-[padding-left] duration-200',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
        isHandsOff && 'hidden sm:flex',
      )}
    >
      <div className="flex items-center justify-between px-4 py-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground/70">
            {t('Epoch')} {epoch}
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span>
            {t('Day')} {day} {t('of')} {totalDays}
          </span>
          {contextSnippet && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span>{contextSnippet}</span>
            </>
          )}
        </div>
        <button
          onClick={dismiss}
          className="rounded p-0.5 text-muted-foreground/50 hover:text-foreground/70 transition-colors"
          aria-label={t('Dismiss epoch bar')}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
