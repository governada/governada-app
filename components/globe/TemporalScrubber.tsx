'use client';

/**
 * TemporalScrubber — Time scrubber for epoch governance replay.
 *
 * Horizontal slider overlaid at the bottom of the globe viewport.
 * Drives temporal replay: as the scrubber advances, votes and delegations
 * progressively appear on the globe. Play/pause for auto-advance.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemporalEvent } from '@/lib/constellation/fetchTemporalData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemporalScrubberProps {
  /** Epoch being replayed */
  epoch: number;
  /** Start timestamp of the epoch (Unix seconds) */
  epochStart: number;
  /** End timestamp of the epoch (Unix seconds) */
  epochEnd: number;
  /** All governance events in the epoch, sorted by timestamp */
  events: TemporalEvent[];
  /** Callback when progress changes — provides progress 0-1 and cumulative vote map */
  onProgressChange: (progress: number, voteMap: Map<string, 'Yes' | 'No' | 'Abstain'>) => void;
  /** Callback when scrubber is closed */
  onClose: () => void;
  className?: string;
}

// Duration of a full auto-play cycle in ms
const AUTO_PLAY_DURATION = 15_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemporalScrubber({
  epoch,
  epochStart,
  epochEnd,
  events,
  onProgressChange,
  onClose,
  className,
}: TemporalScrubberProps) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const startProgressRef = useRef(0);

  // Build cumulative vote map up to current progress
  const buildVoteMap = useCallback(
    (p: number): Map<string, 'Yes' | 'No' | 'Abstain'> => {
      const map = new Map<string, 'Yes' | 'No' | 'Abstain'>();
      const cutoffTime = epochStart + p * (epochEnd - epochStart);

      for (const event of events) {
        if (event.timestamp > cutoffTime) break;
        if (event.type === 'vote' && event.vote) {
          const vote = event.vote as 'Yes' | 'No' | 'Abstain';
          map.set(event.entityId, vote);
        }
      }
      return map;
    },
    [events, epochStart, epochEnd],
  );

  // Update globe when progress changes
  const updateProgress = useCallback(
    (p: number) => {
      const clamped = Math.max(0, Math.min(1, p));
      setProgress(clamped);
      onProgressChange(clamped, buildVoteMap(clamped));
    },
    [onProgressChange, buildVoteMap],
  );

  // Auto-play animation loop
  useEffect(() => {
    if (!playing) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      return;
    }

    startTimeRef.current = performance.now();
    startProgressRef.current = progress;

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const delta = elapsed / AUTO_PLAY_DURATION;
      const newProgress = startProgressRef.current + delta;

      if (newProgress >= 1) {
        updateProgress(1);
        setPlaying(false);
        return;
      }

      updateProgress(newProgress);
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle manual scrub
  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlaying(false);
      updateProgress(parseFloat(e.target.value));
    },
    [updateProgress],
  );

  // Format progress as date within epoch
  const formatDate = useCallback(
    (p: number) => {
      const ts = epochStart + p * (epochEnd - epochStart);
      const date = new Date(ts * 1000);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    },
    [epochStart, epochEnd],
  );

  // Count events up to current progress
  const eventCount = events.filter(
    (e) => e.timestamp <= epochStart + progress * (epochEnd - epochStart),
  ).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className={cn(
          'fixed bottom-20 left-1/2 -translate-x-1/2 z-40',
          'w-[min(600px,calc(100vw-3rem))]',
          'backdrop-blur-xl bg-background/50 border border-white/5',
          'rounded-xl shadow-2xl shadow-black/40',
          'px-4 py-3',
          'max-md:bottom-[52vh] max-md:w-[calc(100vw-2rem)]',
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-compass-teal">Epoch {epoch}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(0)} — {formatDate(1)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{eventCount} events</span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-white/5 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              aria-label="Close temporal replay"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (progress >= 1) updateProgress(0);
              setPlaying((p) => !p);
            }}
            className="p-1.5 rounded-full bg-compass-teal/20 text-compass-teal hover:bg-compass-teal/30 transition-colors"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleScrub}
            className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-compass-teal
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(45,212,191,0.4)]"
            style={{
              background: `linear-gradient(to right, #2dd4bf ${progress * 100}%, rgba(255,255,255,0.1) ${progress * 100}%)`,
            }}
          />

          <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
