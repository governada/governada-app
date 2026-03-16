'use client';

import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { ShareActions } from '@/components/ShareActions';
import { MILESTONES } from '@/lib/milestones';
import { posthog } from '@/lib/posthog';
import { playMilestoneChime } from '@/lib/sounds';
import { spring } from '@/lib/animations';

interface MilestoneCelebrationProps {
  drepId: string;
  drepName: string;
  milestoneKey: string;
  onDismiss: () => void;
}

export function MilestoneCelebration({
  drepId,
  drepName,
  milestoneKey,
  onDismiss,
}: MilestoneCelebrationProps) {
  const firedRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const milestone = MILESTONES.find((m) => m.key === milestoneKey);

  useEffect(() => {
    posthog.capture('milestone_celebration_viewed', {
      drep_id: drepId,
      milestone_key: milestoneKey,
    });
  }, [drepId, milestoneKey]);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    playMilestoneChime();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { x: 0.5, y: 0.6 },
      colors: ['#22c55e', '#6366f1', '#f59e0b', '#3b82f6'],
    });
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  if (!milestone) return null;

  const shareUrl = `https://governada.io/drep/${encodeURIComponent(drepId)}`;
  const shareText = `${drepName} just unlocked "${milestone.label}" on @GovernadaIO! ${milestone.description}`;
  const imageUrl = `/api/og/moment/milestone/${encodeURIComponent(drepId)}/${encodeURIComponent(milestoneKey)}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
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
                  <p className="text-sm font-semibold">Achievement Unlocked!</p>
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

            <div className="flex items-center gap-2">
              <ShareActions
                url={shareUrl}
                text={shareText}
                imageUrl={imageUrl}
                imageFilename={`milestone-${milestoneKey}.png`}
                surface="milestone_celebration"
                metadata={{ drep_id: drepId, milestone_key: milestoneKey }}
                variant="compact"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MilestoneCelebrationManagerProps {
  drepId: string;
  drepName: string;
  achievedMilestones: { milestoneKey: string; achievedAt: string }[];
  lastVisit: string | null;
}

export function MilestoneCelebrationManager({
  drepId,
  drepName,
  achievedMilestones,
  lastVisit,
}: MilestoneCelebrationManagerProps) {
  const [celebrating, setCelebrating] = useState<string | null>(null);

  useEffect(() => {
    if (!lastVisit || achievedMilestones.length === 0) return;
    const lastVisitTime = new Date(lastVisit).getTime();
    const newMilestones = achievedMilestones.filter(
      (m) => new Date(m.achievedAt).getTime() > lastVisitTime,
    );
    if (newMilestones.length > 0) {
      setCelebrating(newMilestones[0].milestoneKey);
    }
  }, [achievedMilestones, lastVisit]);

  if (!celebrating) return null;

  return (
    <MilestoneCelebration
      drepId={drepId}
      drepName={drepName}
      milestoneKey={celebrating}
      onDismiss={() => setCelebrating(null)}
    />
  );
}
