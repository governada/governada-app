'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Vote, TrendingUp, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSegment } from '@/components/providers/SegmentProvider';

const LAST_VISIT_KEY = 'governada_last_hub_visit';
const DISMISSED_KEY = 'governada_what_changed_dismissed';

interface WhatChangedData {
  lastEpoch: number;
  currentEpoch: number;
  proposalsDecided: number;
  drepVotes: number;
  newMilestones: number;
  newEndorsements: number;
}

/**
 * WhatChanged — shown at top of CitizenHub when the user returns after being away.
 *
 * Uses localStorage to track the last visit time and compares against
 * the current epoch from the API. Auto-dismisses when user interacts.
 * Only shows if there are meaningful changes.
 */
export function WhatChanged() {
  const { stakeAddress } = useSegment();
  const [data, setData] = useState<WhatChangedData | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stakeAddress) {
      setLoading(false);
      return;
    }

    // Check if user dismissed this session
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      setLoading(false);
      return;
    }

    // Get last visit info
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const lastVisitTime = lastVisit ? parseInt(lastVisit, 10) : 0;
    const hoursSinceVisit = (Date.now() - lastVisitTime) / (1000 * 60 * 60);

    // Only show if away for at least 12 hours
    if (hoursSinceVisit < 12) {
      // Update last visit
      localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
      setLoading(false);
      return;
    }

    // Fetch what-changed data from API
    fetch(`/api/you/what-changed?since=${lastVisitTime}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((result: WhatChangedData) => {
        // Only show if there's something meaningful
        const hasChanges =
          result.proposalsDecided > 0 || result.drepVotes > 0 || result.newMilestones > 0;

        if (hasChanges) {
          setData(result);
          setVisible(true);
        }
      })
      .catch(() => {
        // Silent failure — non-critical feature
      })
      .finally(() => {
        // Update last visit time
        localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
        setLoading(false);
      });
  }, [stakeAddress]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, 'true');
  }, []);

  if (loading || !visible || !data) return null;

  const epochSpan =
    data.currentEpoch - data.lastEpoch > 0
      ? `Since Epoch ${data.lastEpoch}`
      : 'Since your last visit';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 backdrop-blur-md p-4 sm:p-5">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-2">
            {epochSpan}
          </p>

          <div className="grid grid-cols-3 gap-3 mb-3">
            {data.proposalsDecided > 0 && (
              <StatPill
                icon={Vote}
                value={data.proposalsDecided}
                label={`proposal${data.proposalsDecided !== 1 ? 's' : ''} decided`}
              />
            )}
            {data.drepVotes > 0 && (
              <StatPill
                icon={TrendingUp}
                value={data.drepVotes}
                label={`DRep vote${data.drepVotes !== 1 ? 's' : ''} cast`}
              />
            )}
            {data.newMilestones > 0 && (
              <StatPill
                icon={Award}
                value={data.newMilestones}
                label={`new milestone${data.newMilestones !== 1 ? 's' : ''}`}
              />
            )}
          </div>

          <Link
            href="/you/inbox"
            onClick={handleDismiss}
            className="flex items-center justify-center gap-1.5 text-xs text-primary hover:underline group"
          >
            See full details
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Vote;
  value: number;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-xl bg-white/[0.04] p-2.5 text-center',
      )}
    >
      <Icon className="h-3.5 w-3.5 text-primary/70" />
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-[9px] font-medium text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
