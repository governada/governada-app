'use client';

/**
 * TemporalScrubber — Range input for historical epoch navigation.
 *
 * Drag to see past epochs' constellation data. Releasing snaps back to live.
 * Shows "Epoch N" label while scrubbing, hidden when live.
 */

import { useCallback, useRef } from 'react';
import { useCockpitStore } from '@/stores/cockpitStore';
import { useEpochContext } from '@/hooks/useEpochContext';

export function TemporalScrubber() {
  const { epoch } = useEpochContext();
  const temporalEpoch = useCockpitStore((s) => s.temporalEpoch);
  const setTemporalEpoch = useCockpitStore((s) => s.setTemporalEpoch);
  const releaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minEpoch = Math.max(1, epoch - 10);
  const maxEpoch = epoch;
  const currentValue = temporalEpoch ?? epoch;
  const isScrubbing = temporalEpoch !== null;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (val === epoch) {
        setTemporalEpoch(null);
      } else {
        setTemporalEpoch(val);
      }
      // Clear any pending release timer
      if (releaseTimer.current) {
        clearTimeout(releaseTimer.current);
        releaseTimer.current = null;
      }
    },
    [epoch, setTemporalEpoch],
  );

  const handleRelease = useCallback(() => {
    // Snap back to live after releasing
    releaseTimer.current = setTimeout(() => {
      setTemporalEpoch(null);
      releaseTimer.current = null;
    }, 300);
  }, [setTemporalEpoch]);

  return (
    <div className="flex items-center gap-2">
      {isScrubbing && (
        <span className="text-[10px] font-mono text-amber-400 whitespace-nowrap">
          Epoch {temporalEpoch}
        </span>
      )}
      <input
        type="range"
        min={minEpoch}
        max={maxEpoch}
        value={currentValue}
        onChange={handleChange}
        onMouseUp={handleRelease}
        onTouchEnd={handleRelease}
        className="w-16 h-1 appearance-none bg-white/10 rounded-full cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-compass-teal
          [&::-moz-range-thumb]:w-2 [&::-moz-range-thumb]:h-2 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-compass-teal [&::-moz-range-thumb]:border-0"
        aria-label="Temporal epoch scrubber"
        title={isScrubbing ? `Viewing Epoch ${temporalEpoch}` : 'Drag to view historical epochs'}
      />
    </div>
  );
}
