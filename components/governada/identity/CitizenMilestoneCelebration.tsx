'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { CITIZEN_MILESTONES } from '@/lib/citizenMilestones';
import { CIVIC_IDENTITY_SHARE_URL } from '@/lib/navigation/civicIdentity';
import { posthog } from '@/lib/posthog';
import { playMilestoneChime } from '@/lib/sounds';
import { spring } from '@/lib/animations';

const SEEN_KEY = 'governada-citizen-milestones-seen';

function getSeenKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markSeen(key: string) {
  try {
    const seen = getSeenKeys();
    seen.add(key);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // localStorage unavailable
  }
}

interface CitizenMilestoneCelebrationProps {
  milestoneKeys: string[];
  stakeAddress: string | null;
}

export function CitizenMilestoneCelebration({
  milestoneKeys,
  stakeAddress,
}: CitizenMilestoneCelebrationProps) {
  const [celebrating, setCelebrating] = useState<string | null>(null);
  const firedRef = useRef(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const seen = getSeenKeys();
    const unseen = milestoneKeys.filter((k) => !seen.has(k));
    if (unseen.length > 0) {
      setCelebrating(unseen[0]);
    }
  }, [milestoneKeys]);

  useEffect(() => {
    if (!celebrating || firedRef.current) return;
    firedRef.current = true;
    playMilestoneChime();
    if (!shouldReduceMotion) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { x: 0.5, y: 0.6 },
        colors: ['#22c55e', '#6366f1', '#f59e0b', '#3b82f6'],
      });
    }
    posthog?.capture('citizen_milestone_celebrated', { milestone_key: celebrating });
  }, [celebrating, shouldReduceMotion]);

  const handleDismiss = () => {
    if (celebrating) markSeen(celebrating);
    firedRef.current = false;
    // Check for next unseen
    const seen = getSeenKeys();
    seen.add(celebrating!);
    const next = milestoneKeys.filter((k) => !seen.has(k));
    setCelebrating(next.length > 0 ? next[0] : null);
  };

  if (!celebrating) return null;

  const milestone = CITIZEN_MILESTONES.find((m) => m.key === celebrating);
  if (!milestone) return null;

  const shareUrl = CIVIC_IDENTITY_SHARE_URL;
  const shareText = `${milestone.shareText} @GovernadaIO`;
  const imageUrl = stakeAddress ? `/api/og/civic-identity/${encodeURIComponent(stakeAddress)}` : '';

  return (
    <AnimatePresence>
      <motion.div
        key={celebrating}
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={spring.bouncy}
        className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-40 w-[340px] max-w-[calc(100vw-2rem)]"
      >
        <div className="rounded-xl border border-amber-500/30 bg-card shadow-2xl shadow-amber-500/10 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/15">
                <Trophy className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Milestone Unlocked!</p>
                <p className="text-xs text-muted-foreground">{milestone.label}</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-muted-foreground">{milestone.description}</p>

          {imageUrl && (
            <div className="flex items-center gap-2">
              <ShareActions
                url={shareUrl}
                text={shareText}
                imageUrl={imageUrl}
                imageFilename={`milestone-${celebrating}.png`}
                surface="citizen_milestone_celebration"
                metadata={{ milestone_key: celebrating }}
                variant="compact"
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
