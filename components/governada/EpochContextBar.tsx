'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useSegment } from '@/components/providers/SegmentProvider';
import { useGovernanceDepth } from '@/hooks/useGovernanceDepth';
import { useEpochContext } from '@/hooks/useEpochContext';
import { useSidebarMetrics } from '@/hooks/useSidebarMetrics';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'governada_epoch_bar_dismissed';

/**
 * Persistent epoch context strip — gives temporal grounding.
 * Shows persona-specific intelligence:
 *   DRep:  Epoch N · Day D/5 · 3 pending votes · Score 82 ↑
 *   SPO:   Epoch N · Day D/5 · Gov Score 74 · 5 proposals
 *   Citizen: Epoch N · Day D/5 · 5 active proposals
 *   Anon:  Epoch N · Day D/5 · 5 active proposals
 *
 * Includes subtle epoch progress bar.
 * Hidden on mobile for hands_off depth.
 * Dismissible per session.
 */
export function EpochContextBar({ sidebarCollapsed }: { sidebarCollapsed: boolean }) {
  const { segment } = useSegment();
  const { depth } = useGovernanceDepth();
  const { epoch, day, totalDays, activeProposalCount } = useEpochContext();
  const metrics = useSidebarMetrics();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return sessionStorage.getItem(DISMISSED_KEY) === 'true';
  });

  const dismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISSED_KEY, 'true');
  };

  if (dismissed) return null;

  const isHandsOff = depth === 'hands_off';
  const proposals =
    activeProposalCount !== null ? `${activeProposalCount} ${t('proposals')}` : null;

  // Build persona-specific context using sidebar metrics for real-time data
  const contextSnippet = (() => {
    switch (segment) {
      case 'drep': {
        const pending = metrics['home.pendingVotes'];
        const score = metrics['you.drepScore'];
        const parts: string[] = [];
        if (pending) parts.push(pending);
        if (score) parts.push(`${t('Score')} ${score}`);
        if (parts.length === 0 && proposals) parts.push(proposals);
        return parts.join(' · ') || proposals;
      }
      case 'spo': {
        const govScore = metrics['home.govScore'];
        const parts: string[] = [];
        if (govScore) parts.push(`${t('Gov Score')} ${govScore}`);
        if (proposals) parts.push(proposals);
        return parts.join(' · ') || proposals;
      }
      case 'citizen':
        return proposals;
      case 'cc':
        return proposals;
      case 'anonymous':
      default:
        return proposals;
    }
  })();

  const epochProgress = (day / totalDays) * 100;

  return (
    <div
      className={cn(
        'sticky top-14 z-30 border-b border-border/30 bg-background/80 backdrop-blur-sm transition-[padding-left] duration-200',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60',
        isHandsOff && 'hidden sm:flex',
      )}
    >
      <div className="relative">
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
        {/* Epoch progress indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/20">
          <div
            className="h-full bg-primary/30 transition-all duration-500"
            style={{ width: `${epochProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
