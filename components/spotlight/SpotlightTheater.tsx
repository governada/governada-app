'use client';

import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { spring } from '@/lib/animations';
import { useSpotlightTracking } from '@/hooks/useSpotlightTracking';
import { SpotlightBackground } from './SpotlightBackground';
import { SpotlightControls } from './SpotlightControls';
import { SpotlightProgress } from './SpotlightProgress';
import { SpotlightBreathe } from './SpotlightBreathe';
import { SwipeHandler } from './SwipeHandler';
import type { SpotlightEntity, SpotlightEntityType, SpotlightAction, QueueSort } from './types';
import {
  getDominantDimension,
  extractAlignments,
  type AlignmentDimension,
} from '@/lib/drepIdentity';

// ─── Constants ────────────────────────────────────────────────────────────────

const BREATHE_INTERVAL = 10;

// ─── Animation Variants ───────────────────────────────────────────────────────

const cardVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: spring.smooth,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
    scale: 0.95,
    transition: { ...spring.snappy, duration: 0.2 },
  }),
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface SpotlightTheaterProps {
  /** The full sorted queue of entities */
  queue: SpotlightEntity[];
  entityType: SpotlightEntityType;
  sort: QueueSort;
  /** Render function for entity-specific card content */
  renderCard: (entity: SpotlightEntity, isTracked: boolean) => React.ReactNode;
  /** Called when user clicks "Details" */
  onDetails: (entity: SpotlightEntity) => void;
  /** Called when user wants to compare tracked entities */
  onCompare?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SpotlightTheater({
  queue,
  entityType,
  sort,
  renderCard,
  onDetails,
  onCompare,
}: SpotlightTheaterProps) {
  const reducedMotion = useReducedMotion();
  const tracking = useSpotlightTracking(entityType);

  const [currentIndex, setCurrentIndex] = useState(() => tracking.currentIndex);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward
  const [showBreathe, setShowBreathe] = useState(false);
  const [entitiesSinceBreathe, setEntitiesSinceBreathe] = useState(0);

  // Current entity
  const entity = queue[currentIndex] ?? null;

  // Get dominant dimension for background color
  const dominantDimension = useMemo<AlignmentDimension | null>(() => {
    if (!entity) return null;

    if (entity.entityType === 'drep') {
      const alignments = extractAlignments(entity.data);
      return getDominantDimension(alignments);
    }
    if (entity.entityType === 'spo') {
      const spo = entity.data;
      const alignments = extractAlignments({
        alignmentTreasuryConservative: spo.alignmentTreasuryConservative ?? null,
        alignmentTreasuryGrowth: spo.alignmentTreasuryGrowth ?? null,
        alignmentDecentralization: spo.alignmentDecentralization ?? null,
        alignmentSecurity: spo.alignmentSecurity ?? null,
        alignmentInnovation: spo.alignmentInnovation ?? null,
        alignmentTransparency: spo.alignmentTransparency ?? null,
      });
      return getDominantDimension(alignments);
    }
    // Proposals don't have alignment — use null (no background tint)
    return null;
  }, [entity]);

  const advance = useCallback(
    (dir: 1 | -1 = 1) => {
      // Only count forward navigation toward the breathe interval
      const newSinceBreathe = dir === 1 ? entitiesSinceBreathe + 1 : entitiesSinceBreathe;

      // Check for breathe point (forward only)
      if (newSinceBreathe >= BREATHE_INTERVAL && dir === 1) {
        setShowBreathe(true);
        setEntitiesSinceBreathe(0);
        return;
      }

      setDirection(dir);
      const nextIndex = currentIndex + dir;
      if (nextIndex >= 0 && nextIndex < queue.length) {
        setCurrentIndex(nextIndex);
        tracking.setIndex(nextIndex);
        if (dir === 1) setEntitiesSinceBreathe(newSinceBreathe);
      }
    },
    [currentIndex, queue.length, entitiesSinceBreathe, tracking],
  );

  const handleAction = useCallback(
    (action: SpotlightAction) => {
      if (!entity) return;

      switch (action) {
        case 'track':
          if (tracking.isTracked(entity.id)) {
            tracking.untrack(entity.id);
          } else {
            tracking.track(entity.id);
          }
          break;
        case 'skip':
          tracking.skip(entity.id);
          advance(1);
          break;
        case 'details':
          onDetails(entity);
          break;
      }
    },
    [entity, tracking, advance, onDetails],
  );

  const handleSwipeRight = useCallback(() => {
    if (!entity) return;
    // Swipe right = Track + advance
    tracking.track(entity.id);
    advance(1);
  }, [entity, tracking, advance]);

  const handleSwipeLeft = useCallback(() => {
    if (!entity) return;
    // Swipe left = Skip
    tracking.skip(entity.id);
    advance(1);
  }, [entity, tracking, advance]);

  const handleBreatheCompare = useCallback(() => {
    setShowBreathe(false);
    onCompare?.();
  }, [onCompare]);

  const handleBreatheContinue = useCallback(() => {
    setShowBreathe(false);
    advance(1);
  }, [advance]);

  if (!entity) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No entities to display.
      </div>
    );
  }

  if (showBreathe) {
    return (
      <div className="py-8">
        <SpotlightBreathe
          trackedCount={tracking.trackedCount}
          onCompare={handleBreatheCompare}
          onContinue={handleBreatheContinue}
        />
      </div>
    );
  }

  const isTracked = tracking.isTracked(entity.id);

  return (
    <div className="relative flex flex-col items-center gap-6 py-4">
      <SpotlightBackground dimension={dominantDimension} />

      {/* Progress */}
      <SpotlightProgress
        current={currentIndex}
        total={queue.length}
        entityType={entityType}
        sort={sort}
      />

      {/* Card with swipe handling */}
      <SwipeHandler
        onSwipeLeft={handleSwipeLeft}
        onSwipeRight={handleSwipeRight}
        className="w-full max-w-2xl"
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={entity.id}
            custom={direction}
            variants={reducedMotion ? undefined : cardVariants}
            initial={reducedMotion ? undefined : 'enter'}
            animate="center"
            exit={reducedMotion ? undefined : 'exit'}
            className="w-full"
          >
            {renderCard(entity, isTracked)}
          </motion.div>
        </AnimatePresence>
      </SwipeHandler>

      {/* Controls */}
      <SpotlightControls
        onAction={handleAction}
        onBack={() => advance(-1)}
        canGoBack={currentIndex > 0}
        isTracked={isTracked}
        delay={reducedMotion ? 0 : 1}
        immediate={!!reducedMotion}
      />

      {/* Tracked count indicator */}
      {tracking.trackedCount > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="tabular-nums font-medium text-amber-400">{tracking.trackedCount}</span>{' '}
          tracked
        </div>
      )}
    </div>
  );
}
