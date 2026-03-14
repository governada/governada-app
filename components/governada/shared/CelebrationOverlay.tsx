'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { tierKey, TIER_BADGE_BG, TIER_SCORE_COLOR } from '@/components/governada/cards/tierStyles';
import { ShareModal } from './ShareModal';

const TIER_CONFETTI_COLORS: Record<string, string[]> = {
  Emerging: ['#94a3b8', '#64748b'],
  Bronze: ['#f59e0b', '#92400e'],
  Silver: ['#94a3b8', '#ffffff'],
  Gold: ['#fbbf24', '#f59e0b'],
  Diamond: ['#22d3ee', '#3b82f6'],
  Legendary: ['#8b5cf6', '#a855f7'],
};

const AUTO_DISMISS_SECONDS = 8;

interface CelebrationOverlayProps {
  entityType: 'drep' | 'spo';
  entityId: string;
  entityName: string;
  oldTier: string;
  newTier: string;
  newScore: number;
  onDismiss: () => void;
  ogImageUrl?: string;
  shareText?: string;
  shareUrl?: string;
}

export function CelebrationOverlay({
  entityName,
  oldTier,
  newTier,
  newScore,
  onDismiss,
  ogImageUrl,
  shareText,
  shareUrl,
}: CelebrationOverlayProps) {
  const firedRef = useRef(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [countdown, setCountdown] = useState(AUTO_DISMISS_SECONDS);
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const newTierKey = tierKey(newTier);
  const oldTierKey = tierKey(oldTier);
  const colors = TIER_CONFETTI_COLORS[newTierKey] ?? TIER_CONFETTI_COLORS.Emerging;

  useEffect(() => {
    if (firedRef.current || prefersReducedMotion) return;
    firedRef.current = true;

    confetti({
      particleCount: 80,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
    });
    confetti({
      particleCount: 80,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
    });
  }, [colors, prefersReducedMotion]);

  useEffect(() => {
    if (shareOpen) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDismiss, shareOpen]);

  const progressPct = (countdown / AUTO_DISMISS_SECONDS) * 100;

  return (
    <>
      <AnimatePresence>
        <motion.div
          key="celebration-overlay"
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: 'spring', stiffness: 300, damping: 25 }
            }
            className="relative mx-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Content */}
            <div className="flex flex-col items-center gap-4 px-6 pb-6 pt-8 text-center">
              {/* Label */}
              <span
                className={`text-xs font-semibold uppercase tracking-widest ${TIER_SCORE_COLOR[newTierKey]}`}
              >
                Tier Change
              </span>

              {/* Headline */}
              <h2 className="text-2xl font-bold leading-tight">
                You reached <span className={TIER_SCORE_COLOR[newTierKey]}>{newTier}</span>!
              </h2>

              {/* Name */}
              <p className="text-sm text-muted-foreground">{entityName}</p>

              {/* Score */}
              <div className={`text-4xl font-bold tabular-nums ${TIER_SCORE_COLOR[newTierKey]}`}>
                {newScore}
              </div>

              {/* Tier transition */}
              <div className="flex items-center gap-3">
                <Badge className={TIER_BADGE_BG[oldTierKey]}>{oldTier}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className={TIER_BADGE_BG[newTierKey]}>{newTier}</Badge>
              </div>

              {/* Actions */}
              <div className="mt-2 flex w-full gap-2">
                {ogImageUrl && shareText && shareUrl && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShareOpen(true);
                      setCountdown(AUTO_DISMISS_SECONDS);
                    }}
                  >
                    Share this
                  </Button>
                )}
                <Button className="flex-1" onClick={onDismiss}>
                  Continue
                </Button>
              </div>

              {/* Countdown label */}
              <p className="text-xs text-muted-foreground">Auto-dismissing in {countdown}s</p>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-muted">
              <motion.div
                className={`h-full ${newTierKey === 'Legendary' ? 'bg-violet-500' : newTierKey === 'Diamond' ? 'bg-cyan-400' : newTierKey === 'Gold' ? 'bg-yellow-400' : newTierKey === 'Silver' ? 'bg-slate-300' : newTierKey === 'Bronze' ? 'bg-amber-500' : 'bg-muted-foreground'}`}
                style={{ width: `${progressPct}%` }}
                transition={{ duration: 1, ease: 'linear' }}
              />
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {ogImageUrl && shareText && shareUrl && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          ogImageUrl={ogImageUrl}
          shareText={shareText}
          shareUrl={shareUrl}
          title="Share your achievement"
        />
      )}
    </>
  );
}
